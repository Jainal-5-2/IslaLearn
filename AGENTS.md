# AGENTS.md

Working conventions for this repo. Read this before making changes.

## Stack
- Backend: Django 6 + DRF + MySQL, apps under `backend/apps/`.
- Frontend: Next.js 16 App Router, TypeScript, Tailwind v4. See
  `frontend/AGENTS.md` for Next-specific warnings (it is auto-generated
  by `next dev`; do not edit it).
- Auth: JWT via `djangorestframework-simplejwt`. Tokens live in
  localStorage on the frontend.

## Conventions

### Do not use em dashes
No `—` (U+2014) in code, comments, docstrings, or copy. Use a period,
colon, comma, or parentheses. En dashes in numeric ranges (`1-2`) are
fine. The README is out of scope for this rule (documentation-only).

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
  `RequestCloseView`.
- Progress is monotonic: `TopicProgress.last_page_index` never decreases
  except via an explicit `reset: true` write. Do not "helpfully" clamp
  it downward.
- `completed_at` and `is_completed` are kept in sync by the view, not
  derived in the serializer. If you change the definition of "completed",
  change `TopicProgressView.post`, not the serializer.

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
- Phase 4: NOT STARTED (broadcasts, Daily.co).
- Phase 5: NOT STARTED (sessions, reviews, reports).
- Phase 6: NOT STARTED (seed, launch prep).

## Known open items

- `frontend/lib/api/client.ts` throws at module load if
  `NEXT_PUBLIC_API_URL` is unset. That is intentional but it will
  break `next build` in a CI that does not set the variable.
- `RegisterSerializer` does not call `validate_password`, so a weak but
  long-enough password (e.g. `password123`) passes. Fixing this is a
  serializer change and would need a test.
- `frontend/AGENTS.md` is auto-generated by `next dev`. Do not edit it.
- Em dashes remain in `README.md` and in source-file comments. This is
  intentional per the current scope decision; do not "fix" them.