"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Star, Loader2 } from "lucide-react";
import {
  Session,
  completeRequest,
  completeBroadcast,
  createReview,
} from "@/lib/api";
import { showToast } from "@/components/toast";
import { cn } from "@/lib/utils";

export type ReviewableUser = { id: number; username: string };

/**
 * Complete-and-review controls for a session-bearing page.
 *
 * Three states:
 *   1. No session yet and `canComplete`: "Mark complete".
 *   2. Session exists and the viewer can review: review form.
 *   3. Session exists and the viewer has reviewed: read-only view.
 *
 * `canComplete` is decided by the parent. For a 1:1 request it is the
 * tutee (only the tutee completes). For a broadcast it is the tutor
 * (only the tutor completes). The session detail page passes `false`
 * because the session already exists there.
 *
 * `reviewableUsers` is computed by the parent: for a 1:1 session it is
 * a single entry (the other party); for a broadcast it is the tutor
 * plus participants, minus the current user. The backend re-validates
 * all of this, so the picker is a convenience, not the gate.
 */
export function SessionPanel({
  kind,
  targetId,
  session,
  reviewableUsers,
  canComplete,
  onSessionChanged,
}: {
  kind: "request" | "broadcast";
  targetId: number;
  session: Session | null;
  reviewableUsers: ReviewableUser[];
  canComplete: boolean;
  onSessionChanged: () => void;
}) {
  const [completing, setCompleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [revieweeId, setRevieweeId] = useState<number | "">(
    reviewableUsers.length === 1 ? reviewableUsers[0].id : ""
  );
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  // ---- State 1: no session ----
  if (!session) {
    if (!canComplete) {
      return null;
    }
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-2">Session complete?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {kind === "request"
            ? "Mark this session complete once you have received the help. This unlocks reviews and cannot be undone."
            : "Mark this session complete when you have finished. Participants can then leave reviews."}
        </p>
        <button
          onClick={async () => {
            if (kind === "request") {
              const ok = confirm(
                "Mark this session complete? This unlocks reviews and cannot be undone."
              );
              if (!ok) return;
            }
            setCompleting(true);
            setError("");
            try {
              if (kind === "request") {
                await completeRequest(targetId);
              } else {
                await completeBroadcast(targetId);
              }
              onSessionChanged();
              showToast("Session marked complete");
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Failed to mark complete"
              );
            } finally {
              setCompleting(false);
            }
          }}
          disabled={completing}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {completing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {completing ? "Marking..." : "Mark complete"}
        </button>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>
    );
  }

  // ---- State 3: already reviewed ----
  if (session.my_review) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-3">Your review</h2>
        <div className="border border-border rounded-lg p-4 bg-background">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <Link
              href={`/profile/${session.my_review.reviewee.id}`}
              className="text-sm font-medium hover:text-accent transition-colors"
            >
              {session.my_review.reviewee.username}
            </Link>
            <StarRatingDisplay rating={session.my_review.rating} />
          </div>
          {session.my_review.text && (
            <p className="text-sm whitespace-pre-wrap">
              {session.my_review.text}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---- State 2: can review ----
  if (!session.can_review || reviewableUsers.length === 0) {
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4">Leave a review</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!revieweeId) {
            setError("Pick who you are reviewing.");
            return;
          }
          setSubmitting(true);
          setError("");
          try {
            await createReview(session.id, {
              reviewee: Number(revieweeId),
              rating,
              text,
            });
            onSessionChanged();
            showToast("Review submitted");
          } catch (e2) {
            setError(e2 instanceof Error ? e2.message : "Failed to submit");
          } finally {
            setSubmitting(false);
          }
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Who are you reviewing? <span className="text-red-500">*</span>
          </label>
          {reviewableUsers.length === 1 ? (
            <p className="text-sm font-medium">
              {reviewableUsers[0].username}
            </p>
          ) : (
            <select
              value={revieweeId}
              onChange={(e) =>
                setRevieweeId(e.target.value ? Number(e.target.value) : "")
              }
              required
              className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="" disabled>
                Select a participant...
              </option>
              {reviewableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Rating</label>
          <StarRatingPicker value={rating} onChange={setRating} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Comment <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="How did it go?"
            className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-500/10 p-3 rounded-lg">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Submitting..." : "Submit review"}
          </button>
        </div>
      </form>
    </div>
  );
}

function StarRatingPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          className="p-0.5"
        >
          <Star
            className={cn(
              "h-7 w-7 transition-colors",
              n <= value
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/40 hover:text-yellow-400/60"
            )}
          />
        </button>
      ))}
      <span className="text-sm text-muted-foreground ml-2">{value}/5</span>
    </div>
  );
}

function StarRatingDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-3.5 w-3.5",
            n <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground/40"
          )}
        />
      ))}
    </div>
  );
}