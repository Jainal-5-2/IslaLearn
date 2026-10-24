from django.conf import settings
from django.db import models


class Session(models.Model):
    """
    A completed interaction, either a 1:1 request or a broadcast.

    Created when the tutor marks the underlying Request or Broadcast
    complete. The parties are derived from the FK, not stored here:
    see `apps/sessions/parties.py::session_participants`. That keeps
    Session from drifting if the accepted application or participant
    list changes.

    Exactly one of request or broadcast is set, enforced by the check
    constraint. A session is either 1:1 or broadcast, never both and
    never neither.
    """

    SESSION_TYPE_CHOICES = [
        ("one_on_one", "One-on-one"),
        ("broadcast", "Broadcast"),
    ]

    session_type = models.CharField(
        max_length=16, choices=SESSION_TYPE_CHOICES
    )
    request = models.ForeignKey(
        "requests.Request",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="sessions",
    )
    broadcast = models.ForeignKey(
        "broadcasts.Broadcast",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="sessions",
    )

    completed_at = models.DateTimeField(null=True, blank=True)
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="sessions_marked",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        session_type="one_on_one",
                        request__isnull=False,
                        broadcast__isnull=True,
                    )
                    | models.Q(
                        session_type="broadcast",
                        request__isnull=True,
                        broadcast__isnull=False,
                    )
                ),
                name="session_type_matches_fk",
            )
        ]

    def __str__(self):
        target = self.request_id or self.broadcast_id
        return f"{self.session_type} session #{target}"


class Review(models.Model):
    """
    A rating and optional comment left by one participant about another
    after a session is complete.

    The "anyone review anyone once" rule: reviewer and reviewee must
    both be participants in the session, and each reviewer can leave
    at most one review per session. Enforced in the view for the
    participant check, and by unique_together for the once-per-reviewer
    rule.
    """

    session = models.ForeignKey(
        Session, on_delete=models.CASCADE, related_name="reviews"
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews_written",
    )
    reviewee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews_received",
    )
    rating = models.PositiveSmallIntegerField()
    text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("session", "reviewer")

    def __str__(self):
        return f"{self.reviewer.username} -> {self.reviewee.username} ({self.rating})"