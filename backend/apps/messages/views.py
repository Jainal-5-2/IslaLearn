from django.db import models
from rest_framework import generics, permissions, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Message, Thread
from .parties import thread_is_open, thread_parties
from .serializers import (
    MessageCreateSerializer,
    MessageSerializer,
    ThreadListSerializer,
)


class ThreadListView(generics.ListAPIView):
    """
    GET /api/threads/

    The requesting user's threads, newest first. Only threads where the
    user is a party. Annotates each row with its latest message in the
    serializer context so the serializer does not fire one query per
    row.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ThreadListSerializer

    def get_queryset(self):
        user = self.request.user

        return (
            Thread.objects.select_related("request__subject", "request__tutee")
            .filter(
                models.Q(request__tutee=user)
                | models.Q(
                    request__applications__tutor=user,
                    request__applications__status="accepted",
                )
            )
            .distinct()
            .order_by("-created_at")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        user = self.request.user
        if self.request.method == "GET" and user.is_authenticated:
            # One query for all last-messages on the page, not one per
            # row. Subquery per thread would be N+1; this is not.
            thread_ids = list(self.get_queryset().values_list("id", flat=True))
            if not thread_ids:
                context["last_message_by_thread"] = {}
                return context
            last_messages = (
                Message.objects.filter(thread_id__in=thread_ids)
                .select_related("sender")
                .order_by("thread_id", "-created_at")
            )
            seen: dict[int, Message] = {}
            for msg in last_messages:
                if msg.thread_id not in seen:
                    seen[msg.thread_id] = msg
            context["last_message_by_thread"] = seen
        return context


class MessageListCreateView(APIView):
    """
    GET /api/threads/{id}/messages/     (list, oldest first)
    POST /api/threads/{id}/messages/    (create; 400 if thread is closed)
    """

    permission_classes = [permissions.IsAuthenticated]

    def _get_thread(self, request, pk):
        try:
            thread = Thread.objects.select_related(
                "request__subject", "request__tutee"
            ).get(pk=pk)
        except Thread.DoesNotExist:
            raise NotFound("Thread not found.")

        parties = thread_parties(thread)
        if request.user not in parties:
            raise PermissionDenied("You are not a party to this thread.")
        return thread

    def get(self, request, pk):
        thread = self._get_thread(request, pk)
        messages = thread.messages.select_related("sender").order_by("created_at")
        return Response(MessageSerializer(messages, many=True).data)

    def post(self, request, pk):
        thread = self._get_thread(request, pk)

        if not thread_is_open(thread):
            raise ValidationError(
                "This thread is closed. You cannot send new messages."
            )

        serializer = MessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = serializer.save(thread=thread, sender=request.user)

        return Response(
            MessageSerializer(message).data,
            status=status.HTTP_201_CREATED,
        )