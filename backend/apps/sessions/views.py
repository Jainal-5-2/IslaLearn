from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.broadcasts.models import Broadcast
from apps.requests.models import Application, Request

from .models import Review, Session
from .serializers import (
    ReviewCreateSerializer,
    ReviewSerializer,
    SessionSerializer,
)
from .parties import session_participants


class RequestCompleteView(APIView):
    """
    POST /api/requests/{id}/complete/

    The accepted tutor marks a 1:1 request complete. Creates a Session
    row (session_type="one_on_one"). Idempotent: calling twice returns
    the existing session with 200 instead of creating a second.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            tutoring_request = Request.objects.select_related(
                "tutee", "subject"
            ).get(pk=pk)
        except Request.DoesNotExist:
            raise NotFound("Request not found.")

        accepted = (
            Application.objects.filter(request=tutoring_request, status="accepted")
            .select_related("tutor")
            .first()
        )
        if accepted is None:
            raise ValidationError("This request has no accepted tutor.")
        if accepted.tutor_id != request.user.id:
            raise PermissionDenied(
                "Only the accepted tutor can mark this request complete."
            )

        with transaction.atomic():
            # select_for_update on the Request row so two simultaneous
            # complete calls cannot both create a Session.
            tutoring_request = Request.objects.select_for_update().get(pk=pk)
            existing = Session.objects.filter(
                session_type="one_on_one", request=tutoring_request
            ).first()
            if existing is not None:
                serializer = SessionSerializer(
                    existing, context={"request": request}
                )
                return Response(serializer.data, status=status.HTTP_200_OK)

            session = Session.objects.create(
                session_type="one_on_one",
                request=tutoring_request,
                completed_at=timezone.now(),
                marked_by=request.user,
            )

        serializer = SessionSerializer(session, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BroadcastCompleteView(APIView):
    """
    POST /api/broadcasts/{id}/complete/

    The broadcasting tutor marks a broadcast complete. Creates a
    Session row (session_type="broadcast"). Idempotent.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            broadcast = Broadcast.objects.select_related("tutor").get(pk=pk)
        except Broadcast.DoesNotExist:
            raise NotFound("Broadcast not found.")

        if broadcast.tutor_id != request.user.id:
            raise PermissionDenied(
                "Only the tutor can mark this broadcast complete."
            )
        if broadcast.is_cancelled:
            raise ValidationError(
                "A cancelled broadcast cannot be marked complete."
            )

        with transaction.atomic():
            broadcast = Broadcast.objects.select_for_update().get(pk=pk)
            existing = Session.objects.filter(
                session_type="broadcast", broadcast=broadcast
            ).first()
            if existing is not None:
                serializer = SessionSerializer(
                    existing, context={"request": request}
                )
                return Response(serializer.data, status=status.HTTP_200_OK)

            session = Session.objects.create(
                session_type="broadcast",
                broadcast=broadcast,
                completed_at=timezone.now(),
                marked_by=request.user,
            )

        serializer = SessionSerializer(session, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SessionReviewCreateView(APIView):
    """
    POST /api/sessions/{id}/reviews/

    Any participant of a completed session can leave one review of
    another participant. The permission checks live in
    ReviewCreateSerializer.validate; this view only handles the
    request plumbing.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            session = Session.objects.get(pk=pk)
        except Session.DoesNotExist:
            raise NotFound("Session not found.")

        serializer = ReviewCreateSerializer(
            data=request.data,
            context={"request": request, "session": session},
        )
        serializer.is_valid(raise_exception=True)
        review = serializer.save(session=session, reviewer=request.user)

        return Response(
            ReviewSerializer(review).data, status=status.HTTP_201_CREATED
        )


class UserReviewsView(APIView):
    """
    GET /api/users/{id}/reviews/

    Public. Returns reviews received by that user, newest first, with
    a small aggregate (count and average rating).
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            target = User.objects.get(pk=pk)
        except User.DoesNotExist:
            raise NotFound("User not found.")

        reviews = (
            Review.objects.filter(reviewee=target)
            .select_related("reviewer", "reviewee")
            .order_by("-created_at")
        )
        serializer = ReviewSerializer(reviews, many=True)

        total = reviews.count()
        average = (
            sum(r.rating for r in reviews) / total if total else None
        )
        return Response(
            {
                "reviews": serializer.data,
                "count": total,
                "average_rating": average,
            }
        )