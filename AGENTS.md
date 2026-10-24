# AGENTS.md

Working conventions for this repo. Read this before making changes.

## Stack
- Backend: Django 6 + DRF + MySQL, apps under `backend/apps/`.
- Frontend: Next.js 16 App Router, TypeScript, Tailwind v4. See
  `frontend/AGENTS.md` for Next-specific warnings (it is auto-generated
  by `next dev`; do not edit it).
- Auth: JWT via `djangorestframework-simplejwt`. Tokens live in
  localStorage on the frontend.
- Group video (Broadcasts): Whereby Embedded, iframe embed in the page.
  1:1 sessions use an external meeting link, not the embed.

## Conventions

### Do not use em dashes
No `—` (U+2014) in any code, comment, docstring, or copy you write or
edit. Use a period, colon, comma, or parentheses. En dashes in numeric
ranges (`1-2`) are fine. Existing em dashes in `README.md` and in
untouched source-file comments are left alone; do not mass-edit them.
The README is out of scope for this rule (documentation-only).

### Comments explain why, not what
The code already says what. A comment earns its place only if it names
a reason, a constraint, or a trap. Do not narrate the code.

### No trailing commentary on edits
When making changes, do not add "I changed X because Y" notes to files.
That belongs in the commit message, not the source.

### Backend conventions
- Every app has `tests.py`. Keep it current. `python manage.py test apps.<app>`
  must pass after any change to that app.
- Serializer split: read vs write serializers have separate classes.
  Read serializers carry computed fields (`is_locked`, `progress`,
  `can_edit`, `subject_locked`). Write serializers carry only what the
  client can set. Do not merge them.
- Permissions: `IsAuthenticatedOrReadOnly` for browseable resources,
  `IsAuthenticated` for mutations. Owner-only actions are enforced in
  `check_object_permissions` or in the view body, not in the serializer.
- Races: any read-check-write on a model that other users can also
  write must use `select_for_update()` inside `transaction.atomic()`.
  See `apps/requests/views.py::ApplicationDecisionView` and
  `RequestCloseView`. The Broadcast join capacity check is the same
  pattern and must follow it.
- Progress is monotonic: `TopicProgress.last_page_index` never decreases
  except via an explicit `reset: true` write. Do not "helpfully" clamp
  it downward.
- `completed_at` and `is_completed` are kept in sync by the view, not
  derived in the serializer. If you change the definition of "completed",
  change `TopicProgressView.post`, not the serializer.

### Video (Broadcasts) conventions
- The Whereby API key lives in Django env only. Never in a
  `NEXT_PUBLIC_` variable, never in an API response.
- All Whereby-specific backend code (room creation, nothing else) lives
  in `apps/broadcasts/whereby.py`. Views call it; views do not call the
  Whereby API directly.
- The room is created when the broadcast is created (`POST
  /api/broadcasts/`). A cancelled broadcast leaves an unused room behind;
  that is accepted for now.
- Access is the backend check. `GET /api/broadcasts/{id}/room-url/`
  returns the meeting URL to the tutor and joined participants only.
  Whereby rooms are joined by URL, not signed tokens, so this check is
  the entire gate. If it is wrong, anyone with a broadcast ID can enter.
- `Broadcast` stores `room_provider` and `room_url`. Do not add a
  provider-specific field. A future token-based provider would add
  `room_id`; do not repurpose `room_url`.
- Joining a Broadcast checks capacity inside `select_for_update()` in
  `transaction.atomic()`. Without it, two simultaneous joins can exceed
  capacity.
- Whereby's Explore plan caps each meeting at 30 minutes. Do not write
  code that assumes a broadcast can run longer on the free tier. When a
  session hits the cap the room drops; the page must not look broken.

### Sessions & reviews conventions
- A `Session` row is created when the tutor marks the underlying
  Request or Broadcast complete. `Session` stores only the FK to the
  source; parties are derived through
  `apps/sessions/parties.py::session_participants`. Do not add
  `tutor`/`tutee` fields to `Session`; they would drift if the accepted
  application or participant list changes.
- Review rule: "anyone review anyone once." Reviewer and reviewee must
  both be participants in the session; a reviewer may leave at most one
  review per session (`unique_together`). Enforced in
  `ReviewCreateSerializer.validate`.
- Only the tutor can mark a session complete. For 1:1, the accepted
  tutor. For broadcasts, the broadcasting tutor. A cancelled broadcast
  cannot be completed.
- Detail serializers for `Request` and `Broadcast` carry a nested
  `session` field (null when none). The frontend reads it directly;
  do not add a separate `GET /sessions/` lookup for this.
- `/profile/[id]` is the public review page. Reviews link to the
  reviewer's profile, which links onward.

### Frontend conventions
- The detail page (`/topics/[id]`) never redirects. Returning users see
  the detail page with a "Continue reading" button. Do not add a
  redirect from detail to reader; it was tried and reverted.
- The reader (`/topics/[id]/read`) resumes to `progress.last_page_index`
  and shows the resume banner. The banner is dismissed on any navigation
  away from the resumed page, and via the reset dialog.
- The reader's sidebar lock is `index > max(activePageIndex, progressLastPageIndex)`
  for non-owners. Owners see the full sidebar. Never re-lock a page the
  user has already reached.
- The reader's completion marker is `index <= max(activePageIndex, progressLastPageIndex) - 1`
  for non-owners. The current page is not marked complete.
- `recordProgress` is debounced at 500ms via a ref timer, not state. Do
  not move the timer into `useState`; it would re-render on every tick.
- The reset flow uses a custom modal (`ResetProgressDialog`), not
  `window.confirm`. Native confirms cannot be styled and the modal
  blurs the background. Do not regress to `window.confirm`.
- API client: every call goes through `apiFetch` in `lib/api/client.ts`.
  It attaches the JWT, refreshes on 401, retries once, and throws
  `ApiError` on failure. Do not use bare `fetch` for API calls.
- Pagination: list endpoints return `Paginated<T>` (shape from
  `lib/api/pagination.ts`). Use `normalizePaginated` on the response,
  then read `.results`. Do not assume a bare array.
- All video embed code lives in a single `BroadcastRoom` component. No
  other component renders the iframe or knows the provider exists.
  Tutees join with camera off by default, because many users have
  limited bandwidth.

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

## Current state

- Phase 1: DONE (foundation, auth).
- Phase 2: DONE (topics, subjects, pages).
- Phase 2.5: DONE (progress, resume, completion, reset dialog).
- Phase 3: DONE (requests, applications, accept/reject, close).
- Phase 4: IN PROGRESS (broadcasts, Whereby Embedded).
- Phase 5: IN PROGRESS (5a done: sessions, reviews, profile page. 5b
  report model and button, 5c polish, both not started).
- Phase 6: NOT STARTED (seed, launch prep).

## Known open items

- `frontend/lib/api/client.ts` throws at module load if
  `NEXT_PUBLIC_API_URL` is unset. That is intentional but it will
  break `next build` in a CI that does not set the variable.
- `RegisterSerializer` does not call `validate_password`, so a weak but
  long-enough password (e.g. `password123`) passes. Fixing this is a
  serializer change and would need a test. Fix before inviting testers
  (Phase 6).
- `frontend/AGENTS.md` is auto-generated by `next dev`. Do not edit it.
- Em dashes remain in `README.md` and in source-file comments. This is
  intentional per the current scope decision; do not "fix" them. New
  and edited code still follows the no-em-dash rule above.
- Whereby Explore caps meetings at 30 minutes and allows 2,000
  participant-minutes per month. This is a development budget, not a
  production one. Plan a provider swap or paid plan before sessions
  longer than 30 minutes or real cohort usage.
- Whereby's Explore signup may not actually be card-free. Verify before
  the Phase 6 invites. `room_provider` exists so a swap to another
  provider (for example VideoSDK) needs no migration.