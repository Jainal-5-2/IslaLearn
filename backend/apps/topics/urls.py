from django.urls import path
from .views import (
    SubjectListView,
    TopicListCreateView,
    TopicDetailView,
    TopicPageListCreateView,
    TopicPageDetailView,
    TopicProgressView,
)

urlpatterns = [
    path("subjects/", SubjectListView.as_view(), name="subject-list"),
    path("topics/", TopicListCreateView.as_view(), name="topic-list"),
    path("topics/<int:pk>/", TopicDetailView.as_view(), name="topic-detail"),
    # Nested Topic Pages
    path(
        "topics/<int:topic_id>/pages/",
        TopicPageListCreateView.as_view(),
        name="topic-page-list",
    ),
    path(
        "topics/<int:topic_id>/pages/<int:pk>/",
        TopicPageDetailView.as_view(),
        name="topic-page-detail",
    ),
    # Progress
    path(
        "topics/<int:pk>/progress/", TopicProgressView.as_view(), name="topic-progress"
    ),
]
