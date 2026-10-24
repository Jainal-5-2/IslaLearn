from django.urls import path

from .views import (
    BroadcastCancelView,
    BroadcastDetailView,
    BroadcastJoinView,
    BroadcastLeaveView,
    BroadcastListCreateView,
    BroadcastRoomUrlView,
)

urlpatterns = [
    path("broadcasts/", BroadcastListCreateView.as_view(), name="broadcast-list"),
    path(
        "broadcasts/<int:pk>/",
        BroadcastDetailView.as_view(),
        name="broadcast-detail",
    ),
    path(
        "broadcasts/<int:pk>/cancel/",
        BroadcastCancelView.as_view(),
        name="broadcast-cancel",
    ),
    path(
        "broadcasts/<int:pk>/join/",
        BroadcastJoinView.as_view(),
        name="broadcast-join",
    ),
    path(
        "broadcasts/<int:pk>/leave/",
        BroadcastLeaveView.as_view(),
        name="broadcast-leave",
    ),
    path(
        "broadcasts/<int:pk>/room-url/",
        BroadcastRoomUrlView.as_view(),
        name="broadcast-room-url",
    ),
]