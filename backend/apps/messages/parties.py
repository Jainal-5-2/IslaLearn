def thread_parties(thread):
    """
    Return the set of users who are parties to `thread`.

    For a 1:1 thread: the request's tutee and the accepted tutor.
    Returns an empty set if the request has no accepted application
    (should not happen after accept, but defended).

    Imports are local to avoid a circular import: apps.requests.views
    imports apps.messages.models at module load, and this module is in
    the same package. Importing apps.requests.models at the top of this
    file causes the cycle. Deferring the import to call time resolves it.
    """
    from apps.requests.models import Application

    req = thread.request
    accepted = (
        Application.objects.filter(request=req, status="accepted")
        .select_related("tutor")
        .first()
    )
    if accepted is None:
        return set()
    return {req.tutee, accepted.tutor}


def thread_is_open(thread):
    """
    A thread is open iff the request is closed, no Session row exists
    for it, and the request has an accepted tutor. This is the rule
    that ties messaging to `Request.status`, per the v6 design.
    """
    from apps.requests.models import Application
    from apps.sessions.models import Session

    req = thread.request
    if req.status != "closed":
        return False
    if not Application.objects.filter(request=req, status="accepted").exists():
        return False
    if Session.objects.filter(session_type="one_on_one", request=req).exists():
        return False
    return True