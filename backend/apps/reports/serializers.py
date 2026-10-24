from rest_framework import serializers

from apps.broadcasts.models import Broadcast
from apps.topics.models import Topic
from apps.users.models import User

from .models import Report


class ReportCreateSerializer(serializers.Serializer):
    """
    Input for POST /api/reports/.

    Exactly one of target_user, target_topic, target_broadcast must be
    provided. The model's check constraint is the backstop; this
    serializer is the friendly error. Reason is required when category
    is "other" and optional otherwise.
    """

    target_user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True
    )
    target_topic = serializers.PrimaryKeyRelatedField(
        queryset=Topic.objects.all(), required=False, allow_null=True
    )
    target_broadcast = serializers.PrimaryKeyRelatedField(
        queryset=Broadcast.objects.all(), required=False, allow_null=True
    )
    category = serializers.ChoiceField(choices=Report.CATEGORY_CHOICES)
    reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        targets = [
            attrs.get("target_user"),
            attrs.get("target_topic"),
            attrs.get("target_broadcast"),
        ]
        provided = [t for t in targets if t is not None]
        if len(provided) != 1:
            raise serializers.ValidationError(
                "Provide exactly one target: user, topic, or broadcast."
            )

        category = attrs["category"]
        reason = (attrs.get("reason") or "").strip()
        if category == "other" and not reason:
            raise serializers.ValidationError(
                {"reason": "A reason is required when the category is 'other'."}
            )

        request = self.context.get("request")
        reporter = getattr(request, "user", None)
        target_user = attrs.get("target_user")
        if (
            reporter is not None
            and reporter.is_authenticated
            and target_user is not None
            and target_user.id == reporter.id
        ):
            raise serializers.ValidationError(
                {"target_user": "You cannot report yourself."}
            )

        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        return Report.objects.create(reporter=request.user, **validated_data)


class ReportSerializer(serializers.ModelSerializer):
    reporter = serializers.StringRelatedField()

    class Meta:
        model = Report
        fields = [
            "id",
            "reporter",
            "target_user",
            "target_topic",
            "target_broadcast",
            "category",
            "reason",
            "created_at",
        ]
        read_only_fields = fields