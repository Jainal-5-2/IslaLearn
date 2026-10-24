from apps.requests.models import Application

from .models import Session


def session_participants(session):
    """
    Return the set of users who took part in `session`.

    For 1:1: the request's tutee and the accepted tutor.
    For broadcast: the broadcast's tutor and every joined participant.

    This is the only place that branches on session_type for party
    lookup. Every other rule (review permissions, review form options,
    profile aggregation) goes through this helper.
    """
    if session.session_type == "one_on_one":
        if session.request_id is None:
            return set()
        tutee = session.request.tutee
        accepted = (
            Application.objects.filter(
                request_id=session.request_id, status="accepted"
            )
            .select_related("tutor")
            .first()
        )
        parties = {tutee}
        if accepted is not None:
            parties.add(accepted.tutor)
        return parties

    if session.session_type == "broadcast":
        if session.broadcast_id is None:
            return set()
        tutor = session.broadcast.tutor
        participants = session.broadcast.participants.select_related("user")
        return {tutor} | {p.user for p in participants}

    return set()