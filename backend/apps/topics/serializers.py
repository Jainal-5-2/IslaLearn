from rest_framework import serializers
from .models import Subject, Topic, TopicPage
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
            
        return obj.order > obj.topic.free_page_count

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # If the page is locked, completely strip the content from the response
        # so it cannot be read via the Network tab.
        if data.get("is_locked"):
            data["content"] = {}
        return data


class TopicListSerializer(serializers.ModelSerializer):
    subject = SubjectSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    page_count = serializers.IntegerField(source="pages.count", read_only=True)

    class Meta:
        model = Topic
        fields = [
            "id", "subject", "created_by", "title", "description",
            "is_published", "free_page_count", "page_count", "created_at"
        ]


class TopicDetailSerializer(serializers.ModelSerializer):
    subject = SubjectSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    pages = TopicPageSerializer(many=True, read_only=True)

    class Meta:
        model = Topic
        fields = [
            "id", "subject", "created_by", "title", "description",
            "is_published", "free_page_count", "pages", "created_at"
        ]


class TopicCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ["subject", "title", "description", "is_published", "free_page_count"]


class TopicPageCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TopicPage
        fields = ["order", "page_type", "content"]