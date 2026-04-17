import uuid

from django.db import models
from django.db.models.functions import Now


class User(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.TextField()
    created_at = models.DateTimeField(db_default=Now())

    class Meta:
        managed = False
        db_table = "users"
        ordering = ["name"]


class Booking(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, models.DO_NOTHING, db_column="user_id")
    user_name = models.TextField()
    room = models.TextField()
    date = models.DateField()
    start_min = models.IntegerField()
    end_min = models.IntegerField()
    created_at = models.DateTimeField(db_default=Now())

    class Meta:
        managed = False
        db_table = "bookings"
        ordering = ["date", "room", "start_min"]
