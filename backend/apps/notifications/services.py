"""
Single entry point for creating a Notification and (in the WebSocket
pass) pushing it to the recipient's user group.

Every source view calls notify(...). No view constructs a Notification
directly, so the two invariants that matter live here, not in five
places:

  1. The actor never receives a notification for their own action.
  2. One row per recipient, deduped by user id.

The WebSocket push happens in transaction.on_commit so a row that is
rolled back never announces itself. A Redis outage is logged and
swallowed: the row is already written, and the next fetch will surface
it. This matches the posture presence.py already takes.
"""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

from .models import Notification

logger = logging.getLogger(__name__)

TARGET_KWARGS = (
    "target_user",
    "target_topic",
    "target_broadcast",
    "target_request",
    "target_review",
)


def user_group_name(user_id):
    return f"user_{user_id}"


def _check_one_target(targets):
    provided = [k for k in TARGET_KWARGS if targets.get(k) is not None]
    if len(provided) != 1:
        raise ValueError(
            "notify() requires exactly one target_* kwarg; got "
            f"{provided or 'none'}"
        )


def _push(notification_id, recipient_id):
    """
    Send the serialized notification to the recipient's per-user group.

    Runs on commit. A failure here must not surface to the source view:
    the notification row is already durable, and the next GET will
    return it.
    """
    try:
        # Import here to avoid a models -> serializers -> models cycle at
        # module load. services is imported by views that already import
        # serializers, so a top-level import would be fine in practice,
        # but the local import keeps this module importable from a
        # migration or a shell without pulling the DRF stack.
        from .serializers import NotificationSerializer

        notification = Notification.objects.select_related(
            "actor", "target_user", "target_topic",
            "target_broadcast", "target_request", "target_review",
        ).get(pk=notification_id)
        payload = NotificationSerializer(notification).data

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            user_group_name(recipient_id),
            {"type": "notification.created", "notification": payload},
        )
    except Exception:
        logger.exception(
            "notifications: push failed for notification %s (recipient %s)",
            notification_id,
            recipient_id,
        )


def notify(*, kind, actor, recipients, **targets):
    """
    Create one Notification per recipient (excluding the actor) and
    push each to the recipient's user group on commit.

    kind       one of Notification.KIND_CHOICES
    actor      the user who caused the event; excluded from recipients;
               may be None for a future system notification, in which
               case no one is excluded
    recipients an iterable of User; deduped by id; empty is a no-op
    **targets  exactly one of target_user, target_topic,
               target_broadcast, target_request, target_review

    Returns the list of created Notification rows (possibly empty).
    """
    _check_one_target(targets)

    seen = set()
    final_recipients = []
    for user in recipients:
        if user is None:
            continue
        if actor is not None and user.id == actor.id:
            continue
        if user.id in seen:
            continue
        seen.add(user.id)
        final_recipients.append(user)

    if not final_recipients:
        return []

    created = []
    for user in final_recipients:
        created.append(
            Notification.objects.create(
                recipient=user,
                actor=actor,
                kind=kind,
                **targets,
            )
        )

    for row in created:
        transaction.on_commit(
            lambda row=row: _push(row.id, row.recipient_id)
        )

    return created