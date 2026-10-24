from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.topics.models import Subject

from . import whereby
from .models import Broadcast, BroadcastParticipant

User = get_user_model()


class BroadcastCreateTests(APITestCase):
    """
    Covers POST /api/broadcasts/.

    Invariants:
      - Anonymous users get 401.
      - The tutor is set from request.user, not from the payload.
      - A successful create calls whereby.create_room once and stores
        the returned URL.
      - A Whereby failure rolls back the row (no Broadcast is created).
      - scheduled_at in the past is rejected.
      - capacity < 1 is rejected.
    """

    def setUp(self):
        self.tutor = User.objects.create_user(
            username="tutor", password="pass-tutor-1", email="t@example.com"
        )
        self.subject = Subject.objects.create(name="Python")
        self.url = reverse("broadcast-list")

    def _payload(self, **overrides):
        data = {
            "subject": self.subject.id,
            "title": "Intro to decorators",
            "description": "We will look at function decorators.",
            "scheduled_at": (timezone.now() + timedelta(days=1)).isoformat(),
            "duration_minutes": 30,
            "capacity": 10,
        }
        data.update(overrides)
        return data

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_cannot_create(self):
        response = self.client.post(self.url, self._payload())
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("apps.broadcasts.views.whereby.create_room")
    def test_create_stores_room_url(self, mock_create):
        mock_create.return_value = "https://whereby.example/room"
        self._login(self.tutor)
        response = self.client.post(self.url, self._payload())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["tutor"]["id"], self.tutor.id)

        broadcast = Broadcast.objects.get(id=response.data["id"])
        self.assertEqual(broadcast.room_url, "https://whereby.example/room")
        self.assertEqual(broadcast.room_provider, "whereby")
        self.assertFalse(broadcast.is_cancelled)
        mock_create.assert_called_once()

    @patch("apps.broadcasts.views.whereby.create_room")
    def test_whereby_failure_rolls_back(self, mock_create):
        mock_create.side_effect = whereby.WherebyError("nope")
        self._login(self.tutor)
        response = self.client.post(self.url, self._payload())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Broadcast.objects.count(), 0)

    def test_past_scheduled_at_rejected(self):
        self._login(self.tutor)
        response = self.client.post(
            self.url,
            self._payload(
                scheduled_at=(timezone.now() - timedelta(hours=1)).isoformat()
            ),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_zero_capacity_rejected(self):
        self._login(self.tutor)
        response = self.client.post(self.url, self._payload(capacity=0))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class BroadcastJoinLeaveTests(APITestCase):
    """
    Covers POST /join/ and DELETE /leave/.

    Invariants:
      - Anonymous users get 401.
      - The tutor cannot join their own broadcast.
      - Joining creates exactly one participant row.
      - Joining twice is idempotent (still one row, 200 both times).
      - Joining a full broadcast returns 400.
      - Joining a cancelled broadcast returns 400.
      - Leaving removes the row; leaving again is a no-op 204.
    """

    def setUp(self):
        self.tutor = User.objects.create_user(
            username="tutor2", password="pass-tutor-2", email="t2@example.com"
        )
        self.tutee = User.objects.create_user(
            username="tutee", password="pass-tutee-1", email="te@example.com"
        )
        self.other = User.objects.create_user(
            username="other", password="pass-other-1", email="o@example.com"
        )
        self.subject = Subject.objects.create(name="Algorithms")
        self.broadcast = Broadcast.objects.create(
            tutor=self.tutor,
            subject=self.subject,
            title="Sorting",
            description="",
            scheduled_at=timezone.now() + timedelta(days=1),
            capacity=1,
            room_url="https://whereby.example/room",
        )
        self.join_url = reverse("broadcast-join", args=[self.broadcast.id])
        self.leave_url = reverse("broadcast-leave", args=[self.broadcast.id])

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_cannot_join(self):
        response = self.client.post(self.join_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tutor_cannot_join_own_broadcast(self):
        self._login(self.tutor)
        response = self.client.post(self.join_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_join_creates_participant(self):
        self._login(self.tutee)
        response = self.client.post(self.join_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            BroadcastParticipant.objects.filter(
                broadcast=self.broadcast, user=self.tutee
            ).exists()
        )

    def test_join_twice_is_idempotent(self):
        self._login(self.tutee)
        first = self.client.post(self.join_url)
        second = self.client.post(self.join_url)
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(
            BroadcastParticipant.objects.filter(
                broadcast=self.broadcast, user=self.tutee
            ).count(),
            1,
        )

    def test_join_full_broadcast_rejected(self):
        # capacity=1; fill the only slot.
        BroadcastParticipant.objects.create(
            broadcast=self.broadcast, user=self.tutee
        )
        self._login(self.other)
        response = self.client.post(self.join_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_join_cancelled_broadcast_rejected(self):
        self.broadcast.is_cancelled = True
        self.broadcast.save(update_fields=["is_cancelled"])
        self._login(self.tutee)
        response = self.client.post(self.join_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_leave_removes_participant(self):
        BroadcastParticipant.objects.create(
            broadcast=self.broadcast, user=self.tutee
        )
        self._login(self.tutee)
        response = self.client.delete(self.leave_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            BroadcastParticipant.objects.filter(
                broadcast=self.broadcast, user=self.tutee
            ).exists()
        )

    def test_leave_when_not_joined_is_noop(self):
        self._login(self.tutee)
        response = self.client.delete(self.leave_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


class BroadcastRoomUrlTests(APITestCase):
    """
    Covers GET /room-url/.

    Invariants:
      - Anonymous users get 401.
      - The tutor gets the URL.
      - A joined participant gets the URL.
      - A non-participant gets 403.
      - A cancelled broadcast returns 400.
    """

    def setUp(self):
        self.tutor = User.objects.create_user(
            username="tutor3", password="pass-tutor-3", email="t3@example.com"
        )
        self.tutee = User.objects.create_user(
            username="tutee3", password="pass-tutee-3", email="te3@example.com"
        )
        self.outsider = User.objects.create_user(
            username="outsider", password="pass-out-1", email="out@example.com"
        )
        self.subject = Subject.objects.create(name="Databases")
        self.broadcast = Broadcast.objects.create(
            tutor=self.tutor,
            subject=self.subject,
            title="Indexes",
            description="",
            scheduled_at=timezone.now() + timedelta(days=1),
            room_url="https://whereby.example/room",
        )
        BroadcastParticipant.objects.create(
            broadcast=self.broadcast, user=self.tutee
        )
        self.url = reverse("broadcast-room-url", args=[self.broadcast.id])

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_rejected(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tutor_gets_url(self):
        self._login(self.tutor)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["room_url"], "https://whereby.example/room")

    def test_participant_gets_url(self):
        self._login(self.tutee)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_outsider_gets_403(self):
        self._login(self.outsider)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cancelled_broadcast_rejected(self):
        self.broadcast.is_cancelled = True
        self.broadcast.save(update_fields=["is_cancelled"])
        self._login(self.tutor)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class BroadcastCancelTests(APITestCase):
    """
    Covers POST /cancel/.

    Invariants:
      - Anonymous users get 401.
      - Only the tutor can cancel.
      - Cancelling twice returns 400.
      - Cancelled broadcasts are hidden from the list.
    """

    def setUp(self):
        self.tutor = User.objects.create_user(
            username="tutor4", password="pass-tutor-4", email="t4@example.com"
        )
        self.other = User.objects.create_user(
            username="other4", password="pass-other-4", email="o4@example.com"
        )
        self.subject = Subject.objects.create(name="Networks")
        self.broadcast = Broadcast.objects.create(
            tutor=self.tutor,
            subject=self.subject,
            title="TCP",
            description="",
            scheduled_at=timezone.now() + timedelta(days=1),
            room_url="https://whereby.example/room",
        )
        self.cancel_url = reverse("broadcast-cancel", args=[self.broadcast.id])

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_rejected(self):
        response = self.client.post(self.cancel_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_tutor_rejected(self):
        self._login(self.other)
        response = self.client.post(self.cancel_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_tutor_can_cancel(self):
        self._login(self.tutor)
        response = self.client.post(self.cancel_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.broadcast.refresh_from_db()
        self.assertTrue(self.broadcast.is_cancelled)

    def test_cancel_twice_rejected(self):
        self.broadcast.is_cancelled = True
        self.broadcast.save(update_fields=["is_cancelled"])
        self._login(self.tutor)
        response = self.client.post(self.cancel_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancelled_hidden_from_list(self):
        self.broadcast.is_cancelled = True
        self.broadcast.save(update_fields=["is_cancelled"])
        response = self.client.get(reverse("broadcast-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in response.data["results"]]
        self.assertNotIn(self.broadcast.id, ids)