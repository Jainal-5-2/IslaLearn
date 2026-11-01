from rest_framework import generics, permissions
from rest_framework.response import Response

from .models import User
from .serializers import (
    PublicUserSerializer,
    RegisterSerializer,
    UserSerializer,
    UserUpdateSerializer,
)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/auth/me/  -> the requesting user's full profile.
    PATCH /api/auth/me/  -> update bio and/or profile_picture.

    PATCH only. PUT would replace the whole object and null out fields
    the client did not send, which is not what a settings form wants.
    The write serializer allows only bio and profile_picture; see
    UserUpdateSerializer. The response is the read shape so the
    frontend can set state without a refetch.
    """

    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return UserUpdateSerializer
        return UserSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        read_serializer = UserSerializer(
            instance, context=self.get_serializer_context()
        )
        return Response(read_serializer.data)


class UserDetailView(generics.RetrieveAPIView):
    """
    GET /api/users/{id}/

    Public profile header data. No email; see PublicUserSerializer.
    """

    queryset = User.objects.all()
    serializer_class = PublicUserSerializer
    permission_classes = [permissions.AllowAny]