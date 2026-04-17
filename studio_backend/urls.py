from django.urls import include, path
from booking_api.views import index_view


urlpatterns = [
    path("", index_view),
    path("api/", include("booking_api.urls")),
]
