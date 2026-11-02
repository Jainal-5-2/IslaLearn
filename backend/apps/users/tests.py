from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()

# 1x1 transparent GIF. The smallest valid image fixture, so the test
# does not depend on a file on disk.
_TINY_GIF = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!"
    b"\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01"
    b"\x00\x00\x02\x02D\x01\x00;"
)


class RegisterSerializerTests(APITestCase):
    """
    Covers POST /api/auth/register/.

    Invariants:
      - Valid registration creates a user and returns id/username/email.
      - The password is hashed, not stored in plaintext.
      - age_confirmed is required.
      - password and email validation errors surface as field keys,
        not as the generic "detail" message.
      - A duplicate username collapses to the generic "detail" message
        so usernames cannot be enumerated.
    """

    def setUp(self):
        self.url = reverse("register")

    def _payload(self, **overrides):
        data = {
            "username": "alice",
            "email": "alice@example.com",
            "password": "longenoughpassword",
            "age_confirmed": True,
        }
        data.update(overrides)
        return data

    def test_successful_registration_creates_user(self):
        response = self.client.post(self.url, self._payload())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["username"], "alice")
        self.assertEqual(response.data["email"], "alice@example.com")

        user = User.objects.get(username="alice")
        self.assertTrue(user.check_password("longenoughpassword"))
        self.assertNotEqual(user.password, "longenoughpassword")

    def test_age_confirmation_required(self):
        response = self.client.post(self.url, self._payload(age_confirmed=False))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("age_confirmed", response.data)
        self.assertNotIn("detail", response.data)

    def test_short_password_surfaces_as_field_error(self):
        response = self.client.post(self.url, self._payload(password="abc"))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)
        self.assertNotIn("detail", response.data)

    def test_invalid_email_surfaces_as_field_error(self):
        response = self.client.post(
            self.url, self._payload(email="not-an-email")
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)
        self.assertNotIn("detail", response.data)

    def test_duplicate_username_uses_generic_detail_message(self):
        User.objects.create_user(
            username="alice", email="first@example.com", password="pass-alice-1"
        )
        response = self.client.post(self.url, self._payload())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)
        self.assertNotIn("username", response.data)


class MeUpdateTests(APITestCase):
    """
    Covers GET and PATCH /api/auth/me/.

    Invariants:
      - Anonymous GET and PATCH are 401.
      - GET returns the full read shape (unchanged behavior).
      - PATCH updates bio and returns the read shape.
      - PATCH updates profile_picture via multipart and returns the URL.
      - PATCH ignores is_tutor, is_tutee, plan, and email: those fields
        are not on the write serializer, so they cannot be self-edited.
      - PUT is not allowed (405).
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="meuser",
            password="pass-me-1",
            email="me@example.com",
            bio="old bio",
        )
        self.url = reverse("me")

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_get_rejected(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonymous_patch_rejected(self):
        response = self.client.patch(self.url, {"bio": "x"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_returns_read_shape(self):
        self._login(self.user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.user.id)
        self.assertEqual(response.data["bio"], "old bio")
        self.assertIn("plan", response.data)

    def test_patch_updates_bio_and_returns_read_shape(self):
        self._login(self.user)
        response = self.client.patch(self.url, {"bio": "new bio"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["bio"], "new bio")
        self.user.refresh_from_db()
        self.assertEqual(self.user.bio, "new bio")

    def test_patch_uploads_profile_picture(self):
        self._login(self.user)
        upload = SimpleUploadedFile(
            "avatar.gif", _TINY_GIF, content_type="image/gif"
        )
        response = self.client.patch(
            self.url, {"profile_picture": upload}, format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data["profile_picture"])
        self.user.refresh_from_db()
        self.assertTrue(bool(self.user.profile_picture))

    def test_patch_cannot_change_privileged_fields(self):
        self._login(self.user)
        response = self.client.patch(
            self.url,
            {
                "is_tutor": True,
                "is_tutee": False,
                "plan": "paid",
                "email": "hijack@example.com",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_tutor)
        self.assertTrue(self.user.is_tutee)
        self.assertEqual(self.user.plan, "free")
        self.assertEqual(self.user.email, "me@example.com")

    def test_put_not_allowed(self):
        self._login(self.user)
        response = self.client.put(self.url, {"bio": "x"})
        self.assertEqual(
            response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED
        )


class PublicUserSerializerTests(APITestCase):
    """
    Covers GET /api/users/{id}/ (Phase 12 addition).

    Invariants:
      - date_joined is present and non-null.
      - email is not exposed.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="pubuser", password="pass-pu-1", email="pu@example.com"
        )
        self.url = reverse("user-detail", args=[self.user.id])

    def test_returns_date_joined(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("date_joined", response.data)
        self.assertIsNotNone(response.data["date_joined"])

    def test_email_not_exposed(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("email", response.data)