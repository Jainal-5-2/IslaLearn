from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from . import whereby
from .models import Broadcast, BroadcastParticipant
from .serializers import (
    BroadcastCreateSerializer,
    BroadcastDetailSerializer,
    BroadcastListSerializer,
)


def _visible_broadcasts():
    return (
        Broadcast.objects.filter(is_cancelled=False)
        .annotate(_participant_count=Count("participants"))
        .select_related("tutor", "subject")
    )


class BroadcastListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = _visible_broadcasts()

        # Browse shows upcoming by default. `?past=true` flips to past.
        if self.request.query_params.get("past") == "true":
            queryset = queryset.filter(scheduled_at__lt=timezone.now())
        else:
            queryset = queryset.filter(scheduled_at__gte=timezone.now())

        subject_id = self.request.query_params.get("subject")
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)

        tutor_id = self.request.query_params.get("tutor")
        if tutor_id:
            queryset = queryset.filter(tutor_id=tutor_id)

        return queryset.order_by("scheduled_at")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return BroadcastCreateSerializer
        return BroadcastListSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        user = self.request.user
        if self.request.method == "GET" and user.is_authenticated:
            context["my_participations"] = set(
                BroadcastParticipant.objects.filter(
                    user=user
                ).values_list("broadcast_id", flat=True)
            )
        return context

    def create(self, request, *args, **kwargs):
        write_serializer = self.get_serializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            broadcast = write_serializer.save(tutor=request.user)
            try:
                room_url = whereby.create_room(broadcast)
            except whereby.WherebyError as exc:
                raise ValidationError({"detail": str(exc)})
            broadcast.room_url = room_url
            broadcast.save(update_fields=["room_url"])

        read_serializer = BroadcastDetailSerializer(
            broadcast, context=self.get_serializer_context()
        )
        headers = self.get_success_headers(read_serializer.data)
        return Response(
            read_serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )


class BroadcastDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return _visible_broadcasts().prefetch_related("participants__user")

    def get_serializer_class(self):
        return BroadcastDetailSerializer


class BroadcastCancelView(APIView):
    """
    POST /api/broadcasts/{id}/cancel/

    Tutor-only. Sets is_cancelled=True. Does not delete the row or the
    Whereby room; the room expires on its own endDate. Participants keep
    their rows so the detail page can still explain why they can't join.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            broadcast = Broadcast.objects.select_related("tutor").get(pk=pk)
        except Broadcast.DoesNotExist:
            raise NotFound("Broadcast not found.")

        if broadcast.tutor_id != request.user.id:
            raise PermissionDenied("Only the tutor can cancel this broadcast.")
        if broadcast.completed_at is not None:
            raise ValidationError("This broadcast has already ended.")
        if broadcast.is_cancelled:
            raise ValidationError("This broadcast is already cancelled.")

        broadcast.is_cancelled = True
        broadcast.save(update_fields=["is_cancelled"])

        serializer = BroadcastDetailSerializer(
            broadcast, context={"request": request}
        )
        return Response(serializer.data)


class BroadcastJoinView(APIView):
    """
    POST /api/broadcasts/{id}/join/

    Tutee joins. Tutor cannot join their own broadcast as a participant.
    Idempotent: joining twice returns 200 with the same participant row.
    Capacity check uses select_for_update so two simultaneous joins
    cannot both pass the same free slot.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        with transaction.atomic():
            try:
                broadcast = (
                    Broadcast.objects.select_for_update()
                    .select_related("tutor", "subject")
                    .get(pk=pk)
                )
            except Broadcast.DoesNotExist:
                raise NotFound("Broadcast not found.")

            if broadcast.is_cancelled:
                raise ValidationError("This broadcast has been cancelled.")
            if broadcast.completed_at is not None:
                raise ValidationError("This broadcast has already ended.")
            if broadcast.tutor_id == request.user.id:
                raise ValidationError(
                    "You are the tutor. You do not need to join."
                )

            existing = BroadcastParticipant.objects.filter(
                broadcast=broadcast, user=request.user
            ).first()
            if existing is not None:
                serializer = BroadcastDetailSerializer(
                    broadcast, context={"request": request}
                )
                return Response(serializer.data, status=status.HTTP_200_OK)

            if broadcast.participants.count() >= broadcast.capacity:
                raise ValidationError("This broadcast is full.")

            BroadcastParticipant.objects.create(
                broadcast=broadcast, user=request.user
            )

        # Re-fetch so participant_count reflects the new row.
        broadcast.refresh_from_db()
        serializer = BroadcastDetailSerializer(
            broadcast, context={"request": request}
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class BroadcastLeaveView(APIView):
    """
    DELETE /api/broadcasts/{id}/leave/

    Idempotent. Leaving when not joined returns 204 with no error.
    """

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        try:
            broadcast = Broadcast.objects.get(pk=pk)
        except Broadcast.DoesNotExist:
            raise NotFound("Broadcast not found.")

        BroadcastParticipant.objects.filter(
            broadcast=broadcast, user=request.user
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BroadcastRoomUrlView(APIView):
    """
    GET /api/broadcasts/{id}/room-url/

    Returns {"room_url": "..."} to the tutor or a joined participant.
    Anyone else gets 403. The URL is the access grant, so this check is
    the only gate. Do not move this check into the serializer.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            broadcast = Broadcast.objects.select_related("tutor").get(pk=pk)
        except Broadcast.DoesNotExist:
            raise NotFound("Broadcast not found.")

        if broadcast.is_cancelled:
            raise ValidationError("This broadcast has been cancelled.")
        if broadcast.completed_at is not None:
            raise ValidationError("This broadcast has already ended.")
        if not broadcast.room_url:
            raise ValidationError("This broadcast has no room yet.")

        is_tutor = broadcast.tutor_id == request.user.id
        is_participant = BroadcastParticipant.objects.filter(
            broadcast=broadcast, user=request.user
        ).exists()
        if not (is_tutor or is_participant):
            raise PermissionDenied(
                "Only the tutor and joined participants can enter this room."
            )

        return Response({"room_url": broadcast.room_url})