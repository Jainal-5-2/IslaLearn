"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import {
  getMe,
  getThreads,
  ThreadSummary,
  User,
  ApiError,
} from "@/lib/api";
import { PageSkeleton } from "@/components/page-skeleton";
import { cn } from "@/lib/utils";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <MessagesListPage />
    </Suspense>
  );
}

function MessagesListPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getMe(), getThreads()])
      .then(([u, data]) => {
        setUser(u);
        setThreads(data.results);
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

  return (
    // Fixed to the viewport: header pinned, only the thread list
    // scrolls. 4rem is the (app) layout's mobile header; 3rem is
    // main's vertical padding on lg+.
    <div className="flex flex-col h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-3rem)]">
      {/* Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Conversations with your tutoring partners
          </p>
        </div>
      </div>

      {/* Scroll region. min-h-0 lets the flex child shrink below its
          content size so overflow-y-auto takes over. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {threads.length === 0 ? (
          // h-full centers the empty state in the available height
          // instead of hugging the top of the scroll region.
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12 bg-card border border-dashed border-border rounded-xl">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">
              No conversations yet
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-md">
              A conversation opens when your request is accepted by a tutor.
              Once that happens, this page will show it.
            </p>
            <Link
              href="/requests"
              className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
            >
              Browse requests
            </Link>
          </div>
        ) : (
          <div className="space-y-2 pb-2">
            {threads.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                currentUserId={user.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ThreadRow({
  thread,
  currentUserId,
}: {
  thread: ThreadSummary;
  currentUserId: number;
}) {
  const otherName = thread.other_party?.username ?? "Unknown";
  const isMine = thread.last_message?.sender_id === currentUserId;
  const preview = thread.last_message
    ? `${isMine ? "You: " : ""}${thread.last_message.body}`
    : "No messages yet";

  return (
    <Link
      href={`/messages/${thread.id}`}
      className="block bg-card border border-border rounded-xl p-4 hover:shadow-md hover:border-accent/40 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold truncate">
              {otherName}
            </span>
            {thread.is_open ? (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 uppercase tracking-wide">
                Open
              </span>
            ) : (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">
                Closed
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mb-1">
            {thread.source_title}
          </p>
          <p
            className={cn(
              "text-sm truncate",
              thread.last_message
                ? "text-foreground"
                : "text-muted-foreground italic"
            )}
          >
            {preview}
          </p>
        </div>
        {thread.last_message && (
          <span className="text-xs text-muted-foreground shrink-0">
            {new Date(thread.last_message.created_at).toLocaleDateString(
              undefined,
              { month: "short", day: "numeric" }
            )}
          </span>
        )}
      </div>
    </Link>
  );
}