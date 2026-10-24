from django.urls import path

from .views import UserDetailView

urlpatterns = [
    path("users/<int:pk>/", UserDetailView.as_view(), name="user-detail"),
]