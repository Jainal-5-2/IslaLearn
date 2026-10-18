from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom user model for IslaLearn.

    Extends Django's AbstractUser to add profile fields and hooks for
    future freemium / payout features. Everything from AbstractUser
    (username, email, password, first_name, last_name, is_staff, is_active,
    date_joined, last_login, etc.) is inherited automatically.
    """

    # ---- Profile ----
    bio = models.TextField(blank=True)
    profile_picture = models.ImageField(
        upload_to="avatars/",
        blank=True,
        null=True,
    )

    # ---- Roles (a user can be both a tutor and a tutee) ----
    is_tutor = models.BooleanField(default=False)
    is_tutee = models.BooleanField(default=True)

    # ---- Future hooks (unused in v1) ----
    plan = models.CharField(
        max_length=16,
        choices=[("free", "Free"), ("paid", "Paid")],
        default="free",
    )
    payout_account_id = models.CharField(max_length=64, blank=True)

    def __str__(self):
        return self.username