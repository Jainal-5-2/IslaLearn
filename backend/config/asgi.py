"""
ASGI config for config project.

Routes HTTP to the Django app and WebSocket to the Channels consumers.
The Django app registry must be populated before the routing import
touches models, so get_asgi_application() runs before the consumer
imports. That ordering is why the imports below carry noqa: E402.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402

from apps.messages.middleware import JwtQueryAuthMiddleware  # noqa: E402
from apps.messages.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        JwtQueryAuthMiddleware(URLRouter(websocket_urlpatterns))
    ),
})