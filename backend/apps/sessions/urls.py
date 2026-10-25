from django.urls import path

from .views import (
    BroadcastCompleteView,
    RequestCompleteView,
    SessionDetailView,
    SessionListView,
    SessionReviewCreateView,
    UserReviewsView,
)

urlpatterns = [
    path(
        "requests/<int:pk>/complete/",
        RequestCompleteView.as_view(),
        name="request-complete",
    ),
    path(
        "broadcasts/<int:pk>/complete/",
        BroadcastCompleteView.as_view(),
        name="broadcast-complete",
    ),
    path(
        "sessions/",
        SessionListView.as_view(),
        name="session-list",
    ),
    path(
        "sessions/<int:pk>/",
        SessionDetailView.as_view(),
        name="session-detail",
    ),
    path(
        "sessions/<int:pk>/reviews/",
        SessionReviewCreateView.as_view(),
        name="session-review-create",
    ),
    path(
        "users/<int:pk>/reviews/",
        UserReviewsView.as_view(),
        name="user-reviews",
    ),
]