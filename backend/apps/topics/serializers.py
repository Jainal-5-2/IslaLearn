from rest_framework import serializers

from .models import Subject, Topic, TopicPage, TopicProgress
from apps.users.serializers import UserSerializer


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "name", "description"]


class TopicPageSerializer(serializers.ModelSerializer):
    is_locked = serializers.SerializerMethodField()

    class Meta:
        model = TopicPage
        fields = ["id", "order", "page_type", "content", "is_locked"]

    def get_is_locked(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return obj.order > obj.topic.free_page_count

        if request.user == obj.topic.created_by:
            return False

        # Paywall: has this user unlocked this topic? is_unlocked is a
        # separate concept from last_page_index. A user with progress but
        # no unlock still sees pages past free_page_count as locked.
        progress = self._progress_for(obj.topic_id)
        if progress is not None and progress.is_unlocked:
            return False

        return obj.order > obj.topic.free_page_count

    def _progress_for(self, topic_id):
        """
        Look up the requesting user's TopicProgress for this topic.
        Prefers the preloaded dict on context to avoid N+1 queries on
        the detail endpoint, which serializes every page.
        """
        preloaded = self.context.get("progress_by_topic")
        if preloaded is not None:
            return preloaded.get(topic_id)

        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return None
        return TopicProgress.objects.filter(user=user, topic_id=topic_id).first()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get("is_locked"):
            data["content"] = {}
        return data


class TopicPageWriteSerializer(serializers.ModelSerializer):
    """
    Write-only serializer for creating and updating pages.
    No is_locked field: it applies only to read responses.
    """

    class Meta:
        model = TopicPage
        fields = ["order", "page_type", "content"]


class TopicProgressSerializer(serializers.ModelSerializer):
    """
    Read serializer for a user's progress on a Topic.
    """

    class Meta:
        model = TopicProgress
        fields = [
            "last_page_index",
            "is_unlocked",
            "is_completed",
            "last_visited_at",
            "completed_at",
        ]
        read_only_fields = fields


class _ProgressMixin:
    """
    Shared helper to attach a per-user progress object to a serialized
    Topic. Returns None when there is no progress, or when the viewer
    is the topic's creator.
    """

    def _get_progress(self, topic):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return None
        if topic.created_by_id == user.id:
            return None

        preloaded = self.context.get("progress_by_topic")
        if preloaded is not None:
            progress = preloaded.get(topic.id)
        else:
            progress = TopicProgress.objects.filter(user=user, topic=topic).first()

        if progress is None:
            return None
        return TopicProgressSerializer(progress).data


class _TopicProgressFieldMixin(_ProgressMixin):
    def get_progress(self, obj):
        return self._get_progress(obj)


class TopicListSerializer(_TopicProgressFieldMixin, serializers.ModelSerializer):
    subject = SubjectSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    page_count = serializers.IntegerField(source="pages.count", read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Topic
        fields = [
            "id",
            "subject",
            "created_by",
            "title",
            "description",
            "is_published",
            "free_page_count",
            "page_count",
            "progress",
            "created_at",
        ]


class TopicDetailSerializer(_TopicProgressFieldMixin, serializers.ModelSerializer):
    subject = SubjectSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    pages = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Topic
        fields = [
            "id",
            "subject",
            "created_by",
            "title",
            "description",
            "is_published",
            "free_page_count",
            "pages",
            "progress",
            "created_at",
        ]

    def get_pages(self, obj):
        # Pass context down to the page serializer so its is_locked method
        # can see progress_by_topic.
        return TopicPageSerializer(
            obj.pages.all(),
            many=True,
            context=self.context,
        ).data


class TopicCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ["subject", "title", "description", "is_published", "free_page_count"]


class TopicProgressWriteSerializer(serializers.Serializer):
    """
    Input serializer for POST /api/topics/{id}/progress/.

    last_page_index is validated against the topic's page count in the
    view, not here, because the serializer has no access to the topic.

    reset: when true, the write is unconditional (used by "Start from
    beginning"). When false or omitted, the write is monotonic: the
    server keeps the highest value of last_page_index it has seen.
    """

    last_page_index = serializers.IntegerField(min_value=0)
    reset = serializers.BooleanField(default=False)