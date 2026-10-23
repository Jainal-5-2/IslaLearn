from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.topics.models import Subject

from .models import Application, Request

User = get_user_model()


class RequestFlowTests(APITestCase):
    """
    Covers the write side of the Requests flow:
      - Create, apply, accept, reject, close.
      - Guard rails: no self-apply, no double-apply, no apply to closed,
        no editing after applications exist, no editing after close.
      - Accepting one application rejects the rest and closes the request.
      - Pending applications are rejected when the owner closes manually.
    """

    def setUp(self):
        self.tutee = User.objects.create_user(
            username="tutee", password="pass-tutee-1", email="tutee@example.com"
        )
        self.tutor_a = User.objects.create_user(
            username="tutor_a", password="pass-a", email="a@example.com"
        )
        self.tutor_b = User.objects.create_user(
            username="tutor_b", password="pass-b", email="b@example.com"
        )
        self.other = User.objects.create_user(
            username="other", password="pass-o", email="o@example.com"
        )
        self.subject_python = Subject.objects.create(name="Python")
        self.subject_sql = Subject.objects.create(name="SQL")

        self.list_url = reverse("request-list")
        self.create_url = reverse("request-list")

        self.request = Request.objects.create(
            tutee=self.tutee,
            subject=self.subject_python,
            description="Help with decorators please.",
            status="open",
        )

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def _apply(self, tutor, message="I can help."):
        self._login(tutor)
        return self.client.post(
            reverse("request-apply", args=[self.request.id]),
            {"message": message},
        )

    def test_create_request_returns_detail_shape(self):
        self._login(self.tutee)
        response = self.client.post(
            self.create_url,
            {
                "subject": self.subject_python.id,
                "description": "Need help with list comprehensions.",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["tutee"]["id"], self.tutee.id)
        self.assertEqual(response.data["subject"]["id"], self.subject_python.id)
        self.assertEqual(response.data["status"], "open")
        self.assertEqual(response.data["applications"], [])
        
    def test_create_request_rejects_empty_description(self):
        self._login(self.tutee)
        response = self.client.post(
            self.create_url,
            {"subject": self.subject_python.id, "description": "   "},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ---------- Apply ----------

    def test_tutor_can_apply(self):
        response = self._apply(self.tutor_a)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            Application.objects.filter(
                request=self.request, tutor=self.tutor_a
            ).count(),
            1,
        )

    def test_cannot_apply_to_own_request(self):
        self._login(self.tutee)
        response = self.client.post(
            reverse("request-apply", args=[self.request.id]),
            {"message": "Applying to myself."},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_apply_to_closed_request(self):
        self.request.status = "closed"
        self.request.save(update_fields=["status"])
        response = self._apply(self.tutor_a)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_apply_twice(self):
        first = self._apply(self.tutor_a)
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        second = self._apply(self.tutor_a, message="Again.")
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_apply_rejects_empty_message(self):
        self._login(self.tutor_a)
        response = self.client.post(
            reverse("request-apply", args=[self.request.id]),
            {"message": "   "},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ---------- Accept / Reject ----------

    def test_accepting_one_rejects_others_and_closes_request(self):
        self._apply(self.tutor_a)
        self._apply(self.tutor_b)

        app_a = Application.objects.get(request=self.request, tutor=self.tutor_a)
        self._login(self.tutee)
        response = self.client.patch(
            reverse("application-decision", args=[app_a.id]),
            {"status": "accepted"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        app_a.refresh_from_db()
        app_b = Application.objects.get(request=self.request, tutor=self.tutor_b)
        self.request.refresh_from_db()

        self.assertEqual(app_a.status, "accepted")
        self.assertEqual(app_b.status, "rejected")
        self.assertEqual(self.request.status, "closed")

    def test_rejecting_one_keeps_request_open(self):
        self._apply(self.tutor_a)
        app_a = Application.objects.get(request=self.request, tutor=self.tutor_a)

        self._login(self.tutee)
        response = self.client.patch(
            reverse("application-decision", args=[app_a.id]),
            {"status": "rejected"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, "open")

    def test_only_owner_can_decide(self):
        self._apply(self.tutor_a)
        app_a = Application.objects.get(request=self.request, tutor=self.tutor_a)

        self._login(self.tutor_a)
        response = self.client.patch(
            reverse("application-decision", args=[app_a.id]),
            {"status": "accepted"},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cannot_decide_twice(self):
        self._apply(self.tutor_a)
        app_a = Application.objects.get(request=self.request, tutor=self.tutor_a)

        self._login(self.tutee)
        first = self.client.patch(
            reverse("application-decision", args=[app_a.id]),
            {"status": "accepted"},
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)

        second = self.client.patch(
            reverse("application-decision", args=[app_a.id]),
            {"status": "rejected"},
        )
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_decision_requires_valid_status(self):
        self._apply(self.tutor_a)
        app_a = Application.objects.get(request=self.request, tutor=self.tutor_a)

        self._login(self.tutee)
        response = self.client.patch(
            reverse("application-decision", args=[app_a.id]),
            {"status": "maybe"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ---------- Close ----------

    def test_owner_can_close_open_request_and_pending_are_rejected(self):
        self._apply(self.tutor_a)
        self._apply(self.tutor_b)

        self._login(self.tutee)
        response = self.client.post(
            reverse("request-close", args=[self.request.id])
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.request.refresh_from_db()
        self.assertEqual(self.request.status, "closed")
        self.assertEqual(
            Application.objects.filter(
                request=self.request, status="pending"
            ).count(),
            0,
        )
        self.assertEqual(
            Application.objects.filter(
                request=self.request, status="rejected"
            ).count(),
            2,
        )

    def test_non_owner_cannot_close(self):
        self._login(self.tutor_a)
        response = self.client.post(
            reverse("request-close", args=[self.request.id])
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cannot_close_already_closed_request(self):
        self.request.status = "closed"
        self.request.save(update_fields=["status"])

        self._login(self.tutee)
        response = self.client.post(
            reverse("request-close", args=[self.request.id])
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ---------- Edit ----------

    def test_subject_locked_after_first_application(self):
        self._apply(self.tutor_a)

        self._login(self.tutee)
        response = self.client.patch(
            reverse("request-detail", args=[self.request.id]),
            {"subject": self.subject_sql.id},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_owner_can_edit_description_when_open(self):
        self._login(self.tutee)
        response = self.client.patch(
            reverse("request-detail", args=[self.request.id]),
            {"description": "Updated description."},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["description"], "Updated description.")

    def test_non_owner_cannot_edit(self):
        self._login(self.tutor_a)
        response = self.client.patch(
            reverse("request-detail", args=[self.request.id]),
            {"description": "Hijack attempt."},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cannot_edit_closed_request(self):
        self.request.status = "closed"
        self.request.save(update_fields=["status"])

        self._login(self.tutee)
        response = self.client.patch(
            reverse("request-detail", args=[self.request.id]),
            {"description": "Edited after close."},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class RequestListBrowseTests(APITestCase):
    """
    Covers the read side of the Requests list: default filters, the
    `mine` query param, and subject filtering.
    """

    def setUp(self):
        self.tutee = User.objects.create_user(
            username="tutee", password="pass-tutee-1", email="tutee@example.com"
        )
        self.other = User.objects.create_user(
            username="other", password="pass-o", email="o@example.com"
        )
        self.subject_python = Subject.objects.create(name="Python")
        self.subject_sql = Subject.objects.create(name="SQL")

        self.own_request = Request.objects.create(
            tutee=self.tutee,
            subject=self.subject_python,
            description="Mine.",
        )
        self.other_request = Request.objects.create(
            tutee=self.other,
            subject=self.subject_sql,
            description="Someone else's.",
        )

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_browse_excludes_own_requests(self):
        self._login(self.tutee)
        response = self.client.get(reverse("request-list"), {"status": "open"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in response.data["results"]]
        self.assertNotIn(self.own_request.id, ids)
        self.assertIn(self.other_request.id, ids)

    def test_mine_returns_own_requests(self):
        self._login(self.tutee)
        response = self.client.get(
            reverse("request-list"), {"mine": "true", "status": "open"}
        )
        ids = [row["id"] for row in response.data["results"]]
        self.assertEqual(ids, [self.own_request.id])

    def test_subject_filter(self):
        self._login(self.tutee)
        response = self.client.get(
            reverse("request-list"),
            {"status": "open", "subject": self.subject_sql.id},
        )
        ids = [row["id"] for row in response.data["results"]]
        self.assertEqual(ids, [self.other_request.id])

    def test_anonymous_is_rejected(self):
        response = self.client.get(reverse("request-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)