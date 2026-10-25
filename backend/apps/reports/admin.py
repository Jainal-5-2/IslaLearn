from django.contrib import admin

from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "reporter",
        "target_user",
        "target_topic",
        "target_broadcast",
        "target_request",
        "category",
        "created_at",
    )
    list_filter = ("category", "created_at")
    search_fields = (
        "reporter__username",
        "target_user__username",
        "target_topic__title",
        "target_broadcast__title",
        "target_request__description",
        "target_request__tutee__username",
        "reason",
    )
    readonly_fields = (
        "reporter",
        "target_user",
        "target_topic",
        "target_broadcast",
        "target_request",
        "category",
        "reason",
        "created_at",
    )

    def has_add_permission(self, request):
        # Reports are created through the API. Adding one in the admin
        # would bypass the self-report and target checks.
        return False