from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model


@database_sync_to_async
def _user_from_token(token):
    from rest_framework_simplejwt.exceptions import TokenError
    from rest_framework_simplejwt.tokens import AccessToken

    User = get_user_model()
    try:
        validated = AccessToken(token)
    except TokenError:
        return None
    return User.objects.filter(pk=validated["user_id"]).first()


class JwtQueryAuthMiddleware(BaseMiddleware):
    """
    Channels' AuthMiddlewareStack reads session cookies, not Bearer
    headers, and a browser cannot set headers on a WebSocket handshake.
    The access token therefore arrives in the query string and is
    promoted to scope["user"] here.

    Caveat: query strings can be logged by proxies and appear in
    browser history. Accepted for v6 per the design doc; revisit before
    launch if a reverse proxy in front of Daphne logs full URLs.
    """

    async def __call__(self, scope, receive, send):
        params = parse_qs(scope.get("query_string", b"").decode())
        token = (params.get("token") or [None])[0]
        scope["user"] = await _user_from_token(token) if token else None
        return await super().__call__(scope, receive, send)