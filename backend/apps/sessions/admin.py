from django.contrib import admin

from .models import Review, Session


class ReviewInline(admin.TabularInline):
    model = Review
    extra = 0
    readonly_fields = ("reviewer", "reviewee", "rating", "text", "created_at")
    can_delete = False


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "session_type",
        "request",
        "broadcast",
        "completed_at",
        "marked_by",
        "created_at",
    )
    list_filter = ("session_type", "completed_at")
    search_fields = (
        "request__tutee__username",
        "broadcast__title",
        "marked_by__username",
    )
    readonly_fields = ("created_at",)
    inlines = [ReviewInline]


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "session",
        "reviewer",
        "reviewee",
        "rating",
        "created_at",
    )
    list_filter = ("rating",)
    search_fields = (
        "reviewer__username",
        "reviewee__username",
        "text",
    )
    readonly_fields = ("created_at",)