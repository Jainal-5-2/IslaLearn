from django.urls import path

from .views import (
    BroadcastCompleteView,
    RequestCompleteView,
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