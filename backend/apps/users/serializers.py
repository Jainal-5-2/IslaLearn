from rest_framework import serializers

from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    age_confirmed = serializers.BooleanField(write_only=True)

    # Shown only when a username collision is detected. Keeping this
    # generic avoids leaking which usernames are taken.
    USERNAME_TAKEN_MESSAGE = (
        "We couldn't create your account. Try to "
        "log in if you already have one."
    )

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "age_confirmed"]

    def validate_age_confirmed(self, value):
        if not value:
            raise serializers.ValidationError(
                "You must confirm you are 18+ or have parental consent."
            )
        return value

    def to_internal_value(self, data):
        try:
            return super().to_internal_value(data)
        except serializers.ValidationError as exc:
            detail = exc.detail if isinstance(exc.detail, dict) else {}

            passthrough = {}
            for field in ("age_confirmed", "password", "email"):
                if field in detail:
                    passthrough[field] = detail[field]

            if passthrough:
                raise serializers.ValidationError(passthrough)

            raise serializers.ValidationError(
                {"detail": self.USERNAME_TAKEN_MESSAGE}
            )

    def create(self, validated_data):
        validated_data.pop("age_confirmed")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    """
    Read shape. Used everywhere a user appears nested in another
    response (requests, broadcasts, threads, notifications). Do not add
    write fields here; edits go through UserUpdateSerializer.
    """

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "bio",
            "profile_picture",
            "is_tutor",
            "is_tutee",
            "plan",
        ]
        read_only_fields = ["id", "plan"]


class UserUpdateSerializer(serializers.ModelSerializer):
    """
    Write shape for PATCH /api/auth/me/.

    Only the two fields a user can self-edit. is_tutor, is_tutee, plan,
    username, and email are not here, so they cannot be changed through
    this endpoint even if a client sends them: DRF drops unknown keys,
    and the model fields are not on the serializer to be validated.
    Those are deliberate product decisions, not omissions.
    """

    class Meta:
        model = User
        fields = ["bio", "profile_picture"]


class PublicUserSerializer(serializers.ModelSerializer):
    """
    Public read shape: everything in UserSerializer except email.
    Used by the user detail endpoint so anyone can look up a profile
    by ID without harvesting email addresses.

    date_joined is included (Phase 12) so the profile page can show
    "Member since <date>" without a second request. It is inherited
    from AbstractUser and is non-sensitive.
    """

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "bio",
            "profile_picture",
            "is_tutor",
            "is_tutee",
            "plan",
            "date_joined",
        ]