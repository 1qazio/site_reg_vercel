import json
from datetime import datetime

from django.db import connection, transaction
from django.utils.dateparse import parse_date

from .models import Booking, User


ROOMS = ["кабинет большой", "песочница", "кабинет математики"]
DAY_START = 9 * 60
DAY_END = 22 * 60
DURATIONS = {30, 60, 90, 120, 180}


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def get_state_payload():
    users = [
        {
            "id": str(user.id),
            "name": user.name,
            "createdAt": user.created_at.isoformat(),
        }
        for user in User.objects.all().order_by("name")
    ]
    bookings = [
        {
            "id": str(booking.id),
            "userId": str(booking.user_id),
            "userName": booking.user_name,
            "room": booking.room,
            "date": booking.date.isoformat(),
            "startMin": booking.start_min,
            "endMin": booking.end_min,
            "createdAt": booking.created_at.isoformat(),
        }
        for booking in Booking.objects.select_related("user").all().order_by("date", "room", "start_min")
    ]

    return {
        "rooms": ROOMS,
        "users": users,
        "bookings": bookings,
        "serverTime": datetime.utcnow().isoformat() + "Z",
    }


def register_user(name):
    normalized_name = normalize_name(name)
    if not normalized_name:
        raise ApiError("Введите имя пользователя", 400)

    existing = User.objects.filter(name__iexact=normalized_name).first()
    if existing:
        return {
            "user": serialize_user(existing),
            "created": False,
            "message": "Вход выполнен",
        }

    created = User.objects.create(name=normalized_name)
    return {
        "user": serialize_user(created),
        "created": True,
        "message": "Пользователь зарегистрирован",
    }


@transaction.atomic
def create_booking(payload):
    user_id = str(payload.get("userId", "")).strip()
    room = str(payload.get("room", "")).strip()
    date_value = str(payload.get("date", "")).strip()

    try:
        start_min = int(payload.get("startMin"))
        duration = int(payload.get("duration"))
    except (TypeError, ValueError):
        raise ApiError("Некорректные параметры времени", 400)

    validate_booking_payload(user_id, room, date_value, start_min, duration)

    user = User.objects.filter(pk=user_id).first()
    if not user:
        raise ApiError("Пользователь не найден. Зарегистрируйтесь заново.", 400)

    date_obj = parse_date(date_value)
    end_min = start_min + duration

    lock_slot(room, date_value)

    has_conflict = Booking.objects.filter(
        room=room,
        date=date_obj,
        start_min__lt=end_min,
        end_min__gt=start_min,
    ).exists()
    if has_conflict:
        raise ApiError("Это время уже занято", 409)

    booking = Booking.objects.create(
        user=user,
        user_name=user.name,
        room=room,
        date=date_obj,
        start_min=start_min,
        end_min=end_min,
    )

    return serialize_booking(booking)


@transaction.atomic
def delete_booking(booking_id, user_id):
    normalized_booking_id = str(booking_id or "").strip()
    normalized_user_id = str(user_id or "").strip()

    if not normalized_booking_id or not normalized_user_id:
        raise ApiError("Не хватает данных для удаления брони", 400)

    booking = Booking.objects.filter(pk=normalized_booking_id).first()
    if not booking:
        raise ApiError("Бронь уже удалена или не найдена", 404)

    if str(booking.user_id) != normalized_user_id:
        raise ApiError("Можно отменять только свои бронирования", 403)

    booking.delete()


def decode_json_body(request):
    if not request.body:
        return {}

    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ApiError("Некорректный JSON", 400) from exc


def validate_booking_payload(user_id, room, date_value, start_min, duration):
    if not user_id:
        raise ApiError("Сначала зарегистрируйтесь", 400)
    if room not in ROOMS:
        raise ApiError("Выбран неверный кабинет", 400)
    if not parse_date(date_value):
        raise ApiError("Некорректная дата", 400)
    if start_min < DAY_START or start_min >= DAY_END:
        raise ApiError("Некорректное время начала", 400)
    if duration not in DURATIONS:
        raise ApiError("Некорректная длительность", 400)
    if start_min + duration > DAY_END:
        raise ApiError("Слот выходит за границы дня", 400)


def lock_slot(room, date_value):
    # Locks one logical room/day slot so two serverless instances do not create overlapping bookings at once.
    with connection.cursor() as cursor:
        cursor.execute("select pg_advisory_xact_lock(hashtext(%s));", [f"{room}:{date_value}"])


def normalize_name(value):
    return str(value or "").strip()[:30]


def serialize_user(user):
    return {
        "id": str(user.id),
        "name": user.name,
        "createdAt": user.created_at.isoformat(),
    }


def serialize_booking(booking):
    return {
        "id": str(booking.id),
        "userId": str(booking.user_id),
        "userName": booking.user_name,
        "room": booking.room,
        "date": booking.date.isoformat(),
        "startMin": booking.start_min,
        "endMin": booking.end_min,
        "createdAt": booking.created_at.isoformat(),
    }
