"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, MessageSquare, Video } from "lucide-react";
import {
  getMe,
  getRequests,
  getSessions,
  getThreads,
  TutoringRequest,
  SessionSummary,
  ThreadSummary,
  User,
  ApiError,
} from "@/lib/api";
import { PageSkeleton } from "@/components/page-skeleton";
import { cn } from "@/lib/utils";

type Tab = "active" | "completed" | "reviewed";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <SessionsPage />
    </Suspense>
  );
}

function SessionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [active, setActive] = useState<TutoringRequest[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [threadByRequest, setThreadByRequest] = useState<Record<number, number>>(
    {}
  );
  const [tab, setTab] = useState<Tab>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      getMe(),
      getRequests({ accepted: true, status: "closed" }),
      getSessions(),
      getThreads().catch(() => ({
        count: 0,
        next: null,
        previous: null,
        results: [] as ThreadSummary[],
      })),
    ])
      .then(([u, activeData, sessionsData, threadsData]) => {
        setUser(u);
        setActive(activeData.results);
        setSessions(sessionsData.results);
        const map: Record<number, number> = {};
        for (const t of threadsData.results) {
          if (!t.is_open) continue;
          map[t.request] = t.id;
        }
        setThreadByRequest(map);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
        } else {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  // Split by the server's answer, not a client-side cache. The list
  // endpoint now includes my_review per row.
  const completed = useMemo(
    () => sessions.filter((s) => s.my_review === null),
    [sessions]
  );
  const reviewed = useMemo(
    () => sessions.filter((s) => s.my_review !== null),
    [sessions]
  );

  if (loading) {
    return <PageSkeleton variant="list" />;
  }

  if (error || !user) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">{error || "Failed to load."}</p>
        <Link href="/dashboard" className="text-accent underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const counts: Record<Tab, number> = {
    active: active.length,
    completed: completed.length,
    reviewed: reviewed.length,
  };

  return (
    // Fixed to the viewport: header and tabs pinned, only the list
    // region below scrolls. 4rem is the (app) layout's mobile header;
    // 3rem is main's vertical padding on lg+.
    <div className="flex flex-col h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-3rem)]">
      {/* Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Sessions</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Your tutoring engagements, past and present
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex gap-1 p-1 bg-muted rounded-lg w-full sm:w-fit mb-6">
        {(["active", "completed", "reviewed"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize",
              tab === t
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
            <span className="ml-1.5 text-xs text-muted-foreground">
              {counts[t]}
            </span>
          </button>
        ))}
      </div>

      {/* Scroll region. min-h-0 is required so the flex child can
          shrink below its content and overflow-y-auto takes over. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "active" && (
          <ActiveList requests={active} threadByRequest={threadByRequest} />
        )}
        {tab === "completed" && (
          <SessionList
            sessions={completed}
            emptyMessage="No completed sessions yet. Once a tutor marks a session complete, it shows up here."
          />
        )}
        {tab === "reviewed" && (
          <SessionList
            sessions={reviewed}
            emptyMessage="You have not reviewed any sessions yet."
          />
        )}
      </div>
    </div>
  );
}

function ActiveList({
  requests,
  threadByRequest,
}: {
  requests: TutoringRequest[];
  threadByRequest: Record<number, number>;
}) {
  if (requests.length === 0) {
    // h-full centers the empty state in the scroll region instead of
    // hugging the top.
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12 bg-card border border-dashed border-border rounded-xl">
        <h3 className="text-base sm:text-lg font-semibold mb-2">
          No active sessions
        </h3>
        <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-md">
          Post a request and accept a tutor to start one.
        </p>
        <Link
          href="/requests/new"
          className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
        >
          Post a request
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-3 pb-2">
      {requests.map((r) => {
        const threadId = threadByRequest[r.id];
        return (
          <div
            key={r.id}
            className="bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-accent/40 transition-all"
          >
            <Link href={`/requests/${r.id}`} className="block">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs font-medium px-2 py-1 bg-muted rounded-md text-muted-foreground">
                  {r.subject.name}
                </span>
                <span className="text-xs px-2 py-1 rounded-md font-medium bg-green-500/10 text-green-600">
                  Accepted
                </span>
              </div>
              <p className="text-sm text-foreground line-clamp-2">
                {r.description}
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                by {r.tutee.username} ·{" "}
                {new Date(r.created_at).toLocaleDateString()}
              </p>
            </Link>
            {threadId !== undefined && (
              <div className="mt-3 pt-3 border-t border-border">
                <Link
                  href={`/messages/${threadId}`}
                  className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline font-medium"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Message
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SessionList({
  sessions,
  emptyMessage,
}: {
  sessions: SessionSummary[];
  emptyMessage: string;
}) {
  if (sessions.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12 bg-card border border-dashed border-border rounded-xl">
        <p className="text-sm sm:text-base text-muted-foreground max-w-md">
          {emptyMessage}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3 pb-2">
      {sessions.map((s) => (
        <Link
          key={s.id}
          href={`/sessions/${s.id}`}
          className="block bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-accent/40 transition-all"
        >
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-medium px-2 py-1 bg-muted rounded-md text-muted-foreground">
              {s.session_type === "one_on_one" ? "1:1" : "Broadcast"}
            </span>
            <span className="text-xs px-2 py-1 rounded-md font-medium bg-accent/10 text-accent inline-flex items-center gap-1">
              {s.session_type === "one_on_one" ? (
                <BookOpen className="h-3 w-3" />
              ) : (
                <Video className="h-3 w-3" />
              )}
              Completed
            </span>
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            {s.source_title}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span>
              with{" "}
              {s.other_parties.map((p) => p.username).join(", ") || "unknown"}
            </span>
            <span>·</span>
            <span>
              {new Date(s.completed_at).toLocaleDateString(undefined, {
                dateStyle: "medium",
              })}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}