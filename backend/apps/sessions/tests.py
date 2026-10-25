from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from django.db import models
from rest_framework import status as drf_status
from rest_framework import status
from rest_framework.test import APITestCase

from apps.broadcasts.models import Broadcast, BroadcastParticipant
from apps.requests.models import Application, Request
from apps.topics.models import Subject

from .models import Review, Session
from .parties import session_participants

User = get_user_model()


def _make_request_with_accepted_tutor(tutee, tutor, subject):
    req = Request.objects.create(
        tutee=tutee, subject=subject, description="Help", status="open"
    )
    Application.objects.create(
        request=req, tutor=tutor, message="I can help", status="accepted"
    )
    req.status = "closed"
    req.save(update_fields=["status"])
    return req


class RequestCompleteTests(APITestCase):
    """
    POST /api/requests/{id}/complete/

    Invariants:
      - Anonymous gets 401.
      - Non-tutor participant (tutee) gets 403.
      - The accepted tutor can complete; a Session row is created.
      - Completing twice is idempotent (one Session row).
      - A request with no accepted tutor returns 400.
      - A different tutor cannot complete.
    """

    def setUp(self):
        self.tutee = User.objects.create_user(
            username="tutee", password="pass-tutee-1", email="te@example.com"
        )
        self.tutor = User.objects.create_user(
            username="tutor", password="pass-tutor-1", email="tu@example.com"
        )
        self.other_tutor = User.objects.create_user(
            username="other", password="pass-other-1", email="ot@example.com"
        )
        self.subject = Subject.objects.create(name="Python")
        self.req = _make_request_with_accepted_tutor(
            self.tutee, self.tutor, self.subject
        )
        self.url = reverse("request-complete", args=[self.req.id])

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_rejected(self):
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tutee_cannot_complete(self):
        self._login(self.tutee)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_other_tutor_cannot_complete(self):
        self._login(self.other_tutor)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_tutor_completes_and_session_is_created(self):
        self._login(self.tutor)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        session = Session.objects.get(request=self.req)
        self.assertEqual(session.session_type, "one_on_one")
        self.assertIsNotNone(session.completed_at)
        self.assertEqual(session.marked_by_id, self.tutor.id)

    def test_complete_twice_is_idempotent(self):
        self._login(self.tutor)
        first = self.client.post(self.url)
        second = self.client.post(self.url)
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(Session.objects.filter(request=self.req).count(), 1)

    def test_request_without_accepted_tutor_returns_400(self):
        open_req = Request.objects.create(
            tutee=self.tutee, subject=self.subject, description="no tutor"
        )
        self._login(self.tutor)
        response = self.client.post(
            reverse("request-complete", args=[open_req.id])
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class BroadcastCompleteTests(APITestCase):
    """
    POST /api/broadcasts/{id}/complete/

    Invariants:
      - Only the broadcasting tutor can complete (403 for everyone else).
      - A cancelled broadcast returns 400.
      - Completing twice is idempotent.
    """

    def setUp(self):
        self.tutor = User.objects.create_user(
            username="btutor", password="pass-bt-1", email="bt@example.com"
        )
        self.tutee = User.objects.create_user(
            username="btutee", password="pass-bu-1", email="bu@example.com"
        )
        self.subject = Subject.objects.create(name="Algorithms")
        self.broadcast = Broadcast.objects.create(
            tutor=self.tutor,
            subject=self.subject,
            title="Sorting",
            description="",
            scheduled_at=timezone.now() - timedelta(hours=1),
            room_url="https://whereby.example/room",
        )
        BroadcastParticipant.objects.create(
            broadcast=self.broadcast, user=self.tutee
        )
        self.url = reverse("broadcast-complete", args=[self.broadcast.id])

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_rejected(self):
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_tutor_rejected(self):
        self._login(self.tutee)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_tutor_completes(self):
        self._login(self.tutor)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Session.objects.filter(
                session_type="broadcast", broadcast=self.broadcast
            ).exists()
        )

    def test_cancelled_rejected(self):
        self.broadcast.is_cancelled = True
        self.broadcast.save(update_fields=["is_cancelled"])
        self._login(self.tutor)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_complete_twice_idempotent(self):
        self._login(self.tutor)
        first = self.client.post(self.url)
        second = self.client.post(self.url)
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)


class SessionParticipantsTests(APITestCase):
    """
    Verifies the parties helper for both session types.
    """

    def setUp(self):
        self.tutor = User.objects.create_user(
            username="ptutor", password="pass-pt-1", email="pt@example.com"
        )
        self.tutee = User.objects.create_user(
            username="ptutee", password="pass-pu-1", email="pu@example.com"
        )
        self.outsider = User.objects.create_user(
            username="pout", password="pass-po-1", email="po@example.com"
        )
        self.subject = Subject.objects.create(name="Networks")

    def test_one_on_one_parties(self):
        req = _make_request_with_accepted_tutor(
            self.tutee, self.tutor, self.subject
        )
        session = Session.objects.create(
            session_type="one_on_one",
            request=req,
            completed_at=timezone.now(),
        )
        parties = session_participants(session)
        self.assertEqual(parties, {self.tutee, self.tutor})
        self.assertNotIn(self.outsider, parties)

    def test_broadcast_parties(self):
        broadcast = Broadcast.objects.create(
            tutor=self.tutor,
            subject=self.subject,
            title="Topic",
            scheduled_at=timezone.now() + timedelta(hours=1),
        )
        BroadcastParticipant.objects.create(
            broadcast=broadcast, user=self.tutee
        )
        session = Session.objects.create(
            session_type="broadcast",
            broadcast=broadcast,
            completed_at=timezone.now(),
        )
        parties = session_participants(session)
        self.assertEqual(parties, {self.tutor, self.tutee})
        self.assertNotIn(self.outsider, parties)


class SessionReviewCreateTests(APITestCase):
    """
    POST /api/sessions/{id}/reviews/

    Invariants:
      - Only participants can review.
      - Cannot review a session that is not complete.
      - Cannot review yourself.
      - Cannot review someone outside the session.
      - Cannot review the same session twice.
      - Rating outside 1-5 is rejected.
    """

    def setUp(self):
        self.tutor = User.objects.create_user(
            username="rtutor", password="pass-rt-1", email="rt@example.com"
        )
        self.tutee = User.objects.create_user(
            username="rtutee", password="pass-ru-1", email="ru@example.com"
        )
        self.outsider = User.objects.create_user(
            username="rout", password="pass-ro-1", email="ro@example.com"
        )
        self.subject = Subject.objects.create(name="Databases")
        req = _make_request_with_accepted_tutor(
            self.tutee, self.tutor, self.subject
        )
        self.session = Session.objects.create(
            session_type="one_on_one",
            request=req,
            completed_at=timezone.now(),
        )
        self.url = reverse("session-review-create", args=[self.session.id])

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def _payload(self, **overrides):
        data = {"reviewee": self.tutor.id, "rating": 5, "text": "Great"}
        data.update(overrides)
        return data

    def test_anonymous_rejected(self):
        response = self.client.post(self.url, self._payload())
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_outsider_cannot_review(self):
        self._login(self.outsider)
        response = self.client.post(self.url, self._payload())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tutee_can_review_tutor(self):
        self._login(self.tutee)
        response = self.client.post(self.url, self._payload())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Review.objects.filter(
                session=self.session, reviewer=self.tutee, reviewee=self.tutor
            ).exists()
        )

    def test_cannot_review_self(self):
        self._login(self.tutee)
        response = self.client.post(
            self.url, self._payload(reviewee=self.tutee.id)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_review_twice(self):
        self._login(self.tutee)
        first = self.client.post(self.url, self._payload())
        second = self.client.post(self.url, self._payload(rating=3))
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_incomplete_session_rejected(self):
        self.session.completed_at = None
        self.session.save(update_fields=["completed_at"])
        self._login(self.tutee)
        response = self.client.post(self.url, self._payload())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rating_out_of_range_rejected(self):
        self._login(self.tutee)
        response = self.client.post(self.url, self._payload(rating=6))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserReviewsTests(APITestCase):
    """
    GET /api/users/{id}/reviews/
    """

    def setUp(self):
        self.tutor = User.objects.create_user(
            username="ututor", password="pass-ut-1", email="ut@example.com"
        )
        self.tutee = User.objects.create_user(
            username="ututee", password="pass-uu-1", email="uu@example.com"
        )
        self.subject = Subject.objects.create(name="Web")
        req = _make_request_with_accepted_tutor(
            self.tutee, self.tutor, self.subject
        )
        self.session = Session.objects.create(
            session_type="one_on_one",
            request=req,
            completed_at=timezone.now(),
        )
        Review.objects.create(
            session=self.session,
            reviewer=self.tutee,
            reviewee=self.tutor,
            rating=5,
            text="Great tutor",
        )
        self.url = reverse("user-reviews", args=[self.tutor.id])

    def test_returns_reviews_and_aggregate(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["average_rating"], 5.0)
        self.assertEqual(len(response.data["reviews"]), 1)

    def test_empty_for_user_without_reviews(self):
        response = self.client.get(reverse("user-reviews", args=[self.tutee.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)
        self.assertIsNone(response.data["average_rating"])
        
class SessionListTests(APITestCase):
    """
    GET /api/sessions/

    Invariants:
      - Anonymous gets 401.
      - A user sees 1:1 sessions where they are the tutee or the accepted tutor.
      - A user sees broadcast sessions where they are the tutor or a participant.
      - A user does not see sessions they are not a party to.
      - Filtering by ?type= works.
      - `other_parties` excludes the requester.
    """

    def setUp(self):
        self.tutor = User.objects.create_user(
            username="tutor", password="pass-t-1", email="t@example.com"
        )
        self.tutee = User.objects.create_user(
            username="tutee", password="pass-u-1", email="u@example.com"
        )
        self.outsider = User.objects.create_user(
            username="outsider", password="pass-o-1", email="o@example.com"
        )
        self.subject = Subject.objects.create(name="Python")

        self.req = _make_request_with_accepted_tutor(
            self.tutee, self.tutor, self.subject
        )
        self.one_on_one = Session.objects.create(
            session_type="one_on_one",
            request=self.req,
            completed_at=timezone.now(),
            marked_by=self.tutor,
        )

        self.broadcast = Broadcast.objects.create(
            tutor=self.tutor,
            subject=self.subject,
            title="Sorting",
            scheduled_at=timezone.now() - timedelta(hours=2),
            room_url="https://whereby.example/room",
        )
        BroadcastParticipant.objects.create(
            broadcast=self.broadcast, user=self.tutee
        )
        self.broadcast_session = Session.objects.create(
            session_type="broadcast",
            broadcast=self.broadcast,
            completed_at=timezone.now(),
            marked_by=self.tutor,
        )

        self.url = reverse("session-list")

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_rejected(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tutee_sees_one_on_one(self):
        self._login(self.tutee)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in response.data["results"]]
        self.assertIn(self.one_on_one.id, ids)

    def test_tutor_sees_one_on_one(self):
        self._login(self.tutor)
        response = self.client.get(self.url)
        ids = [row["id"] for row in response.data["results"]]
        self.assertIn(self.one_on_one.id, ids)

    def test_participant_sees_broadcast(self):
        self._login(self.tutee)
        response = self.client.get(self.url)
        ids = [row["id"] for row in response.data["results"]]
        self.assertIn(self.broadcast_session.id, ids)

    def test_outsider_sees_nothing(self):
        self._login(self.outsider)
        response = self.client.get(self.url)
        self.assertEqual(response.data["count"], 0)

    def test_type_filter(self):
        self._login(self.tutee)
        response = self.client.get(self.url, {"type": "one_on_one"})
        ids = [row["id"] for row in response.data["results"]]
        self.assertEqual(ids, [self.one_on_one.id])

    def test_other_parties_excludes_requester(self):
        self._login(self.tutee)
        response = self.client.get(self.url, {"type": "one_on_one"})
        row = response.data["results"][0]
        other_ids = [u["id"] for u in row["other_parties"]]
        self.assertNotIn(self.tutee.id, other_ids)
        self.assertIn(self.tutor.id, other_ids)


class SessionDetailTests(APITestCase):
    """
    GET /api/sessions/{id}/

    Invariants:
      - Anonymous gets 401.
      - A party can view.
      - An outsider gets 404 (queryset filters it out).
      - source_link points at the request or broadcast.
    """

    def setUp(self):
        self.tutor = User.objects.create_user(
            username="tutor", password="pass-t-1", email="t@example.com"
        )
        self.tutee = User.objects.create_user(
            username="tutee", password="pass-u-1", email="u@example.com"
        )
        self.outsider = User.objects.create_user(
            username="outsider", password="pass-o-1", email="o@example.com"
        )
        self.subject = Subject.objects.create(name="Python")
        req = _make_request_with_accepted_tutor(
            self.tutee, self.tutor, self.subject
        )
        self.session = Session.objects.create(
            session_type="one_on_one",
            request=req,
            completed_at=timezone.now(),
            marked_by=self.tutor,
        )
        self.url = reverse("session-detail", args=[self.session.id])

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_rejected(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_party_can_view(self):
        self._login(self.tutee)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["source_link"], f"/requests/{self.session.request_id}"
        )

    def test_outsider_gets_404(self):
        self._login(self.outsider)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)