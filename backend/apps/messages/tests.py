from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.requests.models import Application, Request
from apps.topics.models import Subject

from .models import Message, Thread

User = get_user_model()

import redis
from django.conf import settings as django_settings

def _has_redis():
    try:
        url = django_settings.CHANNEL_LAYERS["default"]["CONFIG"]["hosts"][0]
        if isinstance(url, (list, tuple)):
            url = url[0]
        redis.Redis.from_url(url).ping()
        return True
    except Exception:
        return False


class ThreadPresenceTests(TransactionTestCase):
    """
    Covers presence: snapshot on connect, presence broadcasts, and
    heartbeat refresh.

    Skipped when Redis is unreachable so a developer without Docker
    sees yellow, not red. Presence itself swallows Redis errors, so
    nothing else in the suite depends on this class running.
    """

    def setUp(self):
        if not _has_redis():
            self.skipTest("Redis is not reachable; skipping presence tests.")
        from . import presence

        self.presence = presence

        self.tutee = User.objects.create_user(
            username="ptutee", password="pass-pt-1", email="pt@example.com"
        )
        self.tutor = User.objects.create_user(
            username="ptutor", password="pass-pu-1", email="pu@example.com"
        )
        self.subject = Subject.objects.create(name="Presence")
        self.req = _make_accepted_request(self.tutee, self.tutor, self.subject)
        self.thread = Thread.objects.create(request=self.req)
        # Wipe any leftover presence from a prior test run.
        self.presence.mark_offline(self.thread.id, self.tutee.id)
        self.presence.mark_offline(self.thread.id, self.tutor.id)

    def _connect(self, path):
        return WebsocketCommunicator(
            application,
            path,
            headers=[(b"origin", b"http://localhost")],
        )

    def test_snapshot_on_connect_lists_existing_users(self):
        # Pre-seed the tutor as already in the room.
        self.presence.mark_online(self.thread.id, self.tutor.id)

        token = _token_for(self.tutee)

        async def run():
            comm = self._connect(
                f"/ws/threads/{self.thread.id}/?token={token}"
            )
            connected, _ = await comm.connect()
            assert connected
            # First frame after accept is the snapshot.
            frame = await comm.receive_json_from(timeout=2)
            await comm.disconnect()
            return frame

        frame = async_to_sync(run)()
        self.assertEqual(frame["type"], "presence_snapshot")
        self.assertIn(self.tutor.id, frame["user_ids"])

    def test_connect_and_disconnect_broadcast_presence(self):
        tutor_token = _token_for(self.tutor)
        tutee_token = _token_for(self.tutee)

        async def run():
            # Tutor connects first and stays connected.
            tutor_comm = self._connect(
                f"/ws/threads/{self.thread.id}/?token={tutor_token}"
            )
            connected, _ = await tutor_comm.connect()
            assert connected
            # Drain the tutor's own snapshot frame.
            await tutor_comm.receive_json_from(timeout=2)

            # Tutee connects.
            tutee_comm = self._connect(
                f"/ws/threads/{self.thread.id}/?token={tutee_token}"
            )
            connected, _ = await tutee_comm.connect()
            assert connected
            await tutee_comm.receive_json_from(timeout=2)  # snapshot

            # Tutor sees the tutee come online.
            online = await tutor_comm.receive_json_from(timeout=2)
            # Tutee disconnects.
            await tutee_comm.disconnect()

            # Tutor sees the tutee go offline.
            offline = await tutor_comm.receive_json_from(timeout=2)
            await tutor_comm.disconnect()
            return online, offline

        online, offline = async_to_sync(run)()
        self.assertEqual(
            online,
            {"type": "presence", "user_id": self.tutee.id, "online": True},
        )
        self.assertEqual(
            offline,
            {"type": "presence", "user_id": self.tutee.id, "online": False},
        )

    def test_heartbeat_refreshes_presence(self):
        self.presence.mark_online(self.thread.id, self.tutor.id)
        initial = self.presence.current_online(self.thread.id)
        self.assertIn(self.tutor.id, initial)

        # A heartbeat from a fresh connection should not crash and should
        # keep the tutor visible.
        token = _token_for(self.tutor)

        async def run():
            comm = self._connect(
                f"/ws/threads/{self.thread.id}/?token={token}"
            )
            connected, _ = await comm.connect()
            assert connected
            await comm.receive_json_from(timeout=2)  # snapshot
            await comm.send_json_to({"type": "heartbeat"})
            # No response frame is expected for a heartbeat.
            await comm.disconnect()

        async_to_sync(run)()
        after = self.presence.current_online(self.thread.id)
        self.assertIn(self.tutor.id, after)

def _make_accepted_request(tutee, tutor, subject, close=True):
    req = Request.objects.create(
        tutee=tutee, subject=subject, description="Help", status="open"
    )
    Application.objects.create(
        request=req, tutor=tutor, message="I can help", status="accepted"
    )
    if close:
        req.status = "closed"
        req.save(update_fields=["status"])
    return req


class ThreadCreateOnAcceptTests(APITestCase):
    """
    Accepting an application creates a Thread. Rejecting does not.
    Idempotent: a second accept on a different application would be
    blocked earlier, but the get_or_create is idempotent regardless.
    """

    def setUp(self):
        self.tutee = User.objects.create_user(
            username="t", password="pass-t-1", email="t@example.com"
        )
        self.tutor = User.objects.create_user(
            username="u", password="pass-u-1", email="u@example.com"
        )
        self.subject = Subject.objects.create(name="Python")
        self.req = Request.objects.create(
            tutee=self.tutee, subject=self.subject, description="Help"
        )
        self.app = Application.objects.create(
            request=self.req, tutor=self.tutor, message="sure"
        )
        self.url = reverse("application-decision", args=[self.app.id])

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_accept_creates_thread(self):
        self._login(self.tutee)
        response = self.client.patch(
            self.url, {"status": "accepted"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(Thread.objects.filter(request=self.req).exists())

    def test_reject_does_not_create_thread(self):
        self._login(self.tutee)
        response = self.client.patch(
            self.url, {"status": "rejected"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Thread.objects.filter(request=self.req).exists())


class ThreadListTests(APITestCase):
    """
    GET /api/threads/

    Invariants:
      - Anonymous gets 401.
      - Parties see their threads.
      - Outsiders do not.
      - is_open is true while the request is closed with no Session.
    """

    def setUp(self):
        self.tutee = User.objects.create_user(
            username="t", password="pass-t-1", email="t@example.com"
        )
        self.tutor = User.objects.create_user(
            username="u", password="pass-u-1", email="u@example.com"
        )
        self.outsider = User.objects.create_user(
            username="o", password="pass-o-1", email="o@example.com"
        )
        self.subject = Subject.objects.create(name="Python")
        self.req = _make_accepted_request(self.tutee, self.tutor, self.subject)
        self.thread = Thread.objects.create(request=self.req)
        self.url = reverse("thread-list")

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_rejected(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tutee_sees_thread(self):
        self._login(self.tutee)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in response.data["results"]]
        self.assertIn(self.thread.id, ids)

    def test_tutor_sees_thread(self):
        self._login(self.tutor)
        response = self.client.get(self.url)
        ids = [row["id"] for row in response.data["results"]]
        self.assertIn(self.thread.id, ids)

    def test_outsider_does_not_see_thread(self):
        self._login(self.outsider)
        response = self.client.get(self.url)
        self.assertEqual(response.data["count"], 0)

    def test_is_open_true_when_request_closed_no_session(self):
        self._login(self.tutee)
        response = self.client.get(self.url)
        row = next(r for r in response.data["results"] if r["id"] == self.thread.id)
        self.assertTrue(row["is_open"])


class MessageListCreateTests(APITestCase):
    """
    GET/POST /api/threads/{id}/messages/

    Invariants:
      - Anonymous 401.
      - Non-party 403.
      - Posting when open succeeds.
      - Posting when the thread is closed (session completed) returns 400.
      - Body empty -> 400; body > 2000 -> 400.
      - List returns messages oldest-first.
    """

    def setUp(self):
        from apps.sessions.models import Session
        from django.utils import timezone

        self.tutee = User.objects.create_user(
            username="t", password="pass-t-1", email="t@example.com"
        )
        self.tutor = User.objects.create_user(
            username="u", password="pass-u-1", email="u@example.com"
        )
        self.outsider = User.objects.create_user(
            username="o", password="pass-o-1", email="o@example.com"
        )
        self.subject = Subject.objects.create(name="Python")
        self.req = _make_accepted_request(self.tutee, self.tutor, self.subject)
        self.thread = Thread.objects.create(request=self.req)
        self.url = reverse("thread-messages", args=[self.thread.id])
        self.Session = Session
        self.timezone = timezone

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_rejected(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_outsider_rejected(self):
        self._login(self.outsider)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_party_can_list_messages(self):
        Message.objects.create(
            thread=self.thread, sender=self.tutee, body="hi"
        )
        self._login(self.tutor)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["body"], "hi")

    def test_party_can_post(self):
        self._login(self.tutee)
        response = self.client.post(self.url, {"body": "hello"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Message.objects.filter(thread=self.thread, body="hello").exists()
        )

    def test_empty_body_rejected(self):
        self._login(self.tutee)
        response = self.client.post(self.url, {"body": "   "})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_oversize_body_rejected(self):
        self._login(self.tutee)
        response = self.client.post(self.url, {"body": "x" * 2001})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_post_rejected_after_session_completed(self):
        self.Session.objects.create(
            session_type="one_on_one",
            request=self.req,
            completed_at=self.timezone.now(),
            marked_by=self.tutor,
        )
        self._login(self.tutee)
        response = self.client.post(self.url, {"body": "hello"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase

from config.asgi import application


def _token_for(user):
    from rest_framework_simplejwt.tokens import AccessToken

    return str(AccessToken.for_user(user))


class ThreadConsumerTests(TransactionTestCase):
    """
    Covers the ThreadConsumer handshake and the POST fan-out.

    Invariants:
      - No token -> refused (close 4401).
      - A non-party token -> refused (close 4403).
      - Unknown thread id -> refused (close 4403).
      - A party connects.
      - POST /messages/ fans out the created message to the room.

    Each refusal test asserts on the close code so a failure names the
    reason instead of just "False is not true".
    """

    def setUp(self):
        self.tutee = User.objects.create_user(
            username="ctutee", password="pass-ct-1", email="ct@example.com"
        )
        self.tutor = User.objects.create_user(
            username="ctutor", password="pass-cu-1", email="cu@example.com"
        )
        self.outsider = User.objects.create_user(
            username="cout", password="pass-co-1", email="co@example.com"
        )
        self.subject = Subject.objects.create(name="Sockets")
        self.req = _make_accepted_request(self.tutee, self.tutor, self.subject)
        self.thread = Thread.objects.create(request=self.req)

    def _connect(self, path):
        return WebsocketCommunicator(
            application,
            path,
            headers=[(b"origin", b"http://localhost")],
        )

    def test_no_token_refused(self):
        async def run():
            comm = self._connect(f"/ws/threads/{self.thread.id}/")
            connected, code = await comm.connect()
            await comm.disconnect()
            return connected, code

        connected, code = async_to_sync(run)()
        self.assertFalse(connected, f"connected with no token (code {code})")
        self.assertEqual(code, 4401, f"expected 4401, got {code}")

    def test_outsider_refused(self):
        token = _token_for(self.outsider)

        async def run():
            comm = self._connect(
                f"/ws/threads/{self.thread.id}/?token={token}"
            )
            connected, code = await comm.connect()
            await comm.disconnect()
            return connected, code

        connected, code = async_to_sync(run)()
        self.assertFalse(connected, f"outsider connected (code {code})")
        self.assertEqual(code, 4403, f"expected 4403, got {code}")

    def test_unknown_thread_refused(self):
        token = _token_for(self.tutee)

        async def run():
            comm = self._connect(f"/ws/threads/999999/?token={token}")
            connected, code = await comm.connect()
            await comm.disconnect()
            return connected, code

        connected, code = async_to_sync(run)()
        self.assertFalse(connected, f"unknown thread connected (code {code})")
        self.assertEqual(code, 4403, f"expected 4403, got {code}")

    def test_party_connects(self):
        token = _token_for(self.tutor)

        async def run():
            comm = self._connect(
                f"/ws/threads/{self.thread.id}/?token={token}"
            )
            connected, code = await comm.connect()
            await comm.disconnect()
            return connected, code

        connected, code = async_to_sync(run)()
        self.assertTrue(connected, f"refused with close code {code}")

    def test_post_fans_out_to_room(self):
        token = _token_for(self.tutor)
        url = f"/ws/threads/{self.thread.id}/?token={token}"

        async def run():
            comm = self._connect(url)
            connected, code = await comm.connect()
            assert connected, f"refused with close code {code}"

            def post():
                from asgiref.sync import async_to_sync as a2s

                from channels.layers import get_channel_layer

                from .serializers import (
                    MessageCreateSerializer,
                    MessageSerializer,
                )

                s = MessageCreateSerializer(data={"body": "hello"})
                s.is_valid(raise_exception=True)
                message = s.save(thread=self.thread, sender=self.tutee)
                payload = MessageSerializer(message).data
                a2s(get_channel_layer().group_send)(
                    f"thread_{self.thread.id}",
                    {"type": "message.created", "message": payload},
                )

            from asgiref.sync import sync_to_async

            await sync_to_async(post)()

            frame = await comm.receive_json_from(timeout=2)
            await comm.disconnect()
            return frame

        frame = async_to_sync(run)()
        self.assertEqual(frame["body"], "hello")
        self.assertEqual(frame["sender"]["id"], self.tutee.id)        
        