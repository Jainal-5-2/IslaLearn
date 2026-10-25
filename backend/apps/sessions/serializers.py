from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.users.serializers import UserSerializer

from .models import Review, Session
from .parties import session_participants

User = get_user_model()


class ReviewSerializer(serializers.ModelSerializer):
    reviewer = UserSerializer(read_only=True)
    reviewee = UserSerializer(read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "session",
            "reviewer",
            "reviewee",
            "rating",
            "text",
            "created_at",
        ]
        read_only_fields = fields


class ReviewCreateSerializer(serializers.ModelSerializer):
    reviewee = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())

    class Meta:
        model = Review
        fields = ["reviewee", "rating", "text"]

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("rating must be between 1 and 5.")
        return value

    def validate(self, attrs):
        session = self.context["session"]
        reviewer = self.context["request"].user
        reviewee = attrs["reviewee"]

        if session.completed_at is None:
            raise serializers.ValidationError(
                "This session is not complete yet."
            )
        if reviewer == reviewee:
            raise serializers.ValidationError("You cannot review yourself.")

        parties = session_participants(session)
        if reviewer not in parties:
            raise serializers.ValidationError(
                "You did not take part in this session."
            )
        if reviewee not in parties:
            raise serializers.ValidationError(
                "You can only review someone who took part in this session."
            )

        if Review.objects.filter(session=session, reviewer=reviewer).exists():
            raise serializers.ValidationError(
                "You have already reviewed this session."
            )

        return attrs


class SessionSerializer(serializers.ModelSerializer):
    """
    Read shape for a Session. `my_review` is null when the requesting
    user has not reviewed yet, and `can_review` is false when they
    cannot (not a participant, already reviewed, or incomplete).
    """

    can_review = serializers.SerializerMethodField()
    my_review = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = [
            "id",
            "session_type",
            "request",
            "broadcast",
            "completed_at",
            "marked_by",
            "created_at",
            "can_review",
            "my_review",
        ]

    def _user(self):
        request = self.context.get("request")
        return getattr(request, "user", None)

    def get_can_review(self, obj):
        user = self._user()
        if user is None or not user.is_authenticated:
            return False
        if obj.completed_at is None:
            return False
        if user not in session_participants(obj):
            return False
        preloaded = self.context.get("my_reviews_by_session")
        if preloaded is not None:
            return obj.id not in preloaded
        return not Review.objects.filter(session=obj, reviewer=user).exists()

    def get_my_review(self, obj):
        user = self._user()
        if user is None or not user.is_authenticated:
            return None
        preloaded = self.context.get("my_reviews_by_session")
        if preloaded is not None:
            review = preloaded.get(obj.id)
        else:
            review = Review.objects.filter(session=obj, reviewer=user).first()
        if review is None:
            return None
        return ReviewSerializer(review).data


def _other_party(session, user):
    """
    The participants on the other side of the session from `user`.
    For 1:1 this is a single user; for a broadcast it is the tutor plus
    the other participants. The queryset already excludes sessions the
    user is not a party to, so this never returns an empty list for a
    visible session.
    """
    parties = session_participants(session)
    return [p for p in parties if p.id != user.id]


class SessionListSerializer(serializers.ModelSerializer):
    """
    List shape for GET /api/sessions/. Adds `other_parties` and a small
    source summary so the /sessions page can render a row without a
    second fetch.
    """

    other_parties = serializers.SerializerMethodField()
    source_title = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = [
            "id",
            "session_type",
            "request",
            "broadcast",
            "source_title",
            "other_parties",
            "completed_at",
            "created_at",
        ]

    def _user(self):
        request = self.context.get("request")
        return getattr(request, "user", None)

    def get_other_parties(self, obj):
        user = self._user()
        if user is None or not user.is_authenticated:
            return []
        return [{"id": u.id, "username": u.username} for u in _other_party(obj, user)]

    def get_source_title(self, obj):
        if obj.session_type == "one_on_one" and obj.request_id is not None:
            return obj.request.subject.name
        if obj.session_type == "broadcast" and obj.broadcast_id is not None:
            return obj.broadcast.title
        return ""


class SessionDetailSerializer(SessionSerializer):
    """
    Detail shape for GET /api/sessions/{id}/. Extends SessionSerializer
    with the source summary and the same `other_parties` list as the
    list serializer.
    """

    other_parties = serializers.SerializerMethodField()
    source_title = serializers.SerializerMethodField()
    source_link = serializers.SerializerMethodField()

    class Meta(SessionSerializer.Meta):
        fields = SessionSerializer.Meta.fields + [
            "other_parties",
            "source_title",
            "source_link",
        ]

    def _user(self):
        request = self.context.get("request")
        return getattr(request, "user", None)

    def get_other_parties(self, obj):
        user = self._user()
        if user is None or not user.is_authenticated:
            return []
        return [{"id": u.id, "username": u.username} for u in _other_party(obj, user)]

    def get_source_title(self, obj):
        if obj.session_type == "one_on_one" and obj.request_id is not None:
            return obj.request.subject.name
        if obj.session_type == "broadcast" and obj.broadcast_id is not None:
            return obj.broadcast.title
        return ""

    def get_source_link(self, obj):
        if obj.session_type == "one_on_one" and obj.request_id is not None:
            return f"/requests/{obj.request_id}"
        if obj.session_type == "broadcast" and obj.broadcast_id is not None:
            return f"/broadcasts/{obj.broadcast_id}"
        return None