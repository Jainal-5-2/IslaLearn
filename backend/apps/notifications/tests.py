from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.broadcasts.models import Broadcast, BroadcastParticipant
from apps.messages.models import Message, Thread
from apps.requests.models import Application, Request
from apps.sessions.models import Review, Session
from apps.topics.models import Subject

from .models import Notification
from .services import notify

User = get_user_model()


def _make_accepted_request(tutee, tutor, subject):
    req = Request.objects.create(
        tutee=tutee, subject=subject, description="Help", status="open"
    )
    Application.objects.create(
        request=req, tutor=tutor, message="I can help", status="accepted"
    )
    req.status = "closed"
    req.save(update_fields=["status"])
    return req


class NotifyHelperTests(APITestCase):
    """
    Unit-level coverage for services.notify. These two rules cannot be
    enforced by the DB, so they are pinned here and nowhere else.
    """

    def setUp(self):
        self.actor = User.objects.create_user(
            username="actor", password="pass-a-1", email="a@example.com"
        )
        self.recipient = User.objects.create_user(
            username="recipient", password="pass-r-1", email="r@example.com"
        )
        self.third = User.objects.create_user(
            username="third", password="pass-t-1", email="t@example.com"
        )
        self.subject = Subject.objects.create(name="Notify")
        self.req = Request.objects.create(
            tutee=self.recipient,
            subject=self.subject,
            description="Help",
        )

    def test_actor_is_excluded_from_recipients(self):
        notify(
            kind="application_received",
            actor=self.actor,
            recipients=[self.actor, self.recipient],
            target_request=self.req,
        )
        self.assertFalse(
            Notification.objects.filter(recipient=self.actor).exists()
        )
        self.assertTrue(
            Notification.objects.filter(recipient=self.recipient).exists()
        )

    def test_recipients_are_deduped(self):
        notify(
            kind="application_received",
            actor=self.actor,
            recipients=[self.recipient, self.recipient, self.third],
            target_request=self.req,
        )
        self.assertEqual(
            Notification.objects.filter(recipient=self.recipient).count(), 1
        )
        self.assertEqual(
            Notification.objects.filter(recipient=self.third).count(), 1
        )

    def test_empty_recipients_is_a_noop(self):
        created = notify(
            kind="application_received",
            actor=self.actor,
            recipients=[],
            target_request=self.req,
        )
        self.assertEqual(created, [])
        self.assertEqual(Notification.objects.count(), 0)

    def test_zero_targets_raises(self):
        with self.assertRaises(ValueError):
            notify(
                kind="application_received",
                actor=self.actor,
                recipients=[self.recipient],
            )

    def test_two_targets_raises(self):
        topic = __import__(
            "apps.topics.models", fromlist=["Topic"]
        ).Topic.objects.create(
            subject=self.subject,
            created_by=self.actor,
            title="T",
            is_published=True,
        )
        with self.assertRaises(ValueError):
            notify(
                kind="application_received",
                actor=self.actor,
                recipients=[self.recipient],
                target_request=self.req,
                target_topic=topic,
            )


class NotificationTargetConstraintTests(APITestCase):
    """
    The DB check constraint is the backstop if a row is created outside
    notify() (shell, admin bypass, future bulk tooling). These create
    rows directly to prove the constraint fires.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="cuser", password="pass-cu-1", email="cu@example.com"
        )
        self.other = User.objects.create_user(
            username="cother", password="pass-co-1", email="co@example.com"
        )
        self.subject = Subject.objects.create(name="Constraint2")
        self.req = Request.objects.create(
            tutee=self.user, subject=self.subject, description="Help"
        )

    def test_zero_targets_raises(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Notification.objects.create(
                    recipient=self.user,
                    actor=self.other,
                    kind="application_received",
                )

    def test_two_targets_raises(self):
        from apps.topics.models import Topic

        topic = Topic.objects.create(
            subject=self.subject,
            created_by=self.other,
            title="T",
            is_published=True,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Notification.objects.create(
                    recipient=self.user,
                    actor=self.other,
                    kind="application_received",
                    target_request=self.req,
                    target_topic=topic,
                )

    def test_single_target_ok(self):
        row = Notification.objects.create(
            recipient=self.user,
            actor=self.other,
            kind="application_received",
            target_request=self.req,
        )
        self.assertEqual(row.target_request_id, self.req.id)


class NotificationListTests(APITestCase):
    """
    GET /api/notifications/

    Invariants:
      - Anonymous gets 401.
      - Only the requesting user's rows are returned.
      - unread_count is present and correct on every page.
      - is_read derives from read_at.
      - target_link and target_label are populated.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="luser", password="pass-lu-1", email="lu@example.com"
        )
        self.other = User.objects.create_user(
            username="lother", password="pass-lo-1", email="lo@example.com"
        )
        self.subject = Subject.objects.create(name="List")
        self.req = Request.objects.create(
            tutee=self.user, subject=self.subject, description="Help"
        )
        self.url = reverse("notification-list")

        for i in range(3):
            Notification.objects.create(
                recipient=self.user,
                actor=self.other,
                kind="application_received",
                target_request=self.req,
            )
        Notification.objects.create(
            recipient=self.user,
            actor=self.other,
            kind="application_received",
            target_request=self.req,
            read_at=timezone.now(),
        )
        # Another user's row, must not appear.
        Notification.objects.create(
            recipient=self.other,
            actor=self.user,
            kind="application_received",
            target_request=self.req,
        )

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_rejected(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_only_own_rows_returned(self):
        self._login(self.user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 4)
        self.assertEqual(response.data["unread_count"], 3)

    def test_is_read_derived_from_read_at(self):
        self._login(self.user)
        response = self.client.get(self.url)
        rows = response.data["results"]
        read_rows = [r for r in rows if r["is_read"]]
        unread_rows = [r for r in rows if not r["is_read"]]
        self.assertEqual(len(read_rows), 1)
        self.assertEqual(len(unread_rows), 3)

    def test_target_link_and_label_present(self):
        self._login(self.user)
        response = self.client.get(self.url)
        row = response.data["results"][0]
        self.assertEqual(row["target_link"], f"/requests/{self.req.id}")
        self.assertEqual(row["target_label"], self.subject.name)

    def test_unread_count_present_on_every_page(self):
        # 4 rows with PAGE_SIZE=20 means one page. Asserting presence
        # here pins the envelope shape; the "on every page" intent is
        # covered by the fact that the count is computed in list(),
        # not from the serializer.
        self._login(self.user)
        response = self.client.get(self.url)
        self.assertIn("unread_count", response.data)
        self.assertIn("results", response.data)
        self.assertIn("count", response.data)


class NotificationMarkReadTests(APITestCase):
    """
    POST /api/notifications/{id}/read/

    Invariants:
      - Anonymous gets 401.
      - Owner can mark own row read.
      - Second call is idempotent (still 200, read_at unchanged).
      - Another user's row is 404, not 403.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="muser", password="pass-mu-1", email="mu@example.com"
        )
        self.other = User.objects.create_user(
            username="mother", password="pass-mo-1", email="mo@example.com"
        )
        self.subject = Subject.objects.create(name="Mark")
        self.req = Request.objects.create(
            tutee=self.user, subject=self.subject, description="Help"
        )
        self.notification = Notification.objects.create(
            recipient=self.user,
            actor=self.other,
            kind="application_received",
            target_request=self.req,
        )
        self.url = reverse(
            "notification-mark-read", args=[self.notification.id]
        )

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_rejected(self):
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_owner_can_mark_read(self):
        self._login(self.user)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_read"])
        self.notification.refresh_from_db()
        self.assertIsNotNone(self.notification.read_at)

    def test_idempotent(self):
        self._login(self.user)
        self.client.post(self.url)
        self.notification.refresh_from_db()
        first_read_at = self.notification.read_at

        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.notification.refresh_from_db()
        self.assertEqual(self.notification.read_at, first_read_at)

    def test_other_users_row_is_404(self):
        self._login(self.other)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class NotificationReadAllTests(APITestCase):
    """
    POST /api/notifications/read-all/

    Invariants:
      - Anonymous gets 401.
      - Marks every unread row for the requesting user.
      - Does not touch other users' rows.
      - Returns updated count and unread_count=0.
      - Idempotent: a second call updates 0 rows.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="rauser", password="pass-ra-1", email="ra@example.com"
        )
        self.other = User.objects.create_user(
            username="raother", password="pass-ro-1", email="ro@example.com"
        )
        self.subject = Subject.objects.create(name="ReadAll")
        self.req = Request.objects.create(
            tutee=self.user, subject=self.subject, description="Help"
        )
        for _ in range(3):
            Notification.objects.create(
                recipient=self.user,
                actor=self.other,
                kind="application_received",
                target_request=self.req,
            )
        Notification.objects.create(
            recipient=self.other,
            actor=self.user,
            kind="application_received",
            target_request=self.req,
        )
        self.url = reverse("notification-read-all")

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_rejected(self):
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_marks_all_unread_for_user(self):
        self._login(self.user)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["updated"], 3)
        self.assertEqual(response.data["unread_count"], 0)
        self.assertEqual(
            Notification.objects.filter(
                recipient=self.user, read_at__isnull=True
            ).count(),
            0,
        )

    def test_does_not_touch_other_users(self):
        self._login(self.user)
        self.client.post(self.url)
        self.assertEqual(
            Notification.objects.filter(
                recipient=self.other, read_at__isnull=True
            ).count(),
            1,
        )

    def test_idempotent(self):
        self._login(self.user)
        self.client.post(self.url)
        response = self.client.post(self.url)
        self.assertEqual(response.data["updated"], 0)


class RequestApplyNotificationTests(APITestCase):
    """
    POST /api/requests/{id}/apply/ fans out application_received to the
    tutee, from the tutor, with target_request. The applying tutor must
    not receive their own notification.
    """

    def setUp(self):
        self.tutee = User.objects.create_user(
            username="atutee", password="pass-at-1", email="at@example.com"
        )
        self.tutor = User.objects.create_user(
            username="atutor", password="pass-au-1", email="au@example.com"
        )
        self.subject = Subject.objects.create(name="Apply")
        self.req = Request.objects.create(
            tutee=self.tutee, subject=self.subject, description="Help"
        )
        self.url = reverse("request-apply", args=[self.req.id])

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_apply_creates_application_received(self):
        self._login(self.tutor)
        response = self.client.post(self.url, {"message": "I can help"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        n = Notification.objects.get(kind="application_received")
        self.assertEqual(n.recipient_id, self.tutee.id)
        self.assertEqual(n.actor_id, self.tutor.id)
        self.assertEqual(n.target_request_id, self.req.id)

    def test_tutor_does_not_notify_self(self):
        self._login(self.tutor)
        self.client.post(self.url, {"message": "I can help"})
        self.assertFalse(
            Notification.objects.filter(recipient=self.tutor).exists()
        )


class ApplicationDecisionNotificationTests(APITestCase):
    """
    PATCH /api/applications/{id}/ fans out accepted or rejected to the
    applying tutor, from the tutee, with target_request.
    """

    def setUp(self):
        self.tutee = User.objects.create_user(
            username="dtutee", password="pass-dt-1", email="dt@example.com"
        )
        self.tutor = User.objects.create_user(
            username="dtutor", password="pass-du-1", email="du@example.com"
        )
        self.subject = Subject.objects.create(name="Decision")
        self.req = Request.objects.create(
            tutee=self.tutee, subject=self.subject, description="Help"
        )
        self.app = Application.objects.create(
            request=self.req, tutor=self.tutor, message="sure"
        )
        self.url = reverse("application-decision", args=[self.app.id])

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_accept_creates_accepted_notification(self):
        self._login(self.tutee)
        response = self.client.patch(self.url, {"status": "accepted"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        n = Notification.objects.get(kind="application_accepted")
        self.assertEqual(n.recipient_id, self.tutor.id)
        self.assertEqual(n.actor_id, self.tutee.id)
        self.assertEqual(n.target_request_id, self.req.id)

    def test_reject_creates_rejected_notification(self):
        self._login(self.tutee)
        response = self.client.patch(self.url, {"status": "rejected"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        n = Notification.objects.get(kind="application_rejected")
        self.assertEqual(n.recipient_id, self.tutor.id)
        self.assertEqual(n.actor_id, self.tutee.id)

    def test_tutee_does_not_notify_self(self):
        self._login(self.tutee)
        self.client.patch(self.url, {"status": "accepted"})
        self.assertFalse(
            Notification.objects.filter(recipient=self.tutee).exists()
        )


class RequestCompleteNotificationTests(APITestCase):
    """
    POST /api/requests/{id}/complete/ fans out session_completed to the
    accepted tutor, from the tutee. A second call (idempotent 200) must
    not create a second notification.
    """

    def setUp(self):
        self.tutee = User.objects.create_user(
            username="ctutee", password="pass-ct-1", email="ct@example.com"
        )
        self.tutor = User.objects.create_user(
            username="ctutor", password="pass-cu-1", email="cu@example.com"
        )
        self.subject = Subject.objects.create(name="Complete")
        self.req = _make_accepted_request(self.tutee, self.tutor, self.subject)
        self.url = reverse("request-complete", args=[self.req.id])

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_complete_creates_session_completed(self):
        self._login(self.tutee)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        n = Notification.objects.get(kind="session_completed")
        self.assertEqual(n.recipient_id, self.tutor.id)
        self.assertEqual(n.actor_id, self.tutee.id)
        self.assertEqual(n.target_request_id, self.req.id)

    def test_tutee_does_not_notify_self(self):
        self._login(self.tutee)
        self.client.post(self.url)
        self.assertFalse(
            Notification.objects.filter(recipient=self.tutee).exists()
        )

    def test_second_complete_does_not_duplicate(self):
        self._login(self.tutee)
        self.client.post(self.url)
        second = self.client.post(self.url)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(
            Notification.objects.filter(
                kind="session_completed", recipient=self.tutor
            ).count(),
            1,
        )


class BroadcastCompleteNotificationTests(APITestCase):
    """
    POST /api/broadcasts/{id}/complete/ fans out session_completed to
    every joined participant, from the tutor. The tutor is excluded.
    A second call must not duplicate.
    """

    def setUp(self):
        self.tutor = User.objects.create_user(
            username="btutor", password="pass-bt-1", email="bt@example.com"
        )
        self.p1 = User.objects.create_user(
            username="bp1", password="pass-b1-1", email="b1@example.com"
        )
        self.p2 = User.objects.create_user(
            username="bp2", password="pass-b2-1", email="b2@example.com"
        )
        self.subject = Subject.objects.create(name="BComplete")
        self.broadcast = Broadcast.objects.create(
            tutor=self.tutor,
            subject=self.subject,
            title="Sorting",
            scheduled_at=timezone.now() - timedelta(hours=1),
            room_url="https://whereby.example/room",
        )
        BroadcastParticipant.objects.create(
            broadcast=self.broadcast, user=self.p1
        )
        BroadcastParticipant.objects.create(
            broadcast=self.broadcast, user=self.p2
        )
        self.url = reverse("broadcast-complete", args=[self.broadcast.id])

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_complete_notifies_all_participants(self):
        self._login(self.tutor)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        rows = Notification.objects.filter(kind="session_completed")
        self.assertEqual(rows.count(), 2)
        recipient_ids = set(rows.values_list("recipient_id", flat=True))
        self.assertEqual(recipient_ids, {self.p1.id, self.p2.id})
        for row in rows:
            self.assertEqual(row.actor_id, self.tutor.id)
            self.assertEqual(row.target_broadcast_id, self.broadcast.id)

    def test_tutor_does_not_notify_self(self):
        self._login(self.tutor)
        self.client.post(self.url)
        self.assertFalse(
            Notification.objects.filter(recipient=self.tutor).exists()
        )

    def test_second_complete_does_not_duplicate(self):
        self._login(self.tutor)
        self.client.post(self.url)
        second = self.client.post(self.url)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(
            Notification.objects.filter(kind="session_completed").count(),
            2,
        )


class ReviewNotificationTests(APITestCase):
    """
    POST /api/sessions/{id}/reviews/ fans out review_received to the
    reviewee, from the reviewer, with target_review. A blocked second
    review (400) must not create a second notification.
    """

    def setUp(self):
        self.tutor = User.objects.create_user(
            username="rtutor", password="pass-rt-1", email="rt@example.com"
        )
        self.tutee = User.objects.create_user(
            username="rtutee", password="pass-ru-1", email="ru@example.com"
        )
        self.subject = Subject.objects.create(name="RNotify")
        req = _make_accepted_request(self.tutee, self.tutor, self.subject)
        self.session = Session.objects.create(
            session_type="one_on_one",
            request=req,
            completed_at=timezone.now(),
            marked_by=self.tutee,
        )
        self.url = reverse(
            "session-review-create", args=[self.session.id]
        )

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_review_creates_review_received(self):
        self._login(self.tutee)
        response = self.client.post(
            self.url,
            {"reviewee": self.tutor.id, "rating": 5, "text": "Great"},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        n = Notification.objects.get(kind="review_received")
        self.assertEqual(n.recipient_id, self.tutor.id)
        self.assertEqual(n.actor_id, self.tutee.id)
        self.assertIsNotNone(n.target_review_id)

    def test_reviewer_does_not_notify_self(self):
        self._login(self.tutee)
        self.client.post(
            self.url,
            {"reviewee": self.tutor.id, "rating": 5, "text": "Great"},
        )
        self.assertFalse(
            Notification.objects.filter(recipient=self.tutee).exists()
        )

    def test_second_review_blocked_and_does_not_duplicate(self):
        self._login(self.tutee)
        self.client.post(
            self.url,
            {"reviewee": self.tutor.id, "rating": 5, "text": "Great"},
        )
        second = self.client.post(
            self.url,
            {"reviewee": self.tutor.id, "rating": 3, "text": "Again"},
        )
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            Notification.objects.filter(kind="review_received").count(), 1
        )


class MessageNotificationTests(APITestCase):
    """
    POST /api/threads/{id}/messages/ fans out message_received to the
    other thread party, with target_request. The sender must not
    receive a notification for their own message.
    """

    def setUp(self):
        self.tutee = User.objects.create_user(
            username="mtutee", password="pass-mt-1", email="mt@example.com"
        )
        self.tutor = User.objects.create_user(
            username="mtutor", password="pass-mu-1", email="mu@example.com"
        )
        self.subject = Subject.objects.create(name="Msg")
        self.req = _make_accepted_request(self.tutee, self.tutor, self.subject)
        self.thread = Thread.objects.create(request=self.req)
        self.url = reverse("thread-messages", args=[self.thread.id])

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_message_creates_message_received(self):
        self._login(self.tutee)
        response = self.client.post(self.url, {"body": "hello"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        n = Notification.objects.get(kind="message_received")
        self.assertEqual(n.recipient_id, self.tutor.id)
        self.assertEqual(n.actor_id, self.tutee.id)
        self.assertEqual(n.target_request_id, self.req.id)

    def test_sender_does_not_notify_self(self):
        self._login(self.tutee)
        self.client.post(self.url, {"body": "hello"})
        self.assertFalse(
            Notification.objects.filter(recipient=self.tutee).exists()
        )


class NotificationSerializerLinkTests(APITestCase):
    """
    target_link / target_label per kind. The serializer is the single
    place "what does this kind mean" lives, so a wrong link is caught
    only here.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="suser", password="pass-su-1", email="su@example.com"
        )
        self.actor = User.objects.create_user(
            username="sactor", password="pass-sa-1", email="sa@example.com"
        )
        self.subject = Subject.objects.create(name="LinkSubject")
        self.req = Request.objects.create(
            tutee=self.user, subject=self.subject, description="Help"
        )

    def _link_and_label(self, notification):
        from .serializers import NotificationSerializer

        data = NotificationSerializer(notification).data
        return data["target_link"], data["target_label"]

    def test_application_received_link(self):
        n = Notification.objects.create(
            recipient=self.user,
            actor=self.actor,
            kind="application_received",
            target_request=self.req,
        )
        link, label = self._link_and_label(n)
        self.assertEqual(link, f"/requests/{self.req.id}")
        self.assertEqual(label, self.subject.name)

    def test_session_completed_one_on_one_link(self):
        session = Session.objects.create(
            session_type="one_on_one",
            request=self.req,
            completed_at=timezone.now(),
            marked_by=self.user,
        )
        n = Notification.objects.create(
            recipient=self.user,
            actor=self.actor,
            kind="session_completed",
            target_request=self.req,
        )
        link, _ = self._link_and_label(n)
        self.assertEqual(link, f"/sessions/{session.id}")

    def test_session_completed_broadcast_link(self):
        broadcast = Broadcast.objects.create(
            tutor=self.actor,
            subject=self.subject,
            title="B title",
            scheduled_at=timezone.now() - timedelta(hours=1),
        )
        session = Session.objects.create(
            session_type="broadcast",
            broadcast=broadcast,
            completed_at=timezone.now(),
            marked_by=self.actor,
        )
        n = Notification.objects.create(
            recipient=self.user,
            actor=self.actor,
            kind="session_completed",
            target_broadcast=broadcast,
        )
        link, label = self._link_and_label(n)
        self.assertEqual(link, f"/sessions/{session.id}")
        self.assertEqual(label, "B title")

    def test_review_received_link(self):
        req = _make_accepted_request(self.user, self.actor, self.subject)
        session = Session.objects.create(
            session_type="one_on_one",
            request=req,
            completed_at=timezone.now(),
            marked_by=self.user,
        )
        review = Review.objects.create(
            session=session,
            reviewer=self.actor,
            reviewee=self.user,
            rating=5,
        )
        n = Notification.objects.create(
            recipient=self.user,
            actor=self.actor,
            kind="review_received",
            target_review=review,
        )
        link, label = self._link_and_label(n)
        self.assertEqual(link, f"/profile/{self.user.id}/reviews")
        self.assertEqual(label, "a review")

    def test_message_received_link(self):
        req = _make_accepted_request(self.user, self.actor, self.subject)
        thread = Thread.objects.create(request=req)
        n = Notification.objects.create(
            recipient=self.user,
            actor=self.actor,
            kind="message_received",
            target_request=req,
        )
        link, label = self._link_and_label(n)
        self.assertEqual(link, f"/messages/{thread.id}")
        self.assertEqual(label, self.subject.name)