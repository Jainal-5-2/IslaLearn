# IslaLearn — Manual Test Checklist

---

## Auth & onboarding

- [ ] Register a new account with a duplicate username → generic "We couldn't create your account..." message, no field name leaked.
- [ ] Register without the 18+ checkbox → field-level error under the checkbox, not a generic banner.
- [ ] Register with a short password → field-level error, not the generic message.
- [ ] Register successfully, then log in, then reload `/dashboard` → stays logged in.
- [ ] Log out from the sidebar → redirected to `/login`. Reload the dashboard URL directly → bounced to `/login`.
- [ ] Open `/login` or `/register` while already logged in → redirected to `/dashboard`.

## Topics — browse, detail, reader

**Setup (as A):** Create a topic with 4 pages: text, quiz (3 questions, passing score 2), text, quiz (2 questions, passing score 2). Publish it.

- [ ] `/topics` Browse tab shows the topic with "4 pages" and no Continue/Completed badge (A has no progress on their own).
- [ ] `/topics` My topics tab shows it, with the "Draft" badge while unpublished. Publish, reload, badge is gone.
- [ ] As B, `/topics` Browse shows the topic. No Draft badge.
- [ ] Subject filter narrows both tabs. Clearing the filter restores both.
- [ ] As A, open `/topics/[id]` → "Edit topic" and "Read as student" buttons. No Continue/Start reading.
- [ ] As B, `/topics/[id]` → "Start reading". Preview shows page 1 text. No resume banner.
- [ ] As A, `/topics/[id]/read` → sidebar shows all 4 pages unlocked. No Resume banner. Progress is not written (`TopicProgress.objects.filter(user=A).count() == 0` in Django shell).

## Reader — progress, lock, resume

- [ ] As B, start reading. Navigate page 1 → 2 → 3. Advance to page 4. Go back to page 1. Reload. Resume banner appears at page 4 (not 1).
- [ ] "Start from beginning" from the banner opens the confirm dialog. Cancel → nothing changes. Confirm → resets to page 1, banner gone, `quiz_results` cleared server-side.
- [ ] As a third user C who has never opened the topic: `?free_page_count=2`, so page 3 and 4 show the LockGate. Click "Unlock this topic". All pages become readable.
- [ ] Reader on a text page: "Next" is always enabled. On a video page: same.
- [ ] Reader on a quiz page: "Next" is disabled until you pass. Page 2 has a "Retry" label in the sidebar after a failed attempt.

## Quiz submit (Phase 12)

- [ ] As B on quiz page 1 (3 questions, threshold 2): answer 1 of 3 correct → submit → "Not yet: 1 of 3. Need 2 to pass." Toast + review panel shows all questions with correct answers highlighted. "Try again" button visible. No "Next".
- [ ] Click "Try again" → selections cleared, form re-enabled. Answer 2 of 3 correct → "Quiz passed: 2 of 3." "Next" button now enabled.
- [ ] Answer 3 of 3 on a retake → passes. `quiz_results["<page_id>"]` overwritten (only one entry per page in Django shell).
- [ ] Quiz page 2 (threshold 2 of 2): answer 1 of 2 → fails. Retake with 2 of 2 → passes.
- [ ] Reach the last page (quiz 2). The "Finished" button appears only after passing quiz 2.
- [ ] Click "Finished". Redirects to `/topics/[id]`. Detail page shows "You completed this topic on ...".
- [ ] `/topics` Browse: the card now shows "Completed". `/topics/[id]` shows "Read again".
- [ ] Negative case: Reset progress from the resume banner. Reach page 4 without retaking quiz pages. "Finished" appears (last page is text in this setup, so the button is on the page; quiz-gated version: reach last page without passing → the "Finished" button is still there but `is_completed` stays false after clicking it). Verify via `TopicProgress.objects.get(user=B, topic=...).is_completed` that it is `False`.

**Repeat with a topic where the last page is a quiz. In that case:**

- [ ] "Finished" only appears after passing the quiz. No separate finish button under the pagination bar.
- [ ] Passing then clicking "Finished" pushes progress up to the last index. `is_completed` becomes true.

## Quiz authoring (Phase 12)

- [ ] As A, edit the quiz page (3 questions, threshold 2). Threshold input shows 2 of 3.
- [ ] Add a question → threshold input still says 2, "of 4". Save. Reopen. Threshold is 2 of 4.
- [ ] Set threshold to 4 of 4. Remove a question → threshold clamps to 3 of 3.
- [ ] Set threshold to 0 → clamped to 1. Set threshold to 99 → clamped to question count.
- [ ] Save a new quiz page with an empty question (no text, no options). Server accepts it (backend does not validate question shape). Reader shows "0 questions" state and no submit is possible. This is a known soft spot; note it, do not fix in this pass.

## Requests (1:1)

- [ ] As B, `/requests/new`. Create a request with no preferred time. Detail page shows no "Preferred time" block. Edit mode shows empty date+time.
- [ ] As B, edit the request and set only a date (no time) → error "Please provide both a date and a time".
- [ ] As A, `/requests` Browse. As B, `/requests` My requests. Both tabs match expected contents.
- [ ] As A, apply to B's request. B receives an `application_received` notification (bell badge increments live).
- [ ] As B, accept A's application. Detail page now has "Message A". A gets an `application_accepted` notification.
- [ ] Cancel engagement: As A (accepted tutor), the "Cancel engagement" button appears. Click → confirm dialog. Confirm → request reopens, A's application is rejected, the "Message" button disappears for A, B gets an `engagement_cancelled` notification.
- [ ] As B (tutee), the "Cancel engagement" button never appears on an accepted request. "Close request" appears only while open.

## Messages

- [ ] As B, `/messages` lists the thread created by the accepted application. Click → chat view.
- [ ] Send a message as B. It appears without a refresh. On A's browser, in the same thread, it appears live (presence green dot).
- [ ] Open the thread as A in a second tab and type a message but do not send. Switch to B → A is online. Close A's tab → dot turns off within ~15 s.
- [ ] Send an empty message → send button disabled. Send 2001 characters → server rejects with "Message body cannot exceed 2000 characters."
- [ ] After completion: As B, mark the session complete. The thread becomes read-only: the composer is replaced with "This conversation is closed" banner. A reload shows the same. The `POST /messages/` endpoint rejects new messages (400).

## Sessions & reviews

- [ ] After B completes a 1:1 request: `/sessions` Active tab no longer lists the request. Completed tab lists the session.
- [ ] A and B can both review each other once. After B reviews A: `/profile/[A]` shows the review and average rating.
- [ ] B tries to review again → server 400.
- [ ] `/sessions/[id]` for a completed 1:1 shows the source link "View request", the other party, and the review form. After review, "Your review" replaces the form.
- [ ] `/profile/[A]` Learning section: A has progress on someone else's topic → listed with "Continue" badge. A has progress on their own topic → not listed (backend returns `progress: null` for creator). B's Learning shows topics B has progress on.

## Broadcasts

- [ ] As A, `/broadcasts/new`. Set duration 45 → orange warning about the 30-minute free-plan cap appears on the form.
- [ ] Broadcast created. Detail page shows "Enter room" for A and B (once B joins). Whereby iframe loads (or error banner if the API key is missing; note which).
- [ ] As B, join. Second join is idempotent. As C (third user), join fills no slot if capacity is 1 → error "This broadcast is full."
- [ ] As A (tutor), `POST /cancel/` sets `is_cancelled`. B's detail page shows the red "cancelled" notice. Enter room is gone.
- [ ] As A, on a non-cancelled past broadcast, "Mark complete" creates the Session, sets `Broadcast.completed_at`. B sees the "completed" green notice and cannot join. Attempting `GET /room-url/` returns 400 "This broadcast has already ended."
- [ ] `/broadcasts` upcoming list hides cancelled and completed. `?past=true` shows completed, hides cancelled. Verify via API and UI.

## Notifications

- [ ] Every action in Requests / Sessions / Messages above created a Notification row for the right recipient, from the right actor, and did not create one for the actor.
- [ ] Bell dropdown shows the last 20. "Mark all read" clears the badge.
- [ ] `/notifications` page renders all rows with the correct `notificationCopy` string per kind. Clicking a row marks it read and navigates to `target_link`.
- [ ] Live push: with A and B both logged in, B applies to A's request. A's bell badge increments without a poll. B's bell does not.
- [ ] Auto-mark: while on `/requests/[id]` for the request, an incoming `application_received` notification for that request is marked read as it arrives (badge does not increment).
- [ ] Tab title prefix `(N)` appears while unread > 0. Favicon gets the red dot. Both clear when unread hits 0.
- [ ] 60 s fallback poll fires while the tab is visible, does not fire while hidden. Verify in devtools Network tab with the tab backgrounded for 90 s.

## Reports

- [ ] Report a user from `/profile/[id]` → select category "other" with empty reason → inline validation. Fill reason → success toast. Row in Django admin.
- [ ] Report a topic from `/topics/[id]`. Report a broadcast from `/broadcasts/[id]`. Report a request from `/requests/[id]`.
- [ ] Self-report: `POST /api/reports/` with `target_user` = your own id → 400. Same via the UI (button does not appear on your own profile).

## Settings & profile

- [ ] `/settings` — update bio. `PATCH /api/auth/me/` succeeds, toast "Profile updated", the sidebar avatar reloads.
- [ ] Upload a new profile picture via the file picker. Preview updates immediately (blob URL), save succeeds, avatar updates across the app.
- [ ] After saving, opening `/profile/[your id]` shows the new bio and picture, plus "Member since <Month Year>".
- [ ] Verify the `date_joined` month matches the account creation month (not today's date, not a random month).
- [ ] `PATCH /api/auth/me/` with `is_tutor: true` in the body → server ignores it. Same for `is_tutee`, `plan`, `email`.
- [ ] `/privacy` and `/terms` render. Register page links to both open in a new tab.

## Cross-cutting

- [ ] Log in as A in two tabs. Log out in one. Reload the other → bounced to `/login` (refresh token invalidated server-side? Actually it is not; verify what happens and note the behavior; if the second tab still works, that is the intended `BLACKLIST_AFTER_ROTATION: False` behavior, not a bug).
- [ ] Log out. Open `/topics/[id]` anonymously. Public pages render. Mutating buttons do not appear. Direct `POST /api/topics/[id]/progress/` as anonymous → 401.
- [ ] Dark mode toggle persists across reloads. First paint is dark (no flash) on a reload while dark is stored.
- [ ] Narrow viewport (375 px) — every page above renders without horizontal scroll. Sidebars and drawers open/close. Mobile header shows Menu, logo, bell, theme, avatar.
- [ ] 640–1023 px viewport — the middle breakpoint. Confirm exactly one bell, one theme toggle, one avatar in the header (this band was a prior bug source; see `dashboard/page.tsx` comment about `hidden lg:block`).
- [ ] Any list page with > 20 items paginates. The count text ("N topics", "N requests") matches `results.length` on page 1, which may be smaller than `count` — confirm the count text is `results.length`, not `count`, or note the discrepancy.

## Backend-only checks

- [ ] `python manage.py test apps.topics apps.users apps.requests apps.broadcasts apps.sessions apps.messages apps.notifications apps.reports` — all green.
- [ ] `python manage.py makemigrations --check --dry-run` — no missing migrations.
- [ ] Django admin: `Notification.has_add_permission` returns `False`, `Report.has_add_permission` returns `False`. Both list views render existing rows.
- [ ] `TopicProgress.quiz_results` in the DB is a JSON object, not a string. Verify by `TopicProgress.objects.first().quiz_results` in the shell.