from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    """
    Admin for the custom User model.

    We extend Django's built-in UserAdmin so the password-change flow,
    permissions UI, and other auth admin features keep working. Then we
    add our extra fields.
    """

    # Add our fields to the existing fieldset layout
    fieldsets = UserAdmin.fieldsets + (
        ("IslaLearn", {"fields": ("bio", "is_tutor", "is_tutee", "plan")}),
    )

    # Columns shown in the user list table
    list_display = (
        "username",
        "email",
        "is_tutor",
        "is_tutee",
        "plan",
        "is_active",
    )

    # Filters on the right sidebar of the user list
    list_filter = UserAdmin.list_filter + ("is_tutor", "is_tutee", "plan")