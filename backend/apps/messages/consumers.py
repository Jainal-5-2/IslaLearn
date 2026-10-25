from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from . import presence
from .parties import thread_parties


class ThreadConsumer(AsyncJsonWebsocketConsumer):
    """
    One room per Thread. Both parties join `thread_<id>` and receive
    every `message.created` event for that thread. The sender keeps its
    optimistic append; the echo is deduped by message id on the client.

    Connect is rejected (close 4401) without a valid token and (close
    4403) unless the user is a party to the thread.

    Wire format (all frames are JSON with a `type` field):
      -> {"type": "message", "message": <Message>}
      -> {"type": "presence", "user_id": int, "online": bool}
      -> {"type": "presence_snapshot", "user_ids": [int, ...]}
      <- {"type": "heartbeat"}
    """

    async def connect(self):
        self.user = self.scope.get("user")
        if self.user is None or not self.user.is_authenticated:
            await self.close(code=4401)
            return

        self.thread_id = self.scope["url_route"]["kwargs"]["pk"]
        if not await self._is_party():
            await self.close(code=4403)
            return

        self.group_name = f"thread_{self.thread_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Presence: record self, then send the current room to this
        # client so it can seed its online set, then announce self to
        # everyone else in the room.
        await self._mark_online()
        snapshot = await self._current_online()
        await self.send_json(
            {"type": "presence_snapshot", "user_ids": snapshot}
        )
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "presence.changed",
                "user_id": self.user.id,
                "online": True,
            },
        )

    async def disconnect(self, code):
        if not hasattr(self, "group_name"):
            return
        await self._mark_offline()
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "presence.changed",
                "user_id": self.user.id,
                "online": False,
            },
        )
        await self.channel_layer.group_discard(
            self.group_name, self.channel_name
        )

    async def receive_json(self, content, **kwargs):
        if content.get("type") == "heartbeat":
            await self._mark_online()

    async def message_created(self, event):
        await self.send_json({"type": "message", "message": event["message"]})

    async def presence_changed(self, event):
        await self.send_json(
            {
                "type": "presence",
                "user_id": event["user_id"],
                "online": event["online"],
            }
        )

    @database_sync_to_async
    def _is_party(self):
        from .models import Thread

        thread = Thread.objects.filter(pk=self.thread_id).first()
        if thread is None:
            return False
        return self.user in thread_parties(thread)

    @database_sync_to_async
    def _mark_online(self):
        presence.mark_online(self.thread_id, self.user.id)

    @database_sync_to_async
    def _mark_offline(self):
        presence.mark_offline(self.thread_id, self.user.id)

    @database_sync_to_async
    def _current_online(self):
        return presence.current_online(self.thread_id)