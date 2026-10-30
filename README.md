# IslaLearn — BaSU CS Peer Learning Platform

> A peer-to-peer learning platform for Basilan State University CS students: async topic content, live group broadcasts, and 1:1 tutoring requests — all in one place.

---

## Part 1 — The Platform

### What It Is

**IslaLearn** is a peer learning marketplace built for **Basilan State University Computer Science students**. It lets students teach what they know and learn what they don't — asynchronously through structured topic content, and synchronously through live video sessions.

The core idea: **learn async, get help sync.** A student can read through a Topic on their own time, then book a live session (1:1 or group) when they get stuck.

### Who It's For

- **Primary audience:** BaSU CS students — both those who want to teach and those who want to learn.
- **Secondary:** Non-CS students and non-students are welcome to participate, but the platform is positioned and seeded around the BaSU CS community.
- **Age policy:** Self-declared 18+ (checkbox at signup). Real verification is deferred until payments are introduced.

### The Three Core Flows

#### 1. Topics (Async Content)

A **Topic** is a structured learning resource created by a tutor. It's a container for an ordered sequence of pages:

- **Text pages** — written explanations
- **Video pages** — embedded or linked video
- **Quiz pages** — multiple-choice questions, auto-scored

Each Topic belongs to a **Subject** (e.g., "Python", "Data Structures", "Web Development"). Topics are browsable by any logged-in user.

**Free preview gating:** Every Topic has a `free_page_count` (default: **2**). The first N pages are always free. Pages beyond that are locked behind a "Continue learning" gate — which for MVP is always open (everything is free), but the locking logic exists so monetization can be turned on later without any schema change or rebuild.

This was a deliberate design decision: instead of letting uploaders choose what's free (which leads to inconsistent experiences and uploader friction), the platform sets a uniform rule. Predictable, low-friction, reversible.

#### 2. Broadcasts (Group Live Sessions)

A **Broadcast** is a scheduled group session offered by a tutor on a specific Subject/Topic. It has:

- A title, description, and datetime
- A maximum capacity
- An in-app video room (powered by **Whereby Embedded**)

Tutees browse upcoming broadcasts and **join** if there's space. On the session date, they enter the video room directly from the platform — no external links, no Zoom setup.

#### 3. Requests (1:1 Live Tutoring)

A **Request** is posted by a tutee who needs help with a specific Subject/Topic. It includes:

- The Subject/Topic
- A description of what they need help with
- Preferred timing

Tutors browse open requests and **apply** with a message. The tutee reviews applications and **accepts one**. The accepted tutor then shares an **external meeting link** (Zoom/Meet/Whereby) for the 1:1 session.

> **Why external links for 1:1 but an embedded room for group?** Group calls need real infrastructure (SFU, scaling) — external links are clunky for N participants. 1:1 calls work perfectly fine with a shared link, and skipping the integration saves weeks of work. Whereby Embedded handles group; external links handle 1:1.

### Trust & Safety

- **Reviews** — tied to *completed* sessions only. Both parties can review after a session is marked complete.
- **Report/block** — a report button on profiles and content.
- **Self-declared 18+** — checkbox at signup. No ID verification for MVP.

### What IslaLearn Is *Not* (Yet)

- Not a paid platform (everything is free in v1)
- Not a video storage service (video pages link/embed existing videos; we don't host)
- Not an in-app messaging app (Requests use an application thread; Broadcasts use email/notifications)
- Not a mobile app (web-only for now)
- Not a general-audience platform (positioned for BaSU CS)

---

## Part 2 — The Plan & To-Do

### Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js (App Router), TypeScript, Tailwind CSS |
| **Backend** | Django + Django REST Framework |
| **Database** | MySQL |
| **Auth** | JWT (`djangorestframework-simplejwt`) |
| **Video (group)** | Whereby Embedded (iframe embed, room creation via server-side REST call) |
| **Video (1:1)** | External link (Zoom/Meet/Whereby) |

**Video provider note:** Daily.co was dropped because it requires a credit card at signup. Whereby Embedded is the chosen provider because its free Explore plan needs no card to try (verify at signup). The accepted tradeoffs on the free plan are a **30-minute limit per meeting** and **2,000 participant-minutes per month**. The room reference is stored provider-neutrally (`room_provider`, `room_url`) so the provider can be swapped later without a schema change. Pricing and limits change often; re-check Whereby's Embedded pricing page before launch.

### Architecture

Fully decoupled: Next.js consumes a DRF REST API. Django owns all data, auth, and business logic. No Django templates are used.

```
Next.js (localhost:3000)
        │  JWT-authenticated fetch
        ▼
Django REST API (localhost:8000)
        │                     │
        ▼                     ▼
     MySQL            Whereby API (room creation)
```

CORS is configured to allow the Next.js origin during development.

### Data Model (High Level)

```
User (custom, extends AbstractUser)
  - bio, is_tutor, is_tutee, profile_picture
  - plan (free | paid)         ← hook for future freemium
  - payout_account_id          ← hook for future Stripe Connect

Subject (curated taxonomy)
  - name, description

Topic (async content)
  - subject (FK), created_by (FK User)
  - title, description, is_published
  - free_page_count (default 2)    ← free-preview gating
  - pages → TopicPage[]

TopicPage
  - topic (FK), order, page_type (text|video|quiz)
  - content (JSONField: text body / video URL / quiz questions)

TopicProgress (Phase 2.5)
  - user (FK), topic (FK)
  - last_page_index (int, monotonic high-water mark)
  - is_completed (bool)
  - last_visited_at, completed_at (nullable)
  - unique_together = (user, topic)

Request (1:1 demand)
  - tutee (FK User), subject (FK), description
  - preferred_time, status (open|closed)
  - applications → Application[]

Application
  - request (FK), tutor (FK User), message
  - status (pending|accepted|rejected)

Broadcast (group supply)
  - tutor (FK User), subject (FK), title, description
  - scheduled_at, capacity
  - room_provider, room_url     ← provider-neutral (was daily_room_url)
  - participants → BroadcastParticipant[]

BroadcastParticipant
  - broadcast (FK), user (FK), joined_at

Session (unifies 1:1 and group for reviews)
  - session_type (one_on_one | broadcast)
  - request (FK, nullable) | broadcast (FK, nullable)
  - completed_at, marked_by

Review
  - session (FK), reviewer (FK), reviewee (FK)
  - rating (1–5), text

Report
  - reporter (FK), target_type, target_id, reason
```

**Schema hooks for the future** (present from day one, unused in v1):
- `User.plan` and `User.payout_account_id` — for freemium + Stripe Connect
- `Topic.free_page_count` — for content gating
- `Broadcast.room_provider` — lets the video provider change without redefining the field's meaning
- `SessionActivity` (deferred model) — for in-call quizzes/polls
- `Enrollment` (deferred model) — for paid topic access

### API Surface (DRF Endpoints)

```
Auth
  POST   /api/auth/register/
  POST   /api/auth/login/          (returns JWT)
  POST   /api/auth/refresh/
  GET    /api/auth/me/

Subjects
  GET    /api/subjects/

Topics
  GET    /api/topics/              (browse, filter by subject)
  POST   /api/topics/              (create — tutor)
  GET    /api/topics/{id}/         (detail, with page lock flags)
  PATCH  /api/topics/{id}/         (edit — owner only)
  DELETE /api/topics/{id}/         (owner only)
  POST   /api/topics/{id}/pages/   (add page)
  PATCH  /api/topics/{id}/pages/{page_id}/
  DELETE /api/topics/{id}/pages/{page_id}/
  POST   /api/topics/{id}/progress/   (upsert; body: last_page_index, reset)

Requests (1:1)
  GET    /api/requests/            (browse open requests)
  POST   /api/requests/            (create — tutee)
  GET    /api/requests/{id}/
  POST   /api/requests/{id}/apply/ (tutor applies)
  GET    /api/requests/{id}/applications/
  PATCH  /api/applications/{id}/   (tutee accepts/rejects)

Broadcasts (group)
  GET    /api/broadcasts/          (browse upcoming)
  POST   /api/broadcasts/          (create — tutor; creates Whereby room)
  GET    /api/broadcasts/{id}/
  POST   /api/broadcasts/{id}/join/ (tutee joins; checks capacity)
  DELETE /api/broadcasts/{id}/leave/
  GET    /api/broadcasts/{id}/room-url/  (tutor and joined participants only;
                                          the URL is the access grant, so the
                                          backend check is the gate)

Sessions & Reviews
  POST   /api/sessions/{id}/complete/    (mark complete)
  POST   /api/sessions/{id}/reviews/     (submit review)
  GET    /api/users/{id}/reviews/

Reports
  POST   /api/reports/
```

### Next.js Page Map

```
/                           → Landing / browse topics + upcoming broadcasts
/login                      → Login
/register                   → Signup (with 18+ checkbox)

/topics                     → Browse all topics (filter by subject)
/topics/[id]                → Topic detail (metadata, preview, start/continue button)
/topics/[id]/read           → Topic reader (pages, quiz, lock gate, resume)
/topics/new                 → Create topic (tutor)
/topics/[id]/edit           → Edit topic + pages

/requests                   → Browse open requests
/requests/new               → Post a request (tutee)
/requests/[id]              → Request detail + applications
/requests/[id]/apply        → Apply form (tutor)

/broadcasts                 → Browse upcoming broadcasts
/broadcasts/new             → Create broadcast (tutor)
/broadcasts/[id]            → Broadcast detail + join button
/broadcasts/[id]/room       → Live video room (participants only)

/dashboard                  → My profile, my topics, my requests, my broadcasts, my sessions
/profile/[id]               → Public profile + reviews
```

### Build Order (Solo-Friendly Sequence)

**Phase 1 — Foundation** `[DONE]`
1. Set up Django project + MySQL + custom User model + JWT auth.
2. Set up Next.js + Tailwind + API helper + login/register pages.
3. Configure CORS. Verify end-to-end auth works via Postman and the browser.

**Phase 2 — Taxonomy & Content** `[DONE]`
4. Build `Subject` model + seed ~30 CS subjects.
5. Build `Topic` + `TopicPage` models with `free_page_count` logic.
6. Build Topic API (CRUD, page ordering, lock flags).
7. Build Topic browse page + Topic reader (with quiz rendering and lock gate).
8. Build Topic create + edit pages.

**Phase 2.5 — Topic Progress** `[DONE]`

*Rationale:* read-tracking makes the dashboard meaningful and adds a natural
reason for users to return. Deferred past Phase 3 so the Request flow could
finish first; the model is additive and required no migration of existing
data.

- `TopicProgress` model: `user` (FK), `topic` (FK), `last_page_index`
  (monotonic high-water mark), `is_completed`, `last_visited_at`,
  `completed_at`, `unique_together = (user, topic)`.
- `POST /api/topics/{id}/progress/` accepts `{ last_page_index, reset }`.
  Normal writes are monotonic (`max(stored, incoming)`). `reset: true`
  assigns unconditionally and clears `is_completed` / `completed_at`.
  Rejects writes from the topic's own creator.
- `TopicDetailSerializer` and `TopicListSerializer` embed a per-user
  `progress` object, `null` for anonymous users and for the creator.
- New topic detail page at `/topics/[id]`. The reader moved to
  `/topics/[id]/read`. The detail page shows metadata, a preview of page 1,
  and a primary button that branches on `progress`: "Start reading",
  "Continue reading", or "Read again". The detail page never redirects;
  returning users see the button, not a bounce into the reader.
- Reader: debounced save (500ms) on page change; resume to
  `progress.last_page_index` on load; resume banner with "Start from
  beginning" that confirms via a modal before resetting; sidebar locks
  pages beyond `max(activePageIndex, progressLastPageIndex)` and shows a
  checkmark for pages strictly before it. Owners see the full sidebar and
  never write progress.
- Browse `/topics`: "Continue" and "Completed" badges driven by the
  embedded `progress`.
- Dashboard cards and the "In progress" filter are deferred to Phase 5
  (polish). The data is available; the UI is not built.

*Decisions locked in:*
- Completion = reaching the last page (quiz tracking deferred).
- No progress for the topic creator.
- `last_page_index` is monotonic. Navigating backward does not lower it;
  only an explicit `reset: true` write does.
- `is_completed` and `completed_at` are kept in sync by the view. The
  serializer reads `is_completed` directly from the model.
- Server-side storage (syncs across devices).
- Reset is available via the resume banner ("Start from beginning"),
  confirmed by a custom modal, not `window.confirm`.

**Phase 3 — Demand Flow (Requests)** `[DONE]`
9. Build `Request` + `Application` models and API.
10. Build request browse/post pages (tutee) and apply flow (tutor).
11. Build accept/reject flow.

**Phase 4 — Supply Flow (Broadcasts)** `[DONE]`
12. Integrate Whereby Embedded: create an account on the Explore plan (no card), store the API key in Django env (server-side only), and build a small backend service that creates a meeting and returns its URL.
13. Build `Broadcast` + `BroadcastParticipant` models and API, including `room-url` with tutor/participant-only access.
14. Build broadcast browse/create/join pages + live room page (iframe embed inside a single `BroadcastRoom` component).
15. Test the 30-minute meeting cap: see what happens when a meeting hits it and make sure the UI handles it gracefully. Tutees join with camera off by default, since many users have limited bandwidth.

**Phase 5 — Trust & Polish** `[DONE]`
16. Build `Session` + `Review` + `Report` models and API. `[5a: DONE for Session + Review; Report pending]`
17. Build session-complete flow + review submission + profile reviews. `[5a: DONE]`
18. Build report button. `[5b: NOT STARTED]`
19. Polish UI, add empty states, loading states, error handling. `[5c: NOT STARTED]`

**Phase 6 — Session Page** `[DONE]`

**Goal:** Give the user one place to see their tutoring engagements: accepted requests in progress, completed ones, and reviewed ones. Read-only list plus a detail view. No messaging, no notifications yet.

**Naming note:** The `Session` model stays untouched. It is the completion record (created when a tutor marks a request or broadcast complete). The `/sessions` URL is fine; the "Active" tab is a query over `Request` + accepted `Application`, not over `Session`. The model does not mean two things.

**Backend:**
- `GET /api/sessions/` — returns the requesting user's `Session` rows (completed 1:1 and broadcast sessions), each with `other_party`, `session_type`, source id (`request` or `broadcast`), `completed_at`, `can_review`, `my_review`.
- `GET /api/requests/?accepted=true&mine=false` (or equivalent filter) — returns accepted-but-not-completed requests the user is a party to. This is the "Active" tab's data source. No new model, no new row; the accept state already lives in `Request.status == "closed"` + `Application.status == "accepted"`.
- No `Session` model change. No migration. Cancel-before-complete lives on `Request` and is handled in Phase 10 (Bug Fixes).

**Frontend:**
- `/sessions` page with three tabs:
  - **Active** — accepted requests, no `Session` row yet. Links to the request detail.
  - **Completed** — `Session` rows where this user has not yet filed a review.
  - **Reviewed** — `Session` rows where this user has filed a review.
- `/sessions/[id]` detail page for real `Session` rows. Shows the other party, the source (request or broadcast), `completed_at`, and the review if any. Active engagements are not routed here; the Active tab links to the request detail instead, because a `Session` row does not exist until completion.

**What it does not contain:** messages, notifications, cancel flow, model changes. Those are Phases 7, 8, and 10.

---

**Phase 7 — Messages** 

**Goal:** A per-engagement thread between the parties, tied to `Request.status`, closed when the request closes.

**Tying to `Request.status`:**
- A thread exists for a `Request` that has an accepted `Application`. Thread membership is derived from the request parties: `{request.tutee, accepted_application.tutor}`. No `ThreadParticipant` table.
- A thread is **open** while `Request.status == "closed"` and no `Session` row exists for that request, and the request is not cancelled. It is **read-only** once a `Session` row exists (completed) or the request is cancelled. You cannot send new messages into a closed thread; you can still read history.
- This makes the "no messaging when closed" rule mechanical: `Request.status == "closed"` plus no session = open; session exists or request reopened = read-only.

**Backend:**
- `Thread` model: `request` FK (unique), `created_at`, `closed_at` (null while open). One thread per request, enforced by `unique=True` on the FK. Broadcast threads are a v7 addition.
- `Message` model: `thread` FK, `sender` FK, `body` (text), `created_at`. `ordering = ["created_at"]`.
- Thread is created **eagerly** at accept time, in the same `select_for_update` transaction as `ApplicationDecisionView`, so the thread exists the moment the engagement does and the Active tab can show a "Message" button without a race.
- REST endpoints:
  - `GET /api/threads/` — the user's threads, with `other_party`, `last_message_at`, `unread_count`.
  - `GET /api/threads/{id}/messages/` — paginated, newest last.
  - `POST /api/threads/{id}/messages/` — sender must be a party to the thread's request and the thread must be open.

**Frontend:**
- `/messages` page: thread list on the left, active thread on the right. Opens at `/messages/[threadId]`. Mobile: one column, back to list.
- Polling every 3s while a thread is open. **WebSocket is the last step of Phase 7, not the first.** Ship with polling, validate the model, then swap the transport in the same phase. Redis and ASGI changes only land at the WebSocket step.

**Notifications for "message received" are Phase 8, not Phase 7.** Phase 7 creates the message; Phase 8 fans out the notification.

**Decisions:**
- Thread scoping: request-only in v6, broadcast threads in v7.
- Membership: derived from request parties, no `ThreadParticipant` table.
- WebSocket auth: query-string access token in v6, documented log-leak caveat.

---

**Phase 8 — Notifications**

**Goal:** The bell works. Fan out events from the views that already exist, plus from message creation (Phase 7). In-app only, polled.

**Backend:**
- `Notification` model: `recipient` FK, `actor` FK (nullable for system), `kind` enum (`application_received`, `application_accepted`, `application_rejected`, `session_completed`, `review_received`, `message_received`), `target_type` + `target_id` (or three nullable FKs mirroring `Report`), `read_at` (nullable), `created_at`.
- Fan-out points, explicit in view bodies (not signals), each inside or after the existing transaction:
  - `RequestApplyView` → `application_received` to tutee.
  - `ApplicationDecisionView` → `application_accepted` / `application_rejected` to tutor.
  - `RequestCompleteView` / `BroadcastCompleteView` → `session_completed` to the other parties.
  - `SessionReviewCreateView` → `review_received` to reviewee.
  - `MessageCreateView` (Phase 7) → `message_received` to the other thread party.
- REST endpoints:
  - `GET /api/notifications/` — paginated, newest first, with `unread_count`.
  - `POST /api/notifications/{id}/read/`
  - `POST /api/notifications/read-all/`

**Frontend:**
- Bell icon in `AppShell` with unread badge, dropdown of the last 10, "View all" link to `/notifications`.
- `/notifications` page: full list, mark-as-read per row and mark-all.
- Polling every 30s from `AppShell`. WebSocket push is optional and not required for Phase 8 to be done.

---

**Phase 9 — Terms, Privacy, and Settings**

**Goal:** Legal pages and, optionally, a minimal Settings page.

**Settings — what it contains, honestly:**
Ship a Settings page only with what the codebase already supports. No placeholders for features that do not exist.
- **Profile:** `bio`, `profile_picture`. Requires `PATCH /api/users/me/` (does not exist yet; add it in this phase). `UserSerializer` already exposes both fields, so this is a small backend addition plus a form.
- **Account:** log out (already in sidebar), links to `/privacy` and `/terms`.
- **Plan:** read-only display of `user.plan`. No upgrade button; v6 has no payments.
- **Nothing else.** No notification preferences (Phase 8 is all-or-nothing). No password change (add in v7 if users ask). No email preferences. No theme (already global).

**Minimum viable Phase 9:** ship `/privacy` and `/terms` as static pages with real copy, link them from `Footer` (already linked) and from the register page consent line. Add Settings only if the bio/avatar edit is worth the `PATCH /api/users/me/` addition.

**Frontend:**
- `frontend/app/(focused)/privacy/page.tsx` — static content, no backend.
- `frontend/app/(focused)/terms/page.tsx` — static content, no backend.
- Footer links confirmed.
- Register page consent line linking to both.
- Optional `/settings` page.

---

**Phase 10 — Bug Fixes**

**Goal:** The accumulated bugs, including the ones already identified. This is a buffer phase, not a fixed list; expect it to grow while Phases 6-9 are built.

**Status notes:**

- **B5 — topic page order collision.** Already fixed in the code. `TopicPageListCreateView.perform_create` computes the next order as `last_page.order + 1` over the highest-order page, not `pages.length + 1`, so a gap left by a delete does not collide. No action needed; the earlier description was stale. A regression test that deletes a middle page and then adds a new one would be cheap insurance if this phase is otherwise short on work.
- **Request detail report button.** Already shipped. `ReportButton` is rendered in every non-owner state on `/requests/[id]`. Note, not task.
- **1:1 completion is tutee-only.** Shipped as part of the messaging phase. `RequestCompleteView` rejects anyone but the tutee with 403 and records `marked_by` as the tutee. The tutor-side gap (a ghosting tutee leaves an unclosed engagement) is documented under "Known limitations." No further work in this phase unless the gap is promoted from a known limitation to a bug, which it is not.

**Open items:**

- **Broadcast completion as a terminal state.** `[DONE]`
  - Model: add `Broadcast.completed_at` (nullable datetime). Migration with a backfill from `Session.completed_at` where `session_type="broadcast"`. The field is distinct from `is_cancelled`; a broadcast can be neither, cancelled, or completed, but not both cancelled and completed.
  - `BroadcastCompleteView`: set `completed_at` inside the existing `select_for_update` transaction. Idempotent: a second call returns the existing `Session` with 200 and does not overwrite `completed_at`.
  - Guards: `BroadcastJoinView`, `BroadcastRoomUrlView`, and `BroadcastCancelView` reject when `completed_at is not None` with a 400 and a message naming the state ("This broadcast has already ended"). `BroadcastLeaveView` stays idempotent and does not need the guard, since leaving a completed broadcast is harmless.
  - Serializers: `BroadcastListSerializer` and `BroadcastDetailSerializer` expose `is_completed` (derived from `completed_at is not None`) and `completed_at`. The list serializer already computes `is_completed` from `sessions.exists()`; once the column exists, prefer the column so the two cannot disagree.
  - Detail page (`app/(app)/broadcasts/[id]/page.tsx`): "Completed" badge, "This broadcast has ended" notice, hide Cancel and Enter room. The `SessionPanel` completion card already hides itself once a `Session` exists, so no change there.
  - List page (`app/(app)/broadcasts/page.tsx`): the card now shows "Completed" when `is_completed`, and "Ended" when the scheduled time has passed but completion was never marked. A Past tab is out of scope for this item; the README lists it under the existing `/broadcasts` past filter work and it can land with or after this change.
  - Tests: join/room-url/cancel on a completed broadcast return 400; complete sets `completed_at` and does not overwrite it on a second call; a completed broadcast appears in `?past=true`; a cancelled broadcast stays hidden from both upcoming and past lists.
  - Out of scope: notifications on completion, archiving, deleting the Whereby room. The room expires on its own.

- **Cancel accepted request.**
  - Endpoint: `POST /api/requests/{id}/cancel-accepted/`. Either party (tutee or the accepted tutor), only while `Request.status == "closed"` and no `Session` row exists for the request. Returns the updated `Request` in detail shape.
  - Effect: flip `Request.status` back to `"open"`, set the accepted `Application.status` back to `"pending"` (do not delete it; the tutor applied in good faith and can re-apply or walk away), un-reject the applications that were auto-rejected when the accept happened, and close the Phase 7 thread. The thread closure is derived, so the only write is on `Request` and `Application`; `thread_is_open` returns false once `Request.status == "open"`, which the existing rule already handles. Confirm this is the intended derivation, since `thread_is_open` currently requires `Request.status == "closed"` plus an accepted application; flipping the request to open makes the thread read-only without a separate `closed_at`.
  - Guard: if a `Session` exists, reject with 400. This is the same rule as the known-limitation note about settlement; a completed engagement cannot be cancelled.
  - Tests: tutee can cancel; the accepted tutor can cancel; a non-party gets 403; cancelling after a `Session` exists returns 400; cancelling a request that is not closed returns 400; the thread becomes read-only after cancel (assert via `thread_is_open` or the messages POST returning 400).
  - UI: a "Cancel" action on `/requests/[id]` for both parties when the conditions hold, with a confirm. For the tutor this is the escape hatch when the tutee ghosts, so it should be discoverable from the request detail, not buried.

- **Anything else found while building Phases 6-9.** Reserve the phase for this; do not pre-close the list.

---

**Phase 11 — Seed & Launch Prep**

**Step 0 — Smoke-test checklist before inviting anyone:**
- Create a topic with 3 pages (text, video, quiz).
- Delete page 2, add a new page (this is B5).
- Complete the topic.
- Post a request, apply as a second account, accept.
- Verify the Session Page Active tab shows it.
- Send a message on the Phase 7 thread.
- Verify the Phase 8 bell fires.
- Mark the request complete, review, verify the Completed tab.
- Schedule a broadcast, join as a second account, enter the room.
- Complete the broadcast, verify join/enter are blocked (this is the Phase 10 fix).
- Cancel a different accepted request and verify the thread goes read-only (this is the Phase 10 cancel flow).
- Send a message on the Phase 7 thread; confirm the other party receives it live, and that a message sent while the receiver was offline appears on reconnect without a refresh.

This catches Phase 10 regressions before step 22.

20. Seed 5-10 Topics manually (act as the first tutor).

21. Schedule 2-3 Broadcasts manually to make the platform feel alive. Keep each under 30 minutes on the free plan and track participant-minutes against the 2,000 monthly allowance.

22. Invite 10-20 BaSU CS classmates to test.

23. Review legal copy with a second pair of eyes. (If Phase 9 shipped the pages, this is a review, not a write-from-scratch.)

### Explicitly Deferred (v2+)

- Payments / Stripe / PayMongo + `Enrollment` model
- Freemium feature gating (beyond content preview)
- Whereby 30-minute per-meeting cap: move to a paid Whereby plan or another provider (for example VideoSDK) before sessions longer than 30 minutes
- Custom WebRTC / SFU (Whereby handles it for now)
- In-call quizzes/polls (`SessionActivity`)
- Automated matching algorithm
- Real age/student verification
- In-app messaging / notifications
- Mobile apps
- Multi-Topic "Course" programs
- Video hosting (we link/embed, not host)
- Topic progress: per-page granularity, quiz completion tracking, certificate/achievement badges
- Paid requests: an offered_price field on Request and a settlement flow. Settlement is off-platform in any future version that adds it; the platform does not hold funds. Escrow (hold until completion, refund on cancel) requires a payment provider with business registration (PayMongo, Xendit) and is deferred further.

### Known limitations (v1)

**1:1 completion is tutee-only.** Only the tutee can mark a 1:1 request complete. This protects tutees from a tutor completing a session that never happened, but it leaves two gaps for tutors:

- If the tutee ghosts after accepting, and no session happens, the tutor's protection is `POST /api/requests/{id}/cancel-accepted/` (Phase 10: either party, only while no `Session` exists). That path closes the engagement but does not create a reviewable session.
- If the session happened but the tutee never marks it complete, there is no tutor-side path to close it out in v1. Mitigation is manual (message the tutee, or contact the admin). The planned v2 fix is an inactivity sweep that closes accepted requests with no `Session` and no message activity after N days, carrying a `closed_reason` so the UI can distinguish "expired" from "cancelled."

Tutor-side completion is not planned. The tutee is the customer; the asymmetry is intentional.

**Tutee can avoid completing a session to dodge settlement.** Only the tutee can mark a 1:1 request complete, which is what creates the `Session` row that later settlement would key off. Once a `Session` exists, the request cannot be cancelled by either party (the Phase 10 cancel-accepted endpoint is scoped to "no `Session` exists"), and the thread is read-only. The gap is the window before completion: a tutee who received help can simply never mark the request complete, then cancel the accepted request (Phase 10, either party, while no `Session` exists) to avoid paying.

This is not exploitable in v1 because no money moves. It must be addressed before any paid flow ships. The likely shape is: settlement is triggered by `Session` creation, not by `Request.status`, and the tutor's "mark complete" path (deferred, see above) becomes the dispute resolution when the tutee refuses. Refund logic is out of scope until payments exist.