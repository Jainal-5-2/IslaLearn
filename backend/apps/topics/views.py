from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from .models import Subject, Topic, TopicPage
from .serializers import (
    SubjectSerializer,
    TopicListSerializer,
    TopicDetailSerializer,
    TopicCreateUpdateSerializer,
    TopicPageCreateUpdateSerializer,
)


class SubjectListView(generics.ListAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None  # Subjects are a small list, return all


class TopicListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = Topic.objects.select_related("subject", "created_by").prefetch_related("pages")
        
        # Filter by subject ID if provided (e.g., /api/topics/?subject=1)
        subject_id = self.request.query_params.get("subject")
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
            
        # Regular users only see published topics, creators see their own drafts
        if self.request.user.is_authenticated:
            from django.db.models import Q
            queryset = queryset.filter(Q(is_published=True) | Q(created_by=self.request.user))
        else:
            queryset = queryset.filter(is_published=True)
            
        return queryset

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TopicCreateUpdateSerializer
        return TopicListSerializer

    def perform_create(self, serializer):
        # The creator is automatically set to the logged-in user
        serializer.save(created_by=self.request.user)


class TopicDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Topic.objects.select_related("subject", "created_by").prefetch_related("pages")
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return TopicCreateUpdateSerializer
        return TopicDetailSerializer

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        # Only the creator can edit or delete
        if request.method in ["PUT", "PATCH", "DELETE"]:
            if obj.created_by != request.user:
                raise PermissionDenied("You do not have permission to modify this topic.")


class TopicPageListCreateView(generics.ListCreateAPIView):
    serializer_class = TopicPageCreateUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_topic(self):
        # Helper to ensure the topic exists and belongs to the user for POST
        topic_id = self.kwargs.get("topic_id")
        try:
            topic = Topic.objects.get(id=topic_id)
        except Topic.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound("Topic not found.")
            
        if self.request.method == "POST" and topic.created_by != self.request.user:
            raise PermissionDenied("You can only add pages to your own topics.")
        return topic

    def get_queryset(self):
        topic = self.get_topic()
        return TopicPage.objects.filter(topic=topic)

    def perform_create(self, serializer):
        topic = self.get_topic()
        # If an order isn't provided, put it at the end
        order = self.request.data.get("order")
        if not order:
            last_page = topic.pages.order_by("-order").first()
            next_order = (last_page.order + 1) if last_page else 1
            serializer.save(topic=topic, order=next_order)
        else:
            serializer.save(topic=topic)


class TopicPageDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TopicPageCreateUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return TopicPage.objects.filter(topic_id=self.kwargs.get("topic_id"))

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        # Only the topic creator can edit/delete pages
        if request.method in ["PUT", "PATCH", "DELETE"]:
            if obj.topic.created_by != request.user:
                raise PermissionDenied("You do not have permission to modify this page.")