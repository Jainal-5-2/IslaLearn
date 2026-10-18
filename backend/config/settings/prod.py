"""Production settings — fill in fully when you deploy."""
from .base import *  # noqa

DEBUG = False
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[])