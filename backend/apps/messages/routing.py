from django.urls import path

from .consumers import ThreadConsumer

websocket_urlpatterns = [
    path("ws/threads/<int:pk>/", ThreadConsumer.as_asgi()),
]