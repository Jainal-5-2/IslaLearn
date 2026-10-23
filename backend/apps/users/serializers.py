from rest_framework import serializers

from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    age_confirmed = serializers.BooleanField(write_only=True)

    # Shown only when a username collision is detected. Keeping this
    # generic avoids leaking which usernames are taken.
    USERNAME_TAKEN_MESSAGE = (
        "We couldn't create your account. Try a different username, "
        "or log in if you already have one."
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

            # Preserve field-level errors the client can render inline.
            # Everything else collapses to a generic message so usernames
            # and other identifiers can't be enumerated.
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