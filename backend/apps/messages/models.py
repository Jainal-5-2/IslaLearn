from django.conf import settings
from django.db import models


class Thread(models.Model):
    """
    A 1:1 message thread between the tutee and the accepted tutor of a
    Request. One thread per request, created when the tutor accepts.

    Open/closed is derived, not stored. A thread is open while the
    request is closed (i.e. has an accepted tutor), no Session row
    exists for it, and it has not been cancelled by reopening. See
    `apps.messages.parties.thread_is_open`. No `closed_at` column;
    adding one would be redundant with `Session.completed_at` and
    would drift.
    """

    request = models.OneToOneField(
        "requests.Request",
        on_delete=models.CASCADE,
        related_name="thread",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Thread for request #{self.request_id}"


class Message(models.Model):
    """
    A single message in a Thread. Body is non-empty and capped at 2000
    characters; validation lives in the serializer, not the model, so
    the DB is not constrained. Sender must be a thread party; that is
    enforced in the view.
    """

    thread = models.ForeignKey(
        Thread,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_messages",
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["thread", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.sender.username} -> thread #{self.thread_id}"