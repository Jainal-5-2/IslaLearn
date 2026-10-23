from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


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