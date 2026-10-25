import logging
from datetime import timedelta

import requests
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger(__name__)


class WherebyError(Exception):
    """Raised when Whereby's API rejects a room-creation request."""


def create_room(broadcast):
    """
    Create a Whereby meeting for `broadcast` and return its room URL.

    Uses endDate only (no startDate), so the room opens whenever the
    first participant joins and closes at scheduled_at + duration. The
    join view does not time-gate; the tutor can open the room early.
    That is accepted for Phase 4.

    Raises WherebyError on any non-2xx response or missing config, so
    the caller can roll back the broadcast row.
    """
    if not settings.WHEREBY_API_KEY:
        raise ImproperlyConfigured(
            "WHEREBY_API_KEY is not set. Broadcasts cannot create rooms."
        )

    end_dt = broadcast.scheduled_at + timedelta(
        minutes=broadcast.duration_minutes
    )
    # scheduled_at is UTC-aware (USE_TZ=True), so isoformat() emits
    # "+00:00". Whereby expects ISO 8601 with an offset.
    end_date = end_dt.isoformat()

    payload = {
        "endDate": end_date,
        "roomNamePattern": "human-short",
        "roomMode": "group",
    }

    try:
        response = requests.post(
            settings.WHEREBY_API_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.WHEREBY_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=10,
        )
    except requests.RequestException as exc:
        logger.exception("Whereby room creation failed: network error")
        raise WherebyError("Could not reach Whereby.") from exc

    if not response.ok:
        logger.error(
            "Whereby room creation failed: %s %s",
            response.status_code,
            response.text[:500],
        )
        raise WherebyError(
            f"Whereby rejected the room request ({response.status_code})."
        )

    data = response.json()
    room_url = data.get("roomUrl")
    if not room_url:
        logger.error("Whereby response had no room URL: %s", data)
        raise WherebyError("Whereby did not return a room URL.")

    return room_url