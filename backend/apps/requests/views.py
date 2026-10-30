from django.db import models, transaction
from django.db.models import Exists, OuterRef
from rest_framework import generics, permissions, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.messages.models import Thread
from apps.sessions.models import Session

from .models import Application, Request
from .serializers import (
    ApplicationCreateSerializer,
    ApplicationSerializer,
    RequestCreateSerializer,
    RequestDetailSerializer,
    RequestListSerializer,
    RequestUpdateSerializer,
)


class RequestListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Request.objects.select_related("tutee", "subject").prefetch_related(
            "applications"
        )

        status_filter = self.request.query_params.get("status", "open")
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        subject_id = self.request.query_params.get("subject")
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)

        if self.request.query_params.get("mine") == "true":
            queryset = queryset.filter(tutee=self.request.user)
        elif self.request.method == "GET" and status_filter == "open":
            queryset = queryset.exclude(tutee=self.request.user)

        # ?accepted=true returns accepted-but-not-yet-completed requests
        # where the user is either the tutee or the accepted tutor. This
        # is the /sessions Active tab's data source.
        #
        # Three conditions must hold for a request to be "active":
        #
        # 1. It has an accepted application. Request.status == "closed"
        #    alone is not enough: RequestCloseView also sets
        #    status="closed" when the tutee manually closes an open
        #    request, and that path leaves no accepted application. So
        #    both the tutee branch and the tutor branch require
        #    applications__status == "accepted".
        #
        # 2. It has no one_on_one Session row. Once the tutee marks the
        #    request complete, a Session row exists and the request
        #    belongs only in the Completed tab. Without this exclusion,
        #    a completed request appears in both Active and Completed.
        #
        # 3. The user is a party to it: either the tutee, or the tutor
        #    whose application was accepted. Non-parties must not see it.
        #
        # The tutor and status conditions MUST live in the same Q so
        # they constrain the same joined Application row; splitting them
        # into separate .filter() calls creates two independent joins
        # and lets a rejected application satisfy the tutor condition
        # while a different accepted application satisfies the status
        # condition.
        if self.request.query_params.get("accepted") == "true":
            queryset = queryset.filter(status="closed").filter(
                models.Q(
                    tutee=self.request.user,
                    applications__status="accepted",
                )
                | models.Q(
                    applications__tutor=self.request.user,
                    applications__status="accepted",
                )
            ).distinct()

            queryset = queryset.annotate(
                _has_one_on_one_session=Exists(
                    Session.objects.filter(
                        request=OuterRef("pk"),
                        session_type="one_on_one",
                    )
                )
            ).filter(_has_one_on_one_session=False)

        return queryset

    def get_serializer_class(self):
        if self.request.method == "POST":
            return RequestCreateSerializer
        return RequestListSerializer

    def create(self, request, *args, **kwargs):
        write_serializer = self.get_serializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        req = write_serializer.save(tutee=request.user)

        read_serializer = RequestDetailSerializer(
            req, context=self.get_serializer_context()
        )
        headers = self.get_success_headers(read_serializer.data)
        return Response(
            read_serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )

class RequestDetailView(generics.RetrieveUpdateAPIView):
    queryset = Request.objects.select_related("tutee", "subject").prefetch_related(
        "applications__tutor"
    )
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return RequestUpdateSerializer
        return RequestDetailSerializer

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method == "PATCH":
            if obj.tutee != request.user:
                raise PermissionDenied("Only the request owner can edit this request.")
            if obj.status != "open":
                raise ValidationError(
                    "This request is closed and can no longer be edited."
                )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        new_subject_id = request.data.get("subject")
        if new_subject_id is not None:
            try:
                new_subject_id = int(new_subject_id)
            except (TypeError, ValueError):
                raise ValidationError({"subject": "Invalid subject id."})

            if new_subject_id != instance.subject_id and instance.applications.exists():
                raise ValidationError(
                    {
                        "subject": (
                            "Subject can no longer be changed. Tutors have "
                            "already applied. Close and repost to change it."
                        )
                    }
                )

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if getattr(instance, "_prefetched_objects_cache", None):
            instance._prefetched_objects_cache = {}

        read_serializer = RequestDetailSerializer(
            instance, context=self.get_serializer_context()
        )
        return Response(read_serializer.data)


class RequestCloseView(APIView):
    """
    POST /api/requests/{id}/close/

    Owner-only. Transitions an open request to closed.
    Any pending applications are marked rejected so no tutor is left
    hanging on a request that can no longer accept an accepted applicant.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        with transaction.atomic():
            try:
                req = (
                    Request.objects.select_for_update()
                    .select_related("tutee", "subject")
                    .prefetch_related("applications__tutor")
                    .get(pk=pk)
                )
            except Request.DoesNotExist:
                raise NotFound("Request not found.")

            if req.tutee != request.user:
                raise PermissionDenied("Only the request owner can close it.")
            if req.status != "open":
                raise ValidationError("This request is already closed.")
            if req.applications.filter(status="accepted").exists():
                # Defensive guard: normally accepting closes the request,
                # but protect against manual state drift.
                raise ValidationError(
                    "This request already has an accepted tutor and is closed."
                )

            req.status = "closed"
            req.save(update_fields=["status"])
            req.applications.filter(status="pending").update(status="rejected")

        # Return the full detail shape so the client can re-sync in one call.
        serializer = RequestDetailSerializer(req, context={"request": request})
        return Response(serializer.data)


class RequestApplyView(generics.CreateAPIView):
    serializer_class = ApplicationCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        request_obj = self.get_request()

        if request_obj.tutee == self.request.user:
            raise ValidationError("You cannot apply to your own request.")
        if request_obj.status != "open":
            raise ValidationError("This request is no longer open.")
        if Application.objects.filter(
            request=request_obj, tutor=self.request.user
        ).exists():
            raise ValidationError("You have already applied to this request.")

        serializer.save(request=request_obj, tutor=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            ApplicationSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED,
        )

    def get_request(self):
        try:
            return Request.objects.get(id=self.kwargs["pk"])
        except Request.DoesNotExist:
            raise NotFound("Request not found.")


class ApplicationDecisionView(generics.UpdateAPIView):
    queryset = Application.objects.select_related("request", "tutor")
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["patch"]

    def update(self, request, *args, **kwargs):
        new_status = request.data.get("status")
        if new_status not in ("accepted", "rejected"):
            raise ValidationError({"status": "Must be 'accepted' or 'rejected'."})

        with transaction.atomic():
            # Lock the application row so two concurrent decisions cannot
            # both pass the "pending" check.
            try:
                application = (
                    Application.objects.select_for_update()
                    .select_related("request")
                    .get(pk=kwargs["pk"])
                )
            except Application.DoesNotExist:
                raise NotFound("Application not found.")

            req = application.request

            if req.tutee != request.user:
                raise PermissionDenied("Only the request owner can decide.")

            if application.status != "pending":
                raise ValidationError("This application has already been decided.")

            application.status = new_status
            application.save(update_fields=["status"])

            if new_status == "accepted":
                # Reject any remaining pending applications and close
                # the request, all under the same lock.
                Application.objects.filter(request=req, status="pending").exclude(
                    pk=application.pk
                ).update(status="rejected")
                req.status = "closed"
                req.save(update_fields=["status"])
                Thread.objects.get_or_create(request=req)

        return Response(ApplicationSerializer(application).data)