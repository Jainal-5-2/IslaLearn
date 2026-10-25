"""Local development settings."""
from .base import *  # noqa

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

# If REDIS_URL is not set locally, use an in-memory channel layer so
# `runserver` works without Docker. Dev-only: the in-memory layer is
# per-process and cannot fan out across workers. Prod uses the Redis
# layer from base.py unconditionally.
if not env("REDIS_URL", default=""):
    CHANNEL_LAYERS = {
        "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}
    }