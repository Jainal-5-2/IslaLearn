"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, Video, Star } from "lucide-react";
import {
  getSession,
  SessionDetailData,
  Review,
  ApiError,
} from "@/lib/api";
import { PageSkeleton } from "@/components/page-skeleton";
import { SessionPanel, ReviewableUser } from "@/components/sessions-panel";
import { cn } from "@/lib/utils";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <SessionDetailPage />
    </Suspense>
  );
}

function SessionDetailPage() {
  const params = useParams();
  const sessionId = Number(params.id);

  const [session, setSession] = useState<SessionDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function refresh() {
    getSession(sessionId)
      .then(setSession)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) {
          setError("Session not found.");
        } else {
          setError(e instanceof Error ? e.message : "Failed to load session");
        }
      });
  }

  useEffect(() => {
    refresh();
    setLoading(true);
    getSession(sessionId)
      .then((s) => {
        setSession(s);
        // Record that this session has been reviewed so the /sessions
        // page's Reviewed tab can split without an N+1 fetch.
        if (typeof window !== "undefined" && s.my_review) {
          try {
            const raw = localStorage.getItem("islalearn.reviewedSessions");
            const arr: number[] = raw ? JSON.parse(raw) : [];
            if (!arr.includes(s.id)) {
              arr.push(s.id);
              localStorage.setItem(
                "islalearn.reviewedSessions",
                JSON.stringify(arr)
              );
            }
          } catch {
            // ignore
          }
        }
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) {
          setError("Session not found.");
        } else {
          setError(e instanceof Error ? e.message : "Failed to load session");
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (loading) {
    return <PageSkeleton variant="list" />;
  }

  if (error || !session) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">{error || "Session not found."}</p>
        <Link href="/sessions" className="text-accent underline">
          Back to sessions
        </Link>
      </div>
    );
  }

  const isOneOnOne = session.session_type === "one_on_one";
  const reviewableUsers: ReviewableUser[] = session.other_parties.map((p) => ({
    id: p.id,
    username: p.username,
  }));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/sessions"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sessions
      </Link>

      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs font-medium px-2 py-1 bg-muted rounded-md text-muted-foreground">
            {isOneOnOne ? "1:1" : "Broadcast"}
          </span>
          <span className="text-xs px-2 py-1 rounded-md font-medium bg-accent/10 text-accent inline-flex items-center gap-1">
            {isOneOnOne ? (
              <BookOpen className="h-3 w-3" />
            ) : (
              <Video className="h-3 w-3" />
            )}
            Completed
          </span>
        </div>

        <h1 className="text-2xl font-bold mb-2">{session.source_title}</h1>

        <p className="text-sm text-muted-foreground mb-6">
          Completed on{" "}
          {new Date(session.completed_at).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>

        <div className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Participants
          </h2>
          <ul className="space-y-1">
            {session.other_parties.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/profile/${p.id}`}
                  className="text-sm text-foreground hover:text-accent transition-colors"
                >
                  {p.username}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {session.source_link && (
          <Link
            href={session.source_link}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border hover:bg-muted text-sm font-medium transition-colors"
          >
            View source
          </Link>
        )}
      </div>

      {session.my_review ? (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-3">Your review</h2>
          <ReviewCard review={session.my_review} />
        </div>
      ) : (
        <SessionPanel
          kind={isOneOnOne ? "request" : "broadcast"}
          targetId={session.request ?? session.broadcast ?? 0}
          session={{
            id: session.id,
            session_type: session.session_type,
            request: session.request,
            broadcast: session.broadcast,
            completed_at: session.completed_at,
            marked_by: null,
            created_at: session.created_at,
            can_review: session.can_review,
            my_review: session.my_review,
          }}
          reviewableUsers={reviewableUsers}
          isTutor={false}
          onSessionChanged={refresh}
        />
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-background">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <Link
          href={`/profile/${review.reviewee.id}`}
          className="text-sm font-medium hover:text-accent transition-colors"
        >
          {review.reviewee.username}
        </Link>
        <Stars rating={review.rating} />
      </div>
      {review.text && (
        <p className="text-sm whitespace-pre-wrap">{review.text}</p>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        {new Date(review.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
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