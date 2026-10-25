from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.requests.models import Application, Request
from apps.topics.models import Subject

from .models import Message, Thread

User = get_user_model()


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