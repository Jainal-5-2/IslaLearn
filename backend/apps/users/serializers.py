from rest_framework import serializers

from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    age_confirmed = serializers.BooleanField(write_only=True)

    GENERIC_ERROR = (
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
            if (
                isinstance(exc.detail, dict)
                and set(exc.detail.keys()) == {"age_confirmed"}
            ):
                raise
            raise serializers.ValidationError({"detail": self.GENERIC_ERROR})

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