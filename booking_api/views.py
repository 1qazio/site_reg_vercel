from pathlib import Path

from django.http import FileResponse, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .services import (
    ApiError,
    create_booking,
    decode_json_body,
    delete_booking,
    get_state_payload,
    register_user,
)


BASE_DIR = Path(__file__).resolve().parent.parent


def cors_json(payload, status=200):
    response = JsonResponse(payload, status=status, json_dumps_params={"ensure_ascii": False})
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "GET,POST,DELETE,OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type"
    return response


def options_response():
    response = HttpResponse(status=204)
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "GET,POST,DELETE,OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type"
    return response


def index_view(request):
    if request.method != "GET":
        return cors_json({"error": "Метод не поддерживается"}, status=405)

    index_path = BASE_DIR / "index.html"
    return FileResponse(index_path.open("rb"), content_type="text/html; charset=utf-8")


def static_file_view(request, filename, content_type):
    if request.method != "GET":
        return cors_json({"error": "Метод не поддерживается"}, status=405)

    file_path = BASE_DIR / filename
    if not file_path.exists():
        return HttpResponse("Not Found", status=404)

    return FileResponse(file_path.open("rb"), content_type=content_type)


def style_view(request):
    return static_file_view(request, "style.css", "text/css; charset=utf-8")


def script_view(request):
    return static_file_view(request, "script.js", "application/javascript; charset=utf-8")


def favicon_view(request):
    return static_file_view(request, "favicon.svg", "image/svg+xml")


@csrf_exempt
def state_view(request):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "GET":
        return cors_json({"error": "Метод не поддерживается"}, status=405)

    try:
        return cors_json(get_state_payload())
    except Exception as exc:
        return cors_json({"error": str(exc) or "Не удалось загрузить состояние"}, status=500)


@csrf_exempt
def register_view(request):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "POST":
        return cors_json({"error": "Метод не поддерживается"}, status=405)

    try:
        payload = decode_json_body(request)
        return cors_json(register_user(payload.get("name")))
    except ApiError as exc:
        return cors_json({"error": str(exc)}, status=exc.status)


@csrf_exempt
def bookings_view(request):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "POST":
        return cors_json({"error": "Метод не поддерживается"}, status=405)

    try:
        payload = decode_json_body(request)
        booking = create_booking(payload)
        return cors_json({"booking": booking}, status=201)
    except ApiError as exc:
        return cors_json({"error": str(exc)}, status=exc.status)


@csrf_exempt
def booking_detail_view(request, booking_id):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "DELETE":
        return cors_json({"error": "Метод не поддерживается"}, status=405)

    try:
        payload = decode_json_body(request)
        delete_booking(booking_id, payload.get("userId"))
        return cors_json({"ok": True})
    except ApiError as exc:
        return cors_json({"error": str(exc)}, status=exc.status)
