from rest_framework import serializers

from apps.sessions.serializers import SessionSerializer
from apps.topics.models import Subject
from apps.users.serializers import UserSerializer

from .models import Broadcast, BroadcastParticipant


class SubjectMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "name"]


class BroadcastParticipantSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = BroadcastParticipant
        fields = ["id", "user", "joined_at"]
        read_only_fields = fields


class BroadcastListSerializer(serializers.ModelSerializer):
    tutor = UserSerializer(read_only=True)
    subject = SubjectMiniSerializer(read_only=True)
    participant_count = serializers.IntegerField(
        source="participants.count", read_only=True
    )
    is_full = serializers.SerializerMethodField()
    my_participation = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()
    completed_at = serializers.SerializerMethodField()

    class Meta:
        model = Broadcast
        fields = [
            "id",
            "tutor",
            "subject",
            "title",
            "description",
            "scheduled_at",
            "duration_minutes",
            "capacity",
            "participant_count",
            "is_full",
            "is_cancelled",
            "my_participation",
            "is_completed",
            "completed_at",
            "created_at",
        ]

    def get_is_full(self, obj):
        return obj.participants.count() >= obj.capacity

    def get_my_participation(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return False
        # The tutor is not a participant row but is always allowed in.
        if obj.tutor_id == user.id:
            return False
        preloaded = self.context.get("my_participations")
        if preloaded is not None:
            return obj.id in preloaded
        return obj.participants.filter(user=user).exists()

    def get_is_completed(self, obj):
        return obj.completed_at is not None

    def get_completed_at(self, obj):
        if obj.completed_at is None:
            return None
        return obj.completed_at.isoformat()


class BroadcastDetailSerializer(serializers.ModelSerializer):
    tutor = UserSerializer(read_only=True)
    subject = SubjectMiniSerializer(read_only=True)
    participants = BroadcastParticipantSerializer(many=True, read_only=True)
    participant_count = serializers.IntegerField(
        source="participants.count", read_only=True
    )
    is_full = serializers.SerializerMethodField()
    is_tutor = serializers.SerializerMethodField()
    my_participation = serializers.SerializerMethodField()
    can_join = serializers.SerializerMethodField()
    session = serializers.SerializerMethodField()

    class Meta:
        model = Broadcast
        fields = [
            "id",
            "tutor",
            "subject",
            "title",
            "description",
            "scheduled_at",
            "duration_minutes",
            "capacity",
            "participant_count",
            "is_full",
            "is_cancelled",
            "is_tutor",
            "my_participation",
            "can_join",
            "participants",
            "session",
            "created_at",
            "updated_at",
        ]

    def _user(self):
        request = self.context.get("request")
        return getattr(request, "user", None)

    def get_is_full(self, obj):
        return obj.participants.count() >= obj.capacity

    def get_is_tutor(self, obj):
        user = self._user()
        return user is not None and user.is_authenticated and obj.tutor_id == user.id

    def get_my_participation(self, obj):
        user = self._user()
        if user is None or not user.is_authenticated:
            return False
        if obj.tutor_id == user.id:
            return False
        preloaded = self.context.get("my_participations")
        if preloaded is not None:
            return obj.id in preloaded
        return obj.participants.filter(user=user).exists()

    def get_can_join(self, obj):
        user = self._user()
        if user is None or not user.is_authenticated:
            return False
        if obj.tutor_id == user.id:
            return False
        if obj.is_cancelled:
            return False
        if obj.completed_at is not None:
            return False
        if self.get_my_participation(obj):
            return False
        return obj.participants.count() < obj.capacity

    def get_session(self, obj):
        session = obj.sessions.first()
        if session is None:
            return None
        return SessionSerializer(session, context=self.context).data


class BroadcastCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Broadcast
        fields = [
            "subject",
            "title",
            "description",
            "scheduled_at",
            "duration_minutes",
            "capacity",
        ]

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError("Title cannot be empty.")
        return value

    def validate_scheduled_at(self, value):
        from django.utils import timezone

        if value <= timezone.now():
            raise serializers.ValidationError(
                "scheduled_at must be in the future."
            )
        return value

    def validate_capacity(self, value):
        if value < 1:
            raise serializers.ValidationError(
                "capacity must be at least 1."
            )
        return value

    def validate_duration_minutes(self, value):
        if value < 1:
            raise serializers.ValidationError(
                "duration_minutes must be at least 1."
            )
        return value