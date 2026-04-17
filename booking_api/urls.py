from django.urls import path

from .views import booking_detail_view, bookings_view, register_view, state_view


urlpatterns = [
    path("state", state_view),
    path("register", register_view),
    path("bookings", bookings_view),
    path("bookings/<uuid:booking_id>", booking_detail_view),
]
