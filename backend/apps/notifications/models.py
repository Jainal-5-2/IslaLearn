from django.conf import settings
from django.db import models


class Notification(models.Model):
    """
    A single in-app notification for one recipient.

    Fan-out is explicit in the source view bodies, not driven by
    signals. Each source view calls apps.notifications.services.notify,
    which writes one row per recipient and (in the WebSocket pass) also
    pushes the row to the recipient's user_<id> group. Writes happen
    inside the source view's existing transaction so a rolled-back
    accept or completion does not leave a notification behind.

    Exactly one of the five target FKs is set, enforced by a check
    constraint. The five-FK shape (rather than target_type + target_id)
    mirrors Report: it survives soft deletion, it is queryable with
    real joins, and a reader who knows Report knows Notification. The
    fifth FK, target_review, exists because review_received points at a
    Review, which none of Report's four FKs cover.

    actor is SET_NULL and nullable so a deleted actor does not delete
    the recipient's notification. recipient is CASCADE: a notification
    addressed to a deleted user is meaningless.

    read_at is a nullable timestamp, not a boolean, so "when" is free
    and the unread predicate is read_at__isnull=True. The two indexes
    cover the two query shapes in views.py: the unread count and the
    newest-first list.
    """

    KIND_CHOICES = [
        ("application_received", "Application received"),
        ("application_accepted", "Application accepted"),
        ("application_rejected", "Application rejected"),
        ("session_completed", "Session completed"),
        ("review_received", "Review received"),
        ("message_received", "Message received"),
    ]

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications_received",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notifications_caused",
    )
    kind = models.CharField(max_length=32, choices=KIND_CHOICES)

    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notifications_targeting_me",
    )
    target_topic = models.ForeignKey(
        "topics.Topic",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notifications",
    )
    target_broadcast = models.ForeignKey(
        "broadcasts.Broadcast",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notifications",
    )
    target_request = models.ForeignKey(
        "requests.Request",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notifications",
    )
    target_review = models.ForeignKey(
        "learning_sessions.Review",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notifications",
    )

    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "read_at"]),
            models.Index(fields=["recipient", "-created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        target_user__isnull=False,
                        target_topic__isnull=True,
                        target_broadcast__isnull=True,
                        target_request__isnull=True,
                        target_review__isnull=True,
                    )
                    | models.Q(
                        target_user__isnull=True,
                        target_topic__isnull=False,
                        target_broadcast__isnull=True,
                        target_request__isnull=True,
                        target_review__isnull=True,
                    )
                    | models.Q(
                        target_user__isnull=True,
                        target_topic__isnull=True,
                        target_broadcast__isnull=False,
                        target_request__isnull=True,
                        target_review__isnull=True,
                    )
                    | models.Q(
                        target_user__isnull=True,
                        target_topic__isnull=True,
                        target_broadcast__isnull=True,
                        target_request__isnull=False,
                        target_review__isnull=True,
                    )
                    | models.Q(
                        target_user__isnull=True,
                        target_topic__isnull=True,
                        target_broadcast__isnull=True,
                        target_request__isnull=True,
                        target_review__isnull=False,
                    )
                ),
                name="notification_target_matches_one_fk",
            )
        ]

    def __str__(self):
        target = (
            self.target_user_id
            or self.target_topic_id
            or self.target_broadcast_id
            or self.target_request_id
            or self.target_review_id
        )
        return f"{self.recipient.username} <- {self.kind} #{target}"