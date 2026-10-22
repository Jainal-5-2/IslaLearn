from django.contrib import admin

from .models import Application, Request


class ApplicationInline(admin.TabularInline):
    model = Application
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(Request)
class RequestAdmin(admin.ModelAdmin):
    list_display = ("id", "tutee", "subject", "status", "created_at")
    list_filter = ("status", "subject")
    search_fields = ("description", "tutee__username")
    inlines = [ApplicationInline]


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "request", "tutor", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("tutor__username", "message")