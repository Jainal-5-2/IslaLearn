from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.views import APIView

from .models import Subject, Topic, TopicPage, TopicProgress
from .serializers import (
    SubjectSerializer,
    TopicListSerializer,
    TopicDetailSerializer,
    TopicCreateUpdateSerializer,
    TopicPageSerializer,
    TopicPageWriteSerializer,
    TopicProgressSerializer,
    TopicProgressWriteSerializer,
)


class SubjectListView(generics.ListAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None


def _progress_map_for(user, topics):
    if user is None or not user.is_authenticated:
        return {}
    topic_ids = [t.id for t in topics]
    if not topic_ids:
        return {}
    return {
        p.topic_id: p
        for p in TopicProgress.objects.filter(user=user, topic_id__in=topic_ids)
    }


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

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.request.method == "GET":
            topics = list(self.get_queryset())
            context["progress_by_topic"] = _progress_map_for(self.request.user, topics)
        return context

    def create(self, request, *args, **kwargs):
        write_serializer = self.get_serializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        topic = write_serializer.save(created_by=request.user)

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

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.request.method == "GET":
            topic = self.get_object()
            context["progress_by_topic"] = _progress_map_for(self.request.user, [topic])
        return context

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
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

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.request.method == "GET":
            topic = self.get_topic()
            context["progress_by_topic"] = _progress_map_for(
                self.request.user, [topic]
            )
        return context

    def get_queryset(self):
        topic = self.get_topic()
        return TopicPage.objects.filter(topic=topic)

    def perform_create(self, serializer):
        topic = self.get_topic()
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

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.request.method == "GET":
            topic_id = self.kwargs.get("topic_id")
            try:
                topic = Topic.objects.get(id=topic_id)
            except Topic.DoesNotExist:
                raise NotFound("Topic not found.")
            context["progress_by_topic"] = _progress_map_for(
                self.request.user, [topic]
            )
        return context

    def get_queryset(self):
        return TopicPage.objects.filter(topic_id=self.kwargs.get("topic_id"))

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method in ["PUT", "PATCH", "DELETE"]:
            if obj.topic.created_by != request.user:
                raise PermissionDenied(
                    "You do not have permission to modify this page."
                )


class TopicProgressView(APIView):
    """
    POST /api/topics/{id}/progress/

    Request body:
        { "last_page_index": int, "reset": bool = false }

    - Clamps last_page_index into the topic's page range.
    - When reset=false (default):
        * last_page_index is monotonic (max of stored and incoming).
        * last_page_index may not jump more than one page beyond the
          currently stored value. This prevents a client from skipping
          pages via the API. A user at page 1 cannot POST page 5; they
          must POST page 2 first.
    - When reset=true, last_page_index is assigned unconditionally.
    - is_completed flips True once last_page_index reaches the last page,
      and completed_at records the timestamp of that flip.
    - Rejects calls from the topic's own creator.
    - Rejects calls on unpublished topics.
    - Does not touch is_unlocked. Paywall and progress are separate.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            topic = Topic.objects.prefetch_related("pages").get(pk=pk)
        except Topic.DoesNotExist:
            raise NotFound("Topic not found.")

        if topic.created_by_id == request.user.id:
            raise ValidationError(
                "Topic creators do not track progress on their own topics."
            )

        if not topic.is_published:
            raise PermissionDenied("You cannot read this topic.")

        write_serializer = TopicProgressWriteSerializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        incoming_index = write_serializer.validated_data["last_page_index"]
        reset = write_serializer.validated_data["reset"]

        page_count = topic.pages.count()
        if page_count == 0:
            raise ValidationError("This topic has no pages yet.")

        incoming_index = min(incoming_index, page_count - 1)

        progress, _ = TopicProgress.objects.get_or_create(
            user=request.user, topic=topic
        )

        if reset:
            progress.last_page_index = incoming_index
        else:
            if incoming_index > progress.last_page_index + 1:
                raise ValidationError(
                    {
                        "last_page_index": (
                            "Progress cannot jump more than one page at a time."
                        )
                    }
                )
            progress.last_page_index = max(progress.last_page_index, incoming_index)

        was_completed = progress.is_completed
        is_now_complete = progress.last_page_index >= page_count - 1

        progress.is_completed = is_now_complete

        if is_now_complete and not was_completed:
            progress.completed_at = timezone.now()
        elif not is_now_complete:
            progress.completed_at = None

        progress.save(
            update_fields=[
                "last_page_index",
                "is_completed",
                "last_visited_at",
                "completed_at",
            ]
        )

        return Response(TopicProgressSerializer(progress).data)


class TopicUnlockView(APIView):
    """
    POST /api/topics/{id}/unlock/

    Sets TopicProgress.is_unlocked to True for the requesting user.
    Idempotent. Rejects the topic's creator and unpublished topics.
    Does not touch last_page_index, is_completed, or completed_at.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            topic = Topic.objects.get(pk=pk)
        except Topic.DoesNotExist:
            raise NotFound("Topic not found.")

        if topic.created_by_id == request.user.id:
            raise ValidationError(
                "Topic creators cannot unlock their own topics."
            )

        if not topic.is_published:
            raise PermissionDenied("You cannot unlock this topic.")

        progress, _ = TopicProgress.objects.get_or_create(
            user=request.user, topic=topic
        )
        if not progress.is_unlocked:
            progress.is_unlocked = True
            progress.save(update_fields=["is_unlocked", "last_visited_at"])

        return Response(TopicProgressSerializer(progress).data)