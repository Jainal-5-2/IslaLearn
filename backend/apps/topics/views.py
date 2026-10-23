from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, PermissionDenied

from .models import Subject, Topic, TopicPage
from .serializers import (
    SubjectSerializer,
    TopicListSerializer,
    TopicDetailSerializer,
    TopicCreateUpdateSerializer,
    TopicPageSerializer,
    TopicPageWriteSerializer,
)


class SubjectListView(generics.ListAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None  # Subjects are a small list, return all


class TopicListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = Topic.objects.select_related(
            "subject", "created_by"
        ).prefetch_related("pages")

        subject_id = self.request.query_params.get("subject")
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)

        if self.request.user.is_authenticated:
            from django.db.models import Q

            queryset = queryset.filter(
                Q(is_published=True) | Q(created_by=self.request.user)
            )
        else:
            queryset = queryset.filter(is_published=True)

        return queryset

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TopicCreateUpdateSerializer
        return TopicListSerializer

    def create(self, request, *args, **kwargs):
        # Validate and save with the write serializer
        write_serializer = self.get_serializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        topic = write_serializer.save(created_by=request.user)

        # Return the full detail representation (includes id, subject,
        # created_by, pages, etc.)
        read_serializer = TopicDetailSerializer(
            topic, context=self.get_serializer_context()
        )
        headers = self.get_success_headers(read_serializer.data)
        return Response(
            read_serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )


class TopicDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Topic.objects.select_related("subject", "created_by").prefetch_related(
        "pages"
    )
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return TopicCreateUpdateSerializer
        return TopicDetailSerializer

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        # Only the creator can edit or delete.
        if request.method in ["PUT", "PATCH", "DELETE"]:
            if obj.created_by != request.user:
                raise PermissionDenied(
                    "You do not have permission to modify this topic."
                )


class TopicPageListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_topic(self):
        topic_id = self.kwargs.get("topic_id")
        try:
            topic = Topic.objects.get(id=topic_id)
        except Topic.DoesNotExist:
            raise NotFound("Topic not found.")

        if self.request.method == "POST" and topic.created_by != self.request.user:
            raise PermissionDenied("You can only add pages to your own topics.")
        return topic

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TopicPageWriteSerializer
        return TopicPageSerializer

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
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return TopicPageWriteSerializer
        return TopicPageSerializer

    def get_queryset(self):
        return TopicPage.objects.filter(topic_id=self.kwargs.get("topic_id"))

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        # Only the topic creator can edit or delete pages.
        if request.method in ["PUT", "PATCH", "DELETE"]:
            if obj.topic.created_by != request.user:
                raise PermissionDenied(
                    "You do not have permission to modify this page."
                )