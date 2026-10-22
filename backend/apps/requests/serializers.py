from rest_framework import serializers

from apps.topics.models import Subject
from apps.users.serializers import UserSerializer

from .models import Application, Request


class SubjectMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "name"]


class ApplicationSerializer(serializers.ModelSerializer):
    tutor = UserSerializer(read_only=True)

    class Meta:
        model = Application
        fields = ["id", "request", "tutor", "message", "status", "created_at"]
        read_only_fields = ["id", "request", "tutor", "status", "created_at"]


class RequestListSerializer(serializers.ModelSerializer):
    tutee = UserSerializer(read_only=True)
    subject = SubjectMiniSerializer(read_only=True)
    application_count = serializers.IntegerField(
        source="applications.count", read_only=True
    )
    my_application_status = serializers.SerializerMethodField()

    class Meta:
        model = Request
        fields = [
            "id",
            "tutee",
            "subject",
            "description",
            "preferred_time",
            "status",
            "application_count",
            "my_application_status",
            "created_at",
        ]

    def get_my_application_status(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return None
        # Avoid N+1: rely on prefetch of applications.
        for app in obj.applications.all():
            if app.tutor_id == user.id:
                return app.status
        return None


class RequestDetailSerializer(serializers.ModelSerializer):
    tutee = UserSerializer(read_only=True)
    subject = SubjectMiniSerializer(read_only=True)
    applications = ApplicationSerializer(many=True, read_only=True)
    can_edit = serializers.SerializerMethodField()
    subject_locked = serializers.SerializerMethodField()

    class Meta:
        model = Request
        fields = [
            "id",
            "tutee",
            "subject",
            "description",
            "preferred_time",
            "status",
            "applications",
            "can_edit",
            "subject_locked",
            "created_at",
            "updated_at",
        ]

    def _request_user(self):
        request = self.context.get("request")
        return getattr(request, "user", None)

    def get_can_edit(self, obj):
        user = self._request_user()
        return (
            user is not None
            and user.is_authenticated
            and user == obj.tutee
            and obj.status == "open"
        )

    def get_subject_locked(self, obj):
        return obj.applications.exists()


class RequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Request
        fields = ["subject", "description", "preferred_time"]

    def validate_description(self, value):
        if not value.strip():
            raise serializers.ValidationError("Description cannot be empty.")
        return value


class RequestUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Request
        fields = ["subject", "description", "preferred_time"]

    def validate_description(self, value):
        if not value.strip():
            raise serializers.ValidationError("Description cannot be empty.")
        return value


class ApplicationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = ["message"]

    def validate_message(self, value):
        if not value.strip():
            raise serializers.ValidationError("Message cannot be empty.")
        return value