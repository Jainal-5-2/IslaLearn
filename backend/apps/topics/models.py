from django.db import models
from django.conf import settings


class Subject(models.Model):
    """
    Curated taxonomy of Computer Science subjects.
    e.g., "Python", "Data Structures", "Web Development".
    """
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Topic(models.Model):
    """
    An async learning resource created by a tutor.
    Container for ordered TopicPages.
    """
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="topics")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name="created_topics"
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    is_published = models.BooleanField(default=False)
    
    # The first N pages are always free. 
    # For MVP this is always open, but logic exists for future monetization.
    free_page_count = models.PositiveIntegerField(default=2)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class TopicPage(models.Model):
    """
    An individual page within a Topic.
    Can be text, video, or a quiz.
    """
    PAGE_TYPES = [
        ("text", "Text"),
        ("video", "Video"),
        ("quiz", "Quiz"),
    ]

    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="pages")
    order = models.PositiveIntegerField(default=1)
    page_type = models.CharField(max_length=10, choices=PAGE_TYPES, default="text")
    
    # JSONField stores:
    # - text: {"body": "..."}
    # - video: {"url": "..."}
    # - quiz: {"questions": [{"question": "...", "options": ["A", "B"], "correct_index": 0}]}
    content = models.JSONField(default=dict)

    class Meta:
        ordering = ["order"]
        # Prevent two pages from having the same order number in the same topic
        unique_together = ["topic", "order"]

    def __str__(self):
        return f"{self.topic.title} - Page {self.order} ({self.page_type})"