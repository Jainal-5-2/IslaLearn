from rest_framework import serializers

from apps.users.serializers import UserSerializer

from .models import Message, Thread
from .parties import thread_is_open, thread_parties


def _other_party(thread, user):
    return [p for p in thread_parties(thread) if p.id != user.id]


class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ["id", "thread", "sender", "body", "created_at"]
        read_only_fields = fields


class MessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["body"]

    def validate_body(self, value):
        text = (value or "").strip()
        if not text:
            raise serializers.ValidationError("Message body cannot be empty.")
        if len(text) > 2000:
            raise serializers.ValidationError(
                "Message body cannot exceed 2000 characters."
            )
        return text


class ThreadListSerializer(serializers.ModelSerializer):
    """
    One row for the /messages list. Includes the other party, the
    source summary, the last message preview, and the derived is_open
    state.
    """

    other_party = serializers.SerializerMethodField()
    source_title = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    is_open = serializers.SerializerMethodField()

    class Meta:
        model = Thread
        fields = [
            "id",
            "request",
            "source_title",
            "other_party",
            "last_message",
            "is_open",
            "created_at",
        ]

    def _user(self):
        request = self.context.get("request")
        return getattr(request, "user", None)

    def get_other_party(self, obj):
        user = self._user()
        if user is None or not user.is_authenticated:
            return None
        others = _other_party(obj, user)
        if not others:
            return None
        u = others[0]
        return {"id": u.id, "username": u.username}

    def get_source_title(self, obj):
        return obj.request.subject.name

    def get_last_message(self, obj):
        # Uses the prefetched list from the view; falls back to a query
        # if called outside a prefetched context (e.g. tests).
        prefetched = getattr(obj, "_prefetched_last_message", None)
        if prefetched is not None:
            msg = prefetched
        else:
            msg = obj.messages.select_related("sender").last()
        if msg is None:
            return None
        return {
            "id": msg.id,
            "body": msg.body[:120],
            "sender_id": msg.sender_id,
            "created_at": msg.created_at,
        }

    def get_is_open(self, obj):
        return thread_is_open(obj)