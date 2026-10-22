from django.urls import path

from .views import (
    ApplicationDecisionView,
    RequestApplyView,
    RequestCloseView,
    RequestDetailView,
    RequestListCreateView,
)

urlpatterns = [
    path("requests/", RequestListCreateView.as_view(), name="request-list"),
    path("requests/<int:pk>/", RequestDetailView.as_view(), name="request-detail"),
    path("requests/<int:pk>/close/", RequestCloseView.as_view(), name="request-close"),
    path("requests/<int:pk>/apply/", RequestApplyView.as_view(), name="request-apply"),
    path("applications/<int:pk>/", ApplicationDecisionView.as_view(), name="application-decision"),
]