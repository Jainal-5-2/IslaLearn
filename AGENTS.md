# AGENTS.md

Working conventions for this repo. Read this before making changes.

## Stack
- Backend: Django 6 + DRF + MySQL, apps under `backend/apps/`.
- Frontend: Next.js 16 App Router, TypeScript, Tailwind v4. See
  `frontend/AGENTS.md` for Next-specific warnings (it is auto-generated
  by `next dev`; do not edit it).
- Auth: JWT via `djangorestframework-simplejwt`. Tokens live in
  localStorage on the frontend.
- Group video: Whereby Embedded, iframe in the page. 1:1 sessions use
  an external meeting link.

## Rules

### Do not use em dashes
No `—` (U+2014) in code, comments, docstrings, or copy. Use a period,
colon, comma, or parentheses. En dashes in numeric ranges (`1-2`) are
fine. The README is out of scope for this rule.

### Comments explain why, not what
The code already says what. A comment earns its place only if it names
a reason, a constraint, or a trap.

### No trailing commentary on edits
Do not add "I changed X because Y" notes to files. That belongs in the
commit message.

### Backend
- Every app has `tests.py`. `python manage.py test apps.<app>` must pass
  after any change to that app.
- Read vs write serializers have separate classes. Read serializers
  carry computed fields (`is_locked`, `progress`, `can_edit`,
  `subject_locked`, `session`). Write serializers carry only what the
  client can set. Do not merge them.
- Permissions: `IsAuthenticatedOrReadOnly` for browseable resources,
  `IsAuthenticated` for mutations. Owner-only checks are enforced in
  `check_object_permissions` or in the view body, not in the serializer.
- Any read-check-write on a model other users can also write must use
  `select_for_update()` inside `transaction.atomic()`. See
  `apps/requests/views.py::ApplicationDecisionView`,
  `RequestCloseView`, and `BroadcastJoinView`.
- `TopicProgress.last_page_index` is monotonic. It never decreases
  except via an explicit `reset: true` write. Do not clamp it downward.
- `completed_at` and `is_completed` are kept in sync by the view, not
  derived in the serializer.

### Video (Whereby)
- The Whereby API key is server-side only. Never in a `NEXT_PUBLIC_`
  variable, never in an API response.
- Whereby-specific backend code lives in `apps/broadcasts/whereby.py`.
  Views call it; views do not call the Whereby API directly.
- `Broadcast` stores `room_provider` and `room_url`. Do not add a
  provider-specific field. Do not repurpose `room_url` for a provider
  that uses room IDs.
- `GET /api/broadcasts/{id}/room-url/` is the only gate for room
  access. Whereby rooms are joined by URL, not signed tokens, so the
  backend check is the entire gate.
- Whereby Explore caps meetings at 30 minutes. Do not write code that
  assumes a broadcast can run longer on the free tier.
- All video embed code lives in `BroadcastRoom`. No other component
  renders the iframe or knows the provider exists.

### Sessions and reviews
- `Session` stores only the FK to the source (`request` or
  `broadcast`). Parties are derived through
  `apps/sessions/parties.py::session_participants`. Do not add
  `tutor`/`tutee` fields; they would drift.
- Only the tutor marks a session complete. A cancelled broadcast
  cannot be completed.
- Review rule: any participant may review any other participant, once
  per session. Enforced in `ReviewCreateSerializer.validate` and the
  `unique_together` on `Review`.
- `Request` and `Broadcast` detail serializers carry a nested `session`
  field. Read it from there; do not add a separate session lookup.

### Reports
- `Report` uses three nullable FKs (`target_user`, `target_topic`,
  `target_broadcast`) with a check constraint, not
  `target_type`/`target_id`.
- Reports are admin-only. `POST /api/reports/` is the only public
  surface. No list endpoint.
- A user cannot report themselves.
- `ReportButton` takes a `target` object with exactly one of the three
  target keys. Do not add a `targetType` string prop.

### Frontend
- `/topics/[id]` never redirects. Returning users see the detail page
  with a "Continue reading" button.
- The reader resumes to `progress.last_page_index` and shows the resume
  banner. The banner is dismissed on navigation or via the reset dialog.
- Reader sidebar lock is `index > max(activePageIndex, progressLastPageIndex)`
  for non-owners. Never re-lock a page the user has already reached.
- `recordProgress` is debounced at 500ms via a ref timer, not state.
- The reset flow uses a custom modal (`ResetProgressDialog`), not
  `window.confirm`.
- Every API call goes through `apiFetch` in `lib/api/client.ts`. Do not
  use bare `fetch`.
- List endpoints return `Paginated<T>`. Use `normalizePaginated`, then
  read `.results`.

### Testing
- Backend: `python manage.py test apps.<app>` after any change. If a
  test fails and you believe the test is wrong, fix the test only if
  the behavior it asserts is genuinely obsolete. Otherwise the test is
  a bug report.
- No frontend test runner is configured. Do not add one as a side
  effect of an unrelated change.

### Commits
- Conventional commits: `feat(scope): summary`, `fix(scope): summary`,
  `docs: summary`, `test(scope): summary`.
- Phase milestones are tagged in the summary line, e.g.
  `feat(topics): Phase 2.5 topic progress tracking`.