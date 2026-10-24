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

**Phase 4 — Supply Flow (Broadcasts)**
12. Integrate Whereby Embedded: create an account on the Explore plan (no card), store the API key in Django env (server-side only), and build a small backend service that creates a meeting and returns its URL.
13. Build `Broadcast` + `BroadcastParticipant` models and API, including `room-url` with tutor/participant-only access.
14. Build broadcast browse/create/join pages + live room page (iframe embed inside a single `BroadcastRoom` component).
15. Test the 30-minute meeting cap: see what happens when a meeting hits it and make sure the UI handles it gracefully. Tutees join with camera off by default, since many users have limited bandwidth.

**Phase 5 — Trust & Polish**
16. Build `Session` + `Review` + `Report` models and API.
17. Build session-complete flow + review submission + profile reviews.
18. Build report button.
19. Polish UI, add empty states, loading states, error handling.

**Phase 6 — Seed & Launch Prep**
20. Seed 5–10 Topics manually (act as the first tutor).
21. Schedule 2–3 Broadcasts manually to make the platform feel alive. Keep each under 30 minutes on the free plan and track participant-minutes against the 2,000 monthly allowance.
22. Invite 10–20 BaSU CS classmates to test.
23. Write a simple privacy policy and ToS (18+ checkbox text).

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