from django.conf import settings
from django.db import models


class Request(models.Model):
    """
    A tutee's request for 1:1 help on a specific Subject.
    Tutors browse open requests and apply.
    """

    STATUS_CHOICES = [
        ("open", "Open"),
        ("closed", "Closed"),
    ]

    tutee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="requests",
    )
    subject = models.ForeignKey(
        "topics.Subject",
        on_delete=models.CASCADE,
        related_name="requests",
    )
    description = models.TextField()
    preferred_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="open")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.tutee.username} → {self.subject.name} ({self.status})"


class Application(models.Model):
    """
    A tutor's application to a Request.
    Exactly one application can be accepted per request.
    """

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("rejected", "Rejected"),
    ]

    request = models.ForeignKey(
        Request,
        on_delete=models.CASCADE,
        related_name="applications",
    )
    tutor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="applications",
    )
    message = models.TextField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        # One tutor can apply to a request only once
        unique_together = ("request", "tutor")

    def __str__(self):
        return f"{self.tutor.username} → request #{self.request_id} ({self.status})"