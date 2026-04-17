from django.urls import include, path
from booking_api.views import index_view
from booking_api.views import booking_detail_view, bookings_view, register_view, state_view


urlpatterns = [
    path("", index_view),
    path("state", state_view),
    path("register", register_view),
    path("bookings", bookings_view),
    path("bookings/<uuid:booking_id>", booking_detail_view),
    path("api/", include("booking_api.urls")),
]
