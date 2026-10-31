from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "recipient",
        "actor",
        "kind",
        "target_user",
        "target_topic",
        "target_broadcast",
        "target_request",
        "target_review",
        "read_at",
        "created_at",
    )
    list_filter = ("kind", "read_at", "created_at")
    search_fields = (
        "recipient__username",
        "actor__username",
        "target_user__username",
        "target_topic__title",
        "target_broadcast__title",
        "target_request__description",
    )
    readonly_fields = (
        "recipient",
        "actor",
        "kind",
        "target_user",
        "target_topic",
        "target_broadcast",
        "target_request",
        "target_review",
        "read_at",
        "created_at",
    )

    def has_add_permission(self, request):
        # Notifications are created by the fan-out code in
        # apps.notifications.services.notify. An admin-added row would
        # bypass the "actor is excluded from recipients" rule, which the
        # DB check constraint does not catch.
        return False