"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Users,
  Clock,
  Video,
  XCircle,
  LogOut,
  AlertCircle,
} from "lucide-react";
import {
  getBroadcast,
  getMe,
  joinBroadcast,
  leaveBroadcast,
  cancelBroadcast,
  BroadcastDetail,
  User,
  ApiError,
} from "@/lib/api";
import { PageSkeleton } from "@/components/page-skeleton";
import { SessionPanel, ReviewableUser } from "@/components/sessions-panel";
import { ReportButton } from "@/components/report-button";
import { showToast } from "@/components/toast";
import { cn } from "@/lib/utils";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <BroadcastDetailPage />
    </Suspense>
  );
}

function BroadcastDetailPage() {
  const params = useParams();
  const router = useRouter();
  const broadcastId = Number(params.id);

  const [broadcast, setBroadcast] = useState<BroadcastDetail | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  function refresh() {
    getBroadcast(broadcastId)
      .then(setBroadcast)
      .catch((e) =>
        showToast(e instanceof Error ? e.message : "Failed to refresh")
      );
  }

  useEffect(() => {
    Promise.all([getBroadcast(broadcastId), getMe()])
      .then(([b, u]) => {
        setBroadcast(b);
        setUser(u);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) {
          setError("Broadcast not found.");
        } else {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      })
      .finally(() => setLoading(false));
  }, [broadcastId]);

  async function handleJoin() {
    setBusy(true);
    try {
      const updated = await joinBroadcast(broadcastId);
      setBroadcast(updated);
      showToast("Joined broadcast");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to join");
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    setBusy(true);
    try {
      await leaveBroadcast(broadcastId);
      const updated = await getBroadcast(broadcastId);
      setBroadcast(updated);
      showToast("Left broadcast");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to leave");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (
      !confirm(
        "Cancel this broadcast? Participants will not be able to join, and this cannot be undone."
      )
    )
      return;
    setCancelling(true);
    try {
      const updated = await cancelBroadcast(broadcastId);
      setBroadcast(updated);
      showToast("Broadcast cancelled");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  }

  function enterRoom() {
    router.push(`/broadcasts/${broadcastId}/room`);
  }

  if (loading) {
    return <PageSkeleton variant="list" />;
  }

  if (error || !broadcast || !user) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">{error || "Broadcast not found."}</p>
        <Link href="/broadcasts" className="text-accent underline">
          Back to broadcasts
        </Link>
      </div>
    );
  }

  const isTutor = broadcast.is_tutor;
  const isParticipant = !!broadcast.my_participation;
  const isCancelled = broadcast.is_cancelled;
  const isFull = broadcast.is_full;
  const scheduled = new Date(broadcast.scheduled_at);
  const isPast = scheduled.getTime() < Date.now();

  const canJoin = broadcast.can_join && !isCancelled && !isPast;
  const canLeave = isParticipant && !isCancelled;
  const canEnterRoom = (isTutor || isParticipant) && !isCancelled;

  // Who can this user review? For a broadcast, everyone except
  // themselves: the tutor plus all participants. The backend re-checks
  // participants, so this list is only a picker.
  const reviewableUsers: ReviewableUser[] = [];
  if (broadcast.session) {
    if (broadcast.tutor.id !== user.id) {
      reviewableUsers.push({
        id: broadcast.tutor.id,
        username: broadcast.tutor.username,
      });
    }
    for (const p of broadcast.participants) {
      if (p.user.id !== user.id) {
        reviewableUsers.push({ id: p.user.id, username: p.user.username });
      }
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/broadcasts"
        className="inline-block text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; Back to broadcasts
      </Link>

      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-medium px-2 py-1 bg-muted rounded-md text-muted-foreground">
            {broadcast.subject.name}
          </span>
          {isCancelled && (
            <span className="text-xs font-medium px-2 py-1 bg-red-500/10 text-red-600 rounded-md">
              Cancelled
            </span>
          )}
          {isTutor && (
            <span className="text-xs font-medium px-2 py-1 bg-accent/10 text-accent rounded-md">
              Your broadcast
            </span>
          )}
          {isParticipant && !isCancelled && (
            <span className="text-xs font-medium px-2 py-1 bg-green-500/10 text-green-600 rounded-md">
              Joined
            </span>
          )}
          {isFull && !isParticipant && !isTutor && !isCancelled && (
            <span className="text-xs font-medium px-2 py-1 bg-muted text-muted-foreground rounded-md">
              Full
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold mb-2 break-words">
          {broadcast.title}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          by{" "}
          <Link
            href={`/profile/${broadcast.tutor.id}`}
            className="hover:text-accent transition-colors"
          >
            {broadcast.tutor.username}
          </Link>
        </p>

        {broadcast.description && (
          <p className="text-base whitespace-pre-wrap mb-6">
            {broadcast.description}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <Meta icon={Calendar} label="Scheduled">
            {scheduled.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </Meta>
          <Meta icon={Clock} label="Duration">
            {broadcast.duration_minutes} min
            {broadcast.duration_minutes > 30 && (
              <span className="text-orange-600 dark:text-orange-400">
                {" "}(capped at 30 on free plan)
              </span>
            )}
          </Meta>
          <Meta icon={Users} label="Participants">
            {broadcast.participant_count} / {broadcast.capacity}
          </Meta>
        </div>

        {isCancelled && (
          <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400 bg-red-500/10 p-3 rounded-lg mb-4">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              This broadcast was cancelled by the tutor. You cannot join it.
            </p>
          </div>
        )}

        {isPast && !isCancelled && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg mb-4">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              This broadcast was scheduled for{" "}
              {scheduled.toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              . It may have already ended.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-border">
          {canEnterRoom && (
            <button
              onClick={enterRoom}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
            >
              <Video className="h-4 w-4" />
              Enter room
            </button>
          )}

          {canJoin && (
            <button
              onClick={handleJoin}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {busy ? "Joining..." : "Join broadcast"}
            </button>
          )}

          {canLeave && (
            <button
              onClick={handleLeave}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md border border-border font-medium hover:bg-muted disabled:opacity-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Leave
            </button>
          )}

          {isTutor && !isCancelled && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md border border-red-500/40 text-red-600 font-medium hover:bg-red-500/10 disabled:opacity-50 transition-colors sm:ml-auto"
            >
              <XCircle className="h-4 w-4" />
              {cancelling ? "Cancelling..." : "Cancel broadcast"}
            </button>
          )}

          {!isTutor && !isCancelled && (
            <ReportButton
              target={{ target_broadcast: broadcast.id }}
              label="Report broadcast"
            />
          )}
        </div>
      </div>

      {isTutor && !isCancelled && (
        <SessionPanel
          kind="broadcast"
          targetId={broadcast.id}
          session={broadcast.session ?? null}
          reviewableUsers={reviewableUsers}
          canComplete={true}
          onSessionChanged={refresh}
        />
      )}

      {!isTutor && broadcast.session && (
        <SessionPanel
          kind="broadcast"
          targetId={broadcast.id}
          session={broadcast.session}
          reviewableUsers={reviewableUsers}
          canComplete={false}
          onSessionChanged={refresh}
        />
      )}

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">
          Participants ({broadcast.participants.length})
        </h2>
        {broadcast.participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one has joined yet.</p>
        ) : (
          <ul className="space-y-2">
            {broadcast.participants.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between p-2 rounded-md bg-background border border-border"
              >
                <Link
                  href={`/profile/${p.user.id}`}
                  className="text-sm font-medium hover:text-accent transition-colors"
                >
                  {p.user.username}
                </Link>
                <span className="text-xs text-muted-foreground">
                  joined {new Date(p.joined_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Meta({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-sm font-medium text-foreground">{children}</p>
    </div>
  );
}