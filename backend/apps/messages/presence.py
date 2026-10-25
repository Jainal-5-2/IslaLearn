"""
Presence for a Thread, backed by a Redis hash.

The Channels layer cannot answer "who is in group thread_<id>".
group_add and group_discard are fire-and-forget. So presence lives in
a separate Redis key, not in the channel layer, even though both talk
to the same Redis server.

Key:   presence:thread:<thread_id>
Type:  hash
Field: <user_id>
Value: <last_heartbeat ISO 8601>
TTL:   HEARTBEAT_TTL_SECONDS, refreshed on every mark_online call

The TTL is the sweep. If a consumer dies without calling mark_offline,
its field stops being refreshed, and the whole hash expires
HEARTBEAT_TTL_SECONDS after the last write. current_online also filters
by timestamp, so a field that is present but stale is never reported
as online. No cron, no sweeper.

Redis failures are non-fatal for the caller: presence is a nicety, and
a Redis hiccup should not close a working socket. mark_online and
mark_offline swallow errors; current_online returns an empty list on
error. The WebSocket message path does not depend on this module.
"""

import logging
from datetime import datetime, timedelta, timezone

import redis
from django.conf import settings

logger = logging.getLogger(__name__)

HEARTBEAT_TTL_SECONDS = 30
# An entry older than this is treated as stale even if the hash has not
# expired yet. Slightly less than the TTL so a fresh entry is never
# misread as stale due to clock skew between the write and the read.
STALE_AFTER_SECONDS = 25


def _client():
    url = settings.CHANNEL_LAYERS["default"]["CONFIG"]["hosts"][0]
    if isinstance(url, (list, tuple)):
        url = url[0]
    return redis.Redis.from_url(url)


def _key(thread_id):
    return f"presence:thread:{thread_id}"


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def mark_online(thread_id, user_id):
    try:
        r = _client()
        key = _key(thread_id)
        r.hset(key, str(user_id), _now_iso())
        r.expire(key, HEARTBEAT_TTL_SECONDS)
    except redis.RedisError:
        logger.exception("presence: mark_online failed")


def mark_offline(thread_id, user_id):
    try:
        r = _client()
        key = _key(thread_id)
        r.hdel(key, str(user_id))
        if r.hlen(key) == 0:
            r.delete(key)
    except redis.RedisError:
        logger.exception("presence: mark_offline failed")


def current_online(thread_id):
    """
    Return the list of user ids in the thread whose last heartbeat is
    within STALE_AFTER_SECONDS. Sorted for deterministic test output.
    """
    try:
        r = _client()
        raw = r.hgetall(_key(thread_id))
    except redis.RedisError:
        logger.exception("presence: current_online failed")
        return []

    cutoff = datetime.now(timezone.utc) - timedelta(
        seconds=STALE_AFTER_SECONDS
    )
    online = []
    for user_id_bytes, ts_bytes in raw.items():
        try:
            ts = datetime.fromisoformat(ts_bytes.decode())
        except (ValueError, UnicodeDecodeError):
            continue
        if ts >= cutoff:
            online.append(int(user_id_bytes))
    return sorted(online)