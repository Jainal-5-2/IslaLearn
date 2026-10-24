from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.broadcasts.models import Broadcast
from apps.topics.models import Subject, Topic

from .models import Report

User = get_user_model()


class ReportCreateTests(APITestCase):
    """
    POST /api/reports/

    Invariants:
      - Anonymous gets 401.
      - Reporting a user with a valid category succeeds.
      - Self-report is rejected.
      - Exactly one target is required: zero targets, or two, both 400.
      - Unknown target id is 400, not 500.
      - Category not in the enum is 400.
      - reason is optional for non-"other" categories.
      - reason is required for the "other" category.
      - Response shape includes id, reporter, category, created_at.
    """

    def setUp(self):
        self.reporter = User.objects.create_user(
            username="reporter", password="pass-r1", email="r1@example.com"
        )
        self.target_user = User.objects.create_user(
            username="target", password="pass-t1", email="t1@example.com"
        )
        self.subject = Subject.objects.create(name="Python")
        self.topic = Topic.objects.create(
            subject=self.subject,
            created_by=self.target_user,
            title="Topic",
            is_published=True,
        )
        self.broadcast = Broadcast.objects.create(
            tutor=self.target_user,
            subject=self.subject,
            title="Broadcast",
            room_url="https://whereby.example/room",
            scheduled_at="2030-01-01T00:00:00Z",
        )
        self.url = reverse("report-create")

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def _payload(self, **overrides):
        data = {
            "target_user": self.target_user.id,
            "category": "spam",
        }
        data.update(overrides)
        return data

    def test_anonymous_rejected(self):
        response = self.client.post(self.url, self._payload())
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_report_user_succeeds(self):
        self._login(self.reporter)
        response = self.client.post(self.url, self._payload())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["category"], "spam")
        self.assertEqual(response.data["reporter"], "reporter")
        self.assertEqual(response.data["target_user"], self.target_user.id)

        report = Report.objects.get(id=response.data["id"])
        self.assertEqual(report.reporter_id, self.reporter.id)
        self.assertEqual(report.target_user_id, self.target_user.id)
        self.assertIsNone(report.target_topic_id)
        self.assertIsNone(report.target_broadcast_id)

    def test_cannot_report_self(self):
        self._login(self.reporter)
        response = self.client.post(
            self.url, self._payload(target_user=self.reporter.id)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("target_user", response.data)

    def test_no_target_rejected(self):
        self._login(self.reporter)
        response = self.client.post(
            self.url, {"category": "spam"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_two_targets_rejected(self):
        self._login(self.reporter)
        response = self.client.post(
            self.url,
            {
                "target_user": self.target_user.id,
                "target_topic": self.topic.id,
                "category": "spam",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unknown_target_rejected(self):
        self._login(self.reporter)
        response = self.client.post(
            self.url, self._payload(target_user=999999)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_category_rejected(self):
        self._login(self.reporter)
        response = self.client.post(
            self.url, self._payload(category="not-a-category")
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reason_optional_for_non_other(self):
        self._login(self.reporter)
        response = self.client.post(self.url, self._payload(category="spam"))
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_reason_required_for_other(self):
        self._login(self.reporter)
        response = self.client.post(
            self.url, self._payload(category="other", reason="")
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reason", response.data)

    def test_reason_accepted_for_other(self):
        self._login(self.reporter)
        response = self.client.post(
            self.url,
            self._payload(category="other", reason="Something specific"),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_report_topic_succeeds(self):
        self._login(self.reporter)
        response = self.client.post(
            self.url,
            {
                "target_topic": self.topic.id,
                "category": "inappropriate",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        report = Report.objects.get(id=response.data["id"])
        self.assertEqual(report.target_topic_id, self.topic.id)
        self.assertIsNone(report.target_user_id)

    def test_report_broadcast_succeeds(self):
        self._login(self.reporter)
        response = self.client.post(
            self.url,
            {
                "target_broadcast": self.broadcast.id,
                "category": "harassment",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        report = Report.objects.get(id=response.data["id"])
        self.assertEqual(report.target_broadcast_id, self.broadcast.id)