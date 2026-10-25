from django.conf import settings
from django.db import models


class Report(models.Model):
    """
    A user-submitted report about a profile, topic, broadcast, or request.

    Exactly one of target_user, target_topic, target_broadcast,
    target_request is set, enforced by a check constraint. The four-FK
    shape (rather than target_type + target_id) means reports survive
    soft deletion and can be queried with real joins. If a hard delete
    removes the target, on_delete=SET_NULL keeps the report row and
    blanks the FK, so the reason and reporter are preserved for
    moderation review.

    Reports are admin-only: there is no user-facing list endpoint.
    The POST endpoint is the only public surface.
    """

    CATEGORY_CHOICES = [
        ("harassment", "Harassment"),
        ("spam", "Spam"),
        ("impersonation", "Impersonation"),
        ("inappropriate", "Inappropriate content"),
        ("other", "Other"),
    ]

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reports_filed",
    )
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reports_received",
    )
    target_topic = models.ForeignKey(
        "topics.Topic",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reports_received",
    )
    target_broadcast = models.ForeignKey(
        "broadcasts.Broadcast",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reports_received",
    )
    target_request = models.ForeignKey(
        "requests.Request",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reports_received",
    )
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        target_user__isnull=False,
                        target_topic__isnull=True,
                        target_broadcast__isnull=True,
                        target_request__isnull=True,
                    )
                    | models.Q(
                        target_user__isnull=True,
                        target_topic__isnull=False,
                        target_broadcast__isnull=True,
                        target_request__isnull=True,
                    )
                    | models.Q(
                        target_user__isnull=True,
                        target_topic__isnull=True,
                        target_broadcast__isnull=False,
                        target_request__isnull=True,
                    )
                    | models.Q(
                        target_user__isnull=True,
                        target_topic__isnull=True,
                        target_broadcast__isnull=True,
                        target_request__isnull=False,
                    )
                ),
                name="report_target_matches_one_fk",
            )
        ]

    def __str__(self):
        target = (
            self.target_user_id
            or self.target_topic_id
            or self.target_broadcast_id
            or self.target_request_id
        )
        return f"{self.reporter.username} -> {self.category} #{target}"