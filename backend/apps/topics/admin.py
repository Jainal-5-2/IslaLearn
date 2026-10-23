from django.contrib import admin
from .models import Subject, Topic, TopicPage, TopicProgress


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("name", "description")
    search_fields = ("name",)


class TopicPageInline(admin.TabularInline):
    model = TopicPage
    extra = 1
    ordering = ("order",)


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ("title", "subject", "created_by", "is_published", "created_at")
    list_filter = ("subject", "is_published")
    search_fields = ("title", "description")
    inlines = [TopicPageInline]


@admin.register(TopicProgress)
class TopicProgressAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "topic",
        "last_page_index",
        "last_visited_at",
        "completed_at",
    )
    list_filter = ("completed_at",)
    search_fields = ("user__username", "topic__title")
    readonly_fields = ("last_visited_at", "completed_at")
    raw_id_fields = ("user", "topic")