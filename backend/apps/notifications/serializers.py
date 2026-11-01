from rest_framework import serializers

from apps.users.serializers import UserSerializer

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    """
    Read shape for a Notification.

    `target_link` is the frontend route the bell row navigates to.
    Building it server-side means the frontend has no knowledge of the
    kind enum: it renders `actor.username` + `target_label` + the link,
    and the backend decides what each kind means. If a kind is added
    later, only this file changes.

    `target_label` is a short human string for the row copy, e.g. the
    subject name, the broadcast title, or "a review". It is not the
    target's __str__: Broadcast.__str__ embeds the scheduled time and
    is too long for a bell row.

    `is_read` is derived from read_at. The model stores only the
    timestamp; the boolean is computed here so there is one source of
    truth.
    """

    actor = UserSerializer(read_only=True)
    is_read = serializers.SerializerMethodField()
    target_link = serializers.SerializerMethodField()
    target_label = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "kind",
            "actor",
            "target_link",
            "target_label",
            "is_read",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields

    def get_is_read(self, obj):
        return obj.read_at is not None

    def get_target_link(self, obj):
        link, _ = self._resolve_target(obj)
        return link

    def get_target_label(self, obj):
        _, label = self._resolve_target(obj)
        return label

    def _resolve_target(self, obj):
        """
        Return (link, label) for this notification's one target.

        Both computed fields call this so the "which target is set"
        branch lives once. The fallback link is the dashboard when even
        the target FK has been SET_NULLed by a hard delete, which is the
        only case where a notification has nothing to point at.
        """
        kind = obj.kind

        if kind in (
            "application_received",
            "application_accepted",
            "application_rejected",
            "engagement_cancelled",
        ):
            if obj.target_request is None:
                return "/dashboard", "a request"
            return (
                f"/requests/{obj.target_request_id}",
                obj.target_request.subject.name,
            )

        if kind == "session_completed":
            # The row stores the source (request or broadcast), not the
            # session id. The session is the 1:1 row for a request and
            # the broadcast row for a broadcast, so look it up from the
            # source and fall back to the source page if it is gone.
            if obj.target_request is not None:
                session = obj.target_request.sessions.first()
                if session is not None:
                    return (
                        f"/sessions/{session.id}",
                        obj.target_request.subject.name,
                    )
                return (
                    f"/requests/{obj.target_request_id}",
                    obj.target_request.subject.name,
                )
            if obj.target_broadcast is not None:
                session = obj.target_broadcast.sessions.first()
                if session is not None:
                    return (
                        f"/sessions/{session.id}",
                        obj.target_broadcast.title,
                    )
                return (
                    f"/broadcasts/{obj.target_broadcast_id}",
                    obj.target_broadcast.title,
                )
            return "/dashboard", "a session"

        if kind == "review_received":
            # The recipient is the reviewee. Their reviews page is the
            # destination; the review row itself is shown there.
            return (
                f"/profile/{obj.recipient_id}/reviews",
                "a review",
            )

        if kind == "message_received":
            if obj.target_request is None:
                return "/messages", "a message"
            thread = getattr(obj.target_request, "thread", None)
            label = obj.target_request.subject.name
            if thread is not None:
                return f"/messages/{thread.id}", label
            return f"/requests/{obj.target_request_id}", label

        return "/dashboard", ""