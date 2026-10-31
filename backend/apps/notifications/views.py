from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


def _base_queryset(user):
    """
    The requesting user's notifications, newest first, with everything
    the serializer reads pre-fetched.

    target_request.thread is a reverse OneToOne, so select_related
    works. target_request.sessions and target_broadcast.sessions are
    reverse FKs, so they need prefetch_related. Without these, a page
    of session_completed and message_received rows is 40+ queries.
    """
    return (
        Notification.objects.filter(recipient=user)
        .select_related(
            "actor",
            "target_user",
            "target_topic",
            "target_broadcast",
            "target_request",
            "target_request__subject",
            "target_request__thread",
            "target_review",
        )
        .prefetch_related(
            "target_request__sessions",
            "target_broadcast__sessions",
        )
    )


class NotificationListView(generics.ListAPIView):
    """
    GET /api/notifications/

    Paginated, newest first. `unread_count` is a top-level field on the
    response envelope, alongside count/next/previous/results, and it is
    correct on every page, not just page 1.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return _base_queryset(self.request.user)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data["unread_count"] = self._unread_count(request.user)
            return response

        serializer = self.get_serializer(queryset, many=True)
        return Response(
            {
                "count": len(serializer.data),
                "next": None,
                "previous": None,
                "results": serializer.data,
                "unread_count": self._unread_count(request.user),
            }
        )

    def _unread_count(self, user):
        return Notification.objects.filter(
            recipient=user, read_at__isnull=True
        ).count()


class NotificationMarkReadView(APIView):
    """
    POST /api/notifications/{id}/read/

    Marks one notification read. Idempotent: an already-read row returns
    200 with the same body. Scoped to the requesting user's own rows, so
    someone else's id is a 404, not a 403. A 403 would confirm the id
    exists.

    Uses _base_queryset so the prefetch list lives in one place. The
    extra prefetch query on a single-row endpoint is negligible
    compared to the cost of the two field lists drifting.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            notification = _base_queryset(request.user).get(
                pk=pk, recipient=request.user
            )
        except Notification.DoesNotExist:
            return Response(
                {"detail": "Notification not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])

        return Response(NotificationSerializer(notification).data)


class NotificationReadAllView(APIView):
    """
    POST /api/notifications/read-all/

    Marks every unread notification for the requesting user as read in a
    single UPDATE. Returns the number updated and the new unread count
    (always 0), so the frontend can update its badge without a second
    GET.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        updated = Notification.objects.filter(
            recipient=request.user, read_at__isnull=True
        ).update(read_at=timezone.now())
        return Response({"updated": updated, "unread_count": 0})