from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Subject, Topic, TopicPage, TopicProgress

User = get_user_model()


class TopicProgressTests(APITestCase):
    """
    Covers the POST /api/topics/{id}/progress/ endpoint.

    Invariants:
      - The topic owner cannot write progress on their own topic.
      - Anonymous users get 401.
      - last_page_index is clamped into the topic's page range.
      - completed_at is set once last_page_index reaches the last page,
        and is not cleared on subsequent calls.
      - Repeated calls update the same row, never create a second one.
    """

    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner", password="pass-owner-1", email="owner@example.com"
        )
        self.reader = User.objects.create_user(
            username="reader", password="pass-reader-1", email="reader@example.com"
        )
        self.subject = Subject.objects.create(name="Python")

        self.topic = Topic.objects.create(
            subject=self.subject,
            created_by=self.owner,
            title="Test topic",
            is_published=True,
            free_page_count=2,
        )
        for i in range(1, 6):
            TopicPage.objects.create(
                topic=self.topic,
                order=i,
                page_type="text",
                content={"body": f"Page {i}"},
            )

        self.url = reverse("topic-progress", args=[self.topic.id])

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_is_rejected(self):
        response = self.client.post(self.url, {"last_page_index": 0})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_owner_cannot_write_progress(self):
        self._login(self.owner)
        response = self.client.post(self.url, {"last_page_index": 0})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unpublished_topic_is_rejected(self):
        self.topic.is_published = False
        self.topic.save(update_fields=["is_published"])
        self._login(self.reader)
        response = self.client.post(self.url, {"last_page_index": 0})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_missing_last_page_index_is_rejected(self):
        self._login(self.reader)
        response = self.client.post(self.url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_negative_last_page_index_is_rejected(self):
        self._login(self.reader)
        response = self.client.post(self.url, {"last_page_index": -1})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_first_progress_creates_row(self):
        self._login(self.reader)
        response = self.client.post(self.url, {"last_page_index": 0})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["last_page_index"], 0)
        self.assertFalse(response.data["is_completed"])

        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertEqual(progress.last_page_index, 0)
        self.assertIsNone(progress.completed_at)

    def test_repeated_calls_update_same_row(self):
        self._login(self.reader)
        self.client.post(self.url, {"last_page_index": 1})
        self.client.post(self.url, {"last_page_index": 3})
        self.assertEqual(
            TopicProgress.objects.filter(user=self.reader, topic=self.topic).count(),
            1,
        )
        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertEqual(progress.last_page_index, 3)

    def test_out_of_range_last_page_index_is_clamped(self):
        self._login(self.reader)
        response = self.client.post(self.url, {"last_page_index": 999})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertEqual(progress.last_page_index, 4)
        self.assertTrue(response.data["is_completed"])

    def test_reaching_last_page_sets_completed_at(self):
        self._login(self.reader)
        response = self.client.post(self.url, {"last_page_index": 4})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertIsNotNone(progress.completed_at)
        self.assertTrue(response.data["is_completed"])

    def test_completed_at_is_not_cleared_on_regression(self):
        self._login(self.reader)
        self.client.post(self.url, {"last_page_index": 4})
        first_completed_at = TopicProgress.objects.get(
            user=self.reader, topic=self.topic
        ).completed_at
        self.assertIsNotNone(first_completed_at)

        self.client.post(self.url, {"last_page_index": 1})
        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertEqual(progress.last_page_index, 1)
        self.assertEqual(progress.completed_at, first_completed_at)


class TopicDetailProgressTests(APITestCase):
    """
    Verifies that TopicDetailSerializer embeds the correct progress object
    per requesting user.

    Invariants:
      - Anonymous users get progress: null.
      - The topic owner gets progress: null.
      - A reader who has never opened the topic gets progress: null.
      - A reader with progress gets the row inline.
    """

    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner2", password="pass-owner-2", email="owner2@example.com"
        )
        self.reader = User.objects.create_user(
            username="reader2", password="pass-reader-2", email="reader2@example.com"
        )
        self.subject = Subject.objects.create(name="Data Structures")
        self.topic = Topic.objects.create(
            subject=self.subject,
            created_by=self.owner,
            title="Detail topic",
            is_published=True,
        )
        for i in range(1, 4):
            TopicPage.objects.create(
                topic=self.topic,
                order=i,
                page_type="text",
                content={"body": f"Page {i}"},
            )
        self.url = reverse("topic-detail", args=[self.topic.id])

    def test_anonymous_gets_null_progress(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["progress"])

    def test_owner_gets_null_progress(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["progress"])

    def test_reader_without_progress_gets_null(self):
        self.client.force_authenticate(user=self.reader)
        response = self.client.get(self.url)
        self.assertIsNone(response.data["progress"])

    def test_reader_with_progress_gets_object(self):
        TopicProgress.objects.create(
            user=self.reader, topic=self.topic, last_page_index=1
        )
        self.client.force_authenticate(user=self.reader)
        response = self.client.get(self.url)
        self.assertIsNotNone(response.data["progress"])
        self.assertEqual(response.data["progress"]["last_page_index"], 1)
        self.assertFalse(response.data["progress"]["is_completed"])


class TopicPageLockTests(APITestCase):
    """
    Locks in the fix from earlier: locked pages must not leak content
    through the list endpoint or the detail endpoint, for any viewer
    who is not the topic owner.
    """

    def setUp(self):
        self.owner = User.objects.create_user(
            username="lockowner", password="pass-lo-1", email="lo@example.com"
        )
        self.reader = User.objects.create_user(
            username="lockreader", password="pass-lr-1", email="lr@example.com"
        )
        self.subject = Subject.objects.create(name="Algorithms")
        self.topic = Topic.objects.create(
            subject=self.subject,
            created_by=self.owner,
            title="Lock topic",
            is_published=True,
            free_page_count=2,
        )
        for i in range(1, 5):
            TopicPage.objects.create(
                topic=self.topic,
                order=i,
                page_type="text",
                content={"body": f"Secret {i}"},
            )
        self.list_url = reverse("topic-page-list", args=[self.topic.id])
        self.page3 = TopicPage.objects.get(topic=self.topic, order=3)
        self.detail_url = reverse(
            "topic-page-detail", args=[self.topic.id, self.page3.id]
        )

    def test_list_endpoint_strips_locked_content_for_reader(self):
        self.client.force_authenticate(user=self.reader)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        by_order = {p["order"]: p for p in response.data["results"]}
        # Pages 1 and 2 are free.
        self.assertEqual(by_order[1]["content"], {"body": "Secret 1"})
        self.assertFalse(by_order[1]["is_locked"])
        # Pages 3 and 4 are locked: content stripped, flag set.
        self.assertEqual(by_order[3]["content"], {})
        self.assertTrue(by_order[3]["is_locked"])
        self.assertEqual(by_order[4]["content"], {})
        self.assertTrue(by_order[4]["is_locked"])

    def test_list_endpoint_shows_all_content_to_owner(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for page in response.data["results"]:
            self.assertFalse(page["is_locked"])
            self.assertTrue(page["content"])  # non-empty
            
    def test_detail_endpoint_strips_locked_content_for_reader(self):
        self.client.force_authenticate(user=self.reader)
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_locked"])
        self.assertEqual(response.data["content"], {})

    def test_detail_endpoint_shows_content_to_owner(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_locked"])
        self.assertEqual(response.data["content"], {"body": "Secret 3"})
        
    def test_backward_navigation_does_not_lower_last_page_index(self):
        self._login(self.reader)
        self.client.post(self.url, {"last_page_index": 3})
        # Navigate backward to page 1. Monotonic: stays at 3.
        response = self.client.post(self.url, {"last_page_index": 1})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["last_page_index"], 3)
        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertEqual(progress.last_page_index, 3)

    def test_reset_lowers_last_page_index_and_clears_completion(self):
        self._login(self.reader)
        self.client.post(self.url, {"last_page_index": 4})
        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertTrue(progress.is_completed)
        self.assertIsNotNone(progress.completed_at)

        response = self.client.post(
            self.url, {"last_page_index": 0, "reset": True}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["last_page_index"], 0)
        self.assertFalse(response.data["is_completed"])
        self.assertIsNone(response.data["completed_at"])

        progress.refresh_from_db()
        self.assertEqual(progress.last_page_index, 0)
        self.assertFalse(progress.is_completed)
        self.assertIsNone(progress.completed_at)