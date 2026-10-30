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
      - last_page_index is monotonic: backward navigation never lowers it.
      - last_page_index may not jump more than one page at a time when
        reset=false. reset=true bypasses the jump guard.
      - reset=true clears is_completed / completed_at.
      - is_completed flips True once last_page_index reaches the last page.
      - completed_at is set on the False -> True transition and is not
        cleared by monotonic writes afterward.
      - Repeated calls update the same row, never create a second one.
      - Progress writes never touch is_unlocked.
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

    def _walk_up_to(self, index):
        """Write progress 0..index one page at a time, satistying the guard."""
        for i in range(index + 1):
            response = self.client.post(self.url, {"last_page_index": i})
            assert response.status_code == status.HTTP_200_OK, (
                f"step {i} failed: {response.data}"
            )

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
        self.assertFalse(response.data["is_unlocked"])

        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertEqual(progress.last_page_index, 0)
        self.assertIsNone(progress.completed_at)

    def test_repeated_calls_update_same_row(self):
        self._login(self.reader)
        self.client.post(self.url, {"last_page_index": 0})
        self.client.post(self.url, {"last_page_index": 1})
        self.client.post(self.url, {"last_page_index": 2})
        self.assertEqual(
            TopicProgress.objects.filter(user=self.reader, topic=self.topic).count(),
            1,
        )
        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertEqual(progress.last_page_index, 2)

    def test_out_of_range_last_page_index_is_clamped(self):
        self._login(self.reader)
        # reset=true bypasses the jump guard, so the clamp can be tested
        # on its own.
        response = self.client.post(
            self.url, {"last_page_index": 999, "reset": True}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertEqual(progress.last_page_index, 4)
        self.assertTrue(response.data["is_completed"])

    def test_reaching_last_page_sets_completed_at(self):
        self._login(self.reader)
        self._walk_up_to(4)
        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertEqual(progress.last_page_index, 4)
        self.assertIsNotNone(progress.completed_at)
        self.assertTrue(progress.is_completed)

    def test_backward_navigation_does_not_lower_last_page_index(self):
        self._login(self.reader)
        self._walk_up_to(3)
        # Navigate backward to page 1. Monotonic: stays at 3.
        response = self.client.post(self.url, {"last_page_index": 1})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["last_page_index"], 3)
        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertEqual(progress.last_page_index, 3)

    def test_completed_at_survives_monotonic_write(self):
        self._login(self.reader)
        self._walk_up_to(4)
        first_completed_at = TopicProgress.objects.get(
            user=self.reader, topic=self.topic
        ).completed_at
        self.assertIsNotNone(first_completed_at)

        # A lower write is clamped up to the high-water mark, so completion
        # cannot be lost by navigating backward.
        response = self.client.post(self.url, {"last_page_index": 1})
        self.assertEqual(response.data["last_page_index"], 4)
        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertEqual(progress.last_page_index, 4)
        self.assertTrue(progress.is_completed)
        self.assertEqual(progress.completed_at, first_completed_at)

    def test_reset_lowers_last_page_index_and_clears_completion(self):
        self._login(self.reader)
        self._walk_up_to(4)
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

    def test_progress_does_not_change_is_unlocked(self):
        self._login(self.reader)
        self._walk_up_to(3)
        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertFalse(progress.is_unlocked)

    # ---------- Jump guard ----------

    def test_cannot_jump_more_than_one_page(self):
        self._login(self.reader)
        self.client.post(self.url, {"last_page_index": 0})
        # Attempt to skip from page 1 (index 0) to page 5 (index 4).
        response = self.client.post(self.url, {"last_page_index": 4})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertEqual(progress.last_page_index, 0)

    def test_sequential_writes_are_allowed(self):
        self._login(self.reader)
        for index in range(5):
            response = self.client.post(self.url, {"last_page_index": index})
            self.assertEqual(response.status_code, status.HTTP_200_OK)
        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertEqual(progress.last_page_index, 4)

    def test_reset_can_jump_anywhere(self):
        self._login(self.reader)
        self._walk_up_to(4)
        response = self.client.post(
            self.url, {"last_page_index": 0, "reset": True}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertEqual(progress.last_page_index, 0)

    def test_walk_from_high_water_mark_to_last_page_flips_completion(self):
        """
        Regression for the reader's finish flow (B3).

        A reader can arrive at the last page with the stored high-water
        mark behind it: rapid Next clicks coalesce the 500ms debounced
        writes, and failed writes leave the mark stale. The reader's
        handleFinish then walks from progressLastPageIndex + 1 up to
        activePageIndex one index at a time, because TopicProgressView
        rejects a single POST that jumps more than one page.

        This test proves the server accepts that walk and flips
        is_completed. The client change is verified manually.
        """
        self._login(self.reader)
        # Walk to index 2 one page at a time (page 3 of 5).
        self._walk_up_to(2)
        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertEqual(progress.last_page_index, 2)
        self.assertFalse(progress.is_completed)

        # Navigate backward to index 0. Monotonic: stays at 2.
        backward = self.client.post(self.url, {"last_page_index": 0})
        self.assertEqual(backward.status_code, status.HTTP_200_OK)
        self.assertEqual(backward.data["last_page_index"], 2)

        # Walk forward from the high-water mark (2) to the last index
        # (4) one step at a time, matching handleFinish's loop.
        for index in range(3, 5):
            step = self.client.post(self.url, {"last_page_index": index})
            self.assertEqual(
                step.status_code,
                status.HTTP_200_OK,
                f"index {index} rejected: {step.data}",
            )

        progress.refresh_from_db()
        self.assertEqual(progress.last_page_index, 4)
        self.assertTrue(progress.is_completed)
        self.assertIsNotNone(progress.completed_at)


class TopicDetailProgressTests(APITestCase):
    """
    Verifies that TopicDetailSerializer embeds the correct progress object
    per requesting user.

    Invariants:
      - Anonymous users get progress: null.
      - The topic owner gets progress: null.
      - A reader who has never opened the topic gets progress: null.
      - A reader with progress gets the row inline, including is_unlocked.
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
        self.assertFalse(response.data["progress"]["is_unlocked"])


class TopicPageLockTests(APITestCase):
    """
    Covers TopicPageSerializer.is_locked, which enforces the paywall.

    Rule:
      - Anonymous user: pages past free_page_count are locked.
      - Topic owner: never locked.
      - Reader with a TopicProgress row but is_unlocked=False:
        pages past free_page_count are still locked. Row existence is
        not enough; only is_unlocked lifts the paywall.
      - Reader with is_unlocked=True: every page is readable.
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
        self.assertEqual(by_order[1]["content"], {"body": "Secret 1"})
        self.assertFalse(by_order[1]["is_locked"])
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
            self.assertTrue(page["content"])

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

    def test_progress_without_unlock_still_locks_past_free_count(self):
        # A row exists (the user has read to page 2), but they have not
        # unlocked. is_locked must still be True past free_page_count.
        TopicProgress.objects.create(
            user=self.reader,
            topic=self.topic,
            last_page_index=1,
            is_unlocked=False,
        )
        self.client.force_authenticate(user=self.reader)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        by_order = {p["order"]: p for p in response.data["results"]}
        self.assertFalse(by_order[1]["is_locked"])
        self.assertFalse(by_order[2]["is_locked"])
        self.assertTrue(by_order[3]["is_locked"])
        self.assertEqual(by_order[3]["content"], {})
        self.assertTrue(by_order[4]["is_locked"])
        self.assertEqual(by_order[4]["content"], {})

    def test_unlock_lifts_paywall_on_all_pages(self):
        TopicProgress.objects.create(
            user=self.reader,
            topic=self.topic,
            last_page_index=0,
            is_unlocked=True,
        )
        self.client.force_authenticate(user=self.reader)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        by_order = {p["order"]: p for p in response.data["results"]}
        for order in (1, 2, 3, 4):
            self.assertFalse(by_order[order]["is_locked"])
            self.assertEqual(
                by_order[order]["content"], {"body": f"Secret {order}"}
            )


class TopicUnlockTests(APITestCase):
    """
    Covers POST /api/topics/{id}/unlock/.

    Invariants:
      - Anonymous users get 401.
      - Topic owner gets 400.
      - Unpublished topic gets 403.
      - Unknown topic gets 404.
      - Unlock sets is_unlocked=True and creates the row if missing.
      - Unlock is idempotent.
      - Unlock does not touch last_page_index, is_completed, completed_at.
    """

    def setUp(self):
        self.owner = User.objects.create_user(
            username="unlockowner", password="pass-uo-1", email="uo@example.com"
        )
        self.reader = User.objects.create_user(
            username="unlockreader", password="pass-ur-1", email="ur@example.com"
        )
        self.subject = Subject.objects.create(name="Algorithms")
        self.topic = Topic.objects.create(
            subject=self.subject,
            created_by=self.owner,
            title="Unlock topic",
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
        self.url = reverse("topic-unlock", args=[self.topic.id])

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_is_rejected(self):
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_owner_cannot_unlock_own_topic(self):
        self._login(self.owner)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unpublished_topic_is_rejected(self):
        self.topic.is_published = False
        self.topic.save(update_fields=["is_published"])
        self._login(self.reader)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unknown_topic_is_not_found(self):
        self._login(self.reader)
        response = self.client.post(reverse("topic-unlock", args=[999999]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_unlock_creates_row_if_missing(self):
        self.assertFalse(
            TopicProgress.objects.filter(
                user=self.reader, topic=self.topic
            ).exists()
        )
        self._login(self.reader)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_unlocked"])
        self.assertEqual(response.data["last_page_index"], 0)
        self.assertFalse(response.data["is_completed"])

        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertTrue(progress.is_unlocked)
        self.assertEqual(progress.last_page_index, 0)

    def test_unlock_preserves_existing_progress(self):
        TopicProgress.objects.create(
            user=self.reader,
            topic=self.topic,
            last_page_index=2,
            is_unlocked=False,
        )
        self._login(self.reader)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_unlocked"])
        self.assertEqual(response.data["last_page_index"], 2)

        progress = TopicProgress.objects.get(user=self.reader, topic=self.topic)
        self.assertTrue(progress.is_unlocked)
        self.assertEqual(progress.last_page_index, 2)

    def test_unlock_is_idempotent(self):
        self._login(self.reader)
        first = self.client.post(self.url)
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertTrue(first.data["is_unlocked"])

        second = self.client.post(self.url)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertTrue(second.data["is_unlocked"])

        self.assertEqual(
            TopicProgress.objects.filter(
                user=self.reader, topic=self.topic
            ).count(),
            1,
        )


class TopicCreateResponseTests(APITestCase):
    """
    Covers the shape of POST /api/topics/ for the owner.

    Invariants:
      - The create response uses TopicDetailSerializer's shape.
      - progress is null for the owner.
      - pages is empty at create time (the client adds pages afterward
        via the pages endpoint).
      - After adding pages, a GET as the owner shows every page unlocked
        and content intact, regardless of free_page_count.

    B1 (create response shows locked pages to owner) was never
    reachable in the current code: get_is_locked short-circuits on the
    owner before consulting progress. The create view also injects an
    empty progress_by_topic so _progress_for does not fall back to a
    DB query. These tests document both.
    """

    def setUp(self):
        self.owner = User.objects.create_user(
            username="createowner", password="pass-co-1", email="co@example.com"
        )
        self.subject = Subject.objects.create(name="CreateResponse")
        self.url = reverse("topic-list")

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_create_response_is_detail_shape(self):
        self._login(self.owner)
        response = self.client.post(
            self.url,
            {
                "subject": self.subject.id,
                "title": "New topic",
                "description": "desc",
                "is_published": True,
                "free_page_count": 1,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "New topic")
        self.assertEqual(response.data["created_by"]["id"], self.owner.id)
        self.assertIsNone(response.data["progress"])
        self.assertEqual(response.data["pages"], [])

    def test_owner_pages_not_locked_after_adding_pages(self):
        self._login(self.owner)
        create = self.client.post(
            self.url,
            {
                "subject": self.subject.id,
                "title": "Locked?",
                "description": "",
                "is_published": True,
                "free_page_count": 1,
            },
        )
        self.assertEqual(create.status_code, status.HTTP_201_CREATED)
        topic_id = create.data["id"]

        # free_page_count=1, so pages 2 and 3 would be locked for a
        # reader. The owner must never see them locked.
        for i in range(1, 4):
            added = self.client.post(
                reverse("topic-page-list", args=[topic_id]),
                {
                    "page_type": "text",
                    "content": {"body": f"Page {i}"},
                },
                format="json",
            )
            self.assertEqual(added.status_code, status.HTTP_201_CREATED)

        response = self.client.get(reverse("topic-detail", args=[topic_id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["pages"]), 3)
        for page in response.data["pages"]:
            self.assertFalse(page["is_locked"])
            self.assertTrue(page["content"])