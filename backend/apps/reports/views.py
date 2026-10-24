from rest_framework import generics, permissions, status
from rest_framework.response import Response

from .models import Report
from .serializers import ReportCreateSerializer, ReportSerializer


class ReportCreateView(generics.CreateAPIView):
    """
    POST /api/reports/

    Any authenticated user can file one report per submission. There
    is no list or detail endpoint for regular users; reports are read
    in /admin/ only. The target and self-report checks live in
    ReportCreateSerializer.validate, not here.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReportCreateSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = serializer.save()
        return Response(
            ReportSerializer(report).data,
            status=status.HTTP_201_CREATED,
        )