from django.urls import path

from .views import MessageListCreateView, ThreadListView

urlpatterns = [
    path("threads/", ThreadListView.as_view(), name="thread-list"),
    path(
        "threads/<int:pk>/messages/",
        MessageListCreateView.as_view(),
        name="thread-messages",
    ),
]