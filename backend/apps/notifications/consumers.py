from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .services import user_group_name


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """
    One socket per user. The user joins `user_<id>` on connect and
    receives every `notification.created` frame that services._push
    sends to that group.

    Auth is inherited from JwtQueryAuthMiddleware: scope["user"] is
    already resolved by the time connect() runs. If it is anonymous or
    missing, close 4401, the same code ThreadConsumer uses, so a client
    reconnect handler can treat both consumers the same way.

    Server-push only. Inbound frames are ignored: there is nothing for
    a client to say over this socket. No heartbeat, because unlike
    ThreadConsumer there is no presence row to keep warm.

    Wire format:
      <- {"type": "notification", "notification": <Notification>}
    """

    async def connect(self):
        self.user = self.scope.get("user")
        if self.user is None or not self.user.is_authenticated:
            await self.close(code=4401)
            return

        self.group_name = user_group_name(self.user.id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if not hasattr(self, "group_name"):
            return
        await self.channel_layer.group_discard(
            self.group_name, self.channel_name
        )

    async def receive_json(self, content, **kwargs):
        # Server-push only. Ignore anything the client sends.
        return

    async def notification_created(self, event):
        await self.send_json(
            {"type": "notification", "notification": event["notification"]}
        )