"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Video } from "lucide-react";
import {
  getMe,
  getRequests,
  getSessions,
  TutoringRequest,
  SessionSummary,
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
  const [tab, setTab] = useState<Tab>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      getMe(),
      getRequests({ accepted: true, status: "closed" }),
      getSessions(),
    ])
      .then(([u, activeData, sessionsData]) => {
        setUser(u);
        setActive(activeData.results);
        setSessions(sessionsData.results);
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
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Sessions</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Your tutoring engagements, past and present
          </p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mb-6">
        {(["active", "completed", "reviewed"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize",
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

      {tab === "active" && <ActiveList requests={active} />}
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
    </>
  );
}

function ActiveList({ requests }: { requests: TutoringRequest[] }) {
  if (requests.length === 0) {
    return (
      <div className="text-center py-20 bg-card border border-dashed border-border rounded-xl">
        <h3 className="text-lg font-semibold mb-2">No active sessions</h3>
        <p className="text-muted-foreground mb-6">
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
    <div className="space-y-3">
      {requests.map((r) => (
        <Link
          key={r.id}
          href={`/requests/${r.id}`}
          className="block bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-accent/40 transition-all"
        >
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
      ))}
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
      <div className="text-center py-20 bg-card border border-dashed border-border rounded-xl">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
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