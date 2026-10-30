from django.conf import settings
from django.db import models


class Broadcast(models.Model):
    """
    A scheduled group session offered by a tutor on a Subject.

    The Whereby room is created at broadcast-creation time, so room_url
    is populated before the row is committed. If room creation fails,
    the create view rolls back and no row is written.

    duration_minutes defaults to 30 to match the Whereby Explore plan's
    per-meeting cap. A tutor can set it higher, but the free plan will
    drop the room at 30 minutes regardless. The UI is responsible for
    not pretending a 45-minute broadcast will run for 45 minutes on the
    free plan.
    """

    tutor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="broadcasts",
    )
    subject = models.ForeignKey(
        "topics.Subject",
        on_delete=models.CASCADE,
        related_name="broadcasts",
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    scheduled_at = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(default=30)
    capacity = models.PositiveIntegerField(default=10)

    # Provider-neutral room reference. Whereby rooms are joined by URL,
    # not signed tokens, so the URL is the access grant. The backend
    # check in BroadcastRoomUrlView is the entire gate.
    room_provider = models.CharField(max_length=20, default="whereby")
    room_url = models.URLField(blank=True)

    is_cancelled = models.BooleanField(default=False)

    # Set when the tutor marks the broadcast complete. Distinct from
    # is_cancelled: a broadcast is neither, cancelled, or completed, but
    # not both cancelled and completed. Drives the join/room-url/cancel
    # guards and the "Completed" badge. The Session row created by
    # BroadcastCompleteView is the review anchor; this column is the
    # broadcast's own terminal-state marker, so those two facts cannot
    # disagree.
    completed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["scheduled_at"]

    def __str__(self):
        return f"{self.title} by {self.tutor.username} at {self.scheduled_at}"


class BroadcastParticipant(models.Model):
    """
    A tutee who has joined a Broadcast.

    The tutor is not a participant row. The tutor is always allowed in
    and does not count against capacity.
    """

    broadcast = models.ForeignKey(
        Broadcast,
        on_delete=models.CASCADE,
        related_name="participants",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="broadcast_participations",
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("broadcast", "user")
        ordering = ["joined_at"]

    def __str__(self):
        return f"{self.user.username} in {self.broadcast.title}"