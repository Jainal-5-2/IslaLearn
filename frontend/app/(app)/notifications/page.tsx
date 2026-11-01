"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import {
  useNotificationActions,
  useNotificationData,
} from "@/components/notification-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { showToast } from "@/components/toast";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/api";

export default function NotificationsPage() {
  const router = useRouter();
  const { items, unreadCount, loading } = useNotificationData();
  const { markRead, markAllRead } = useNotificationActions();
  const [markingAll, setMarkingAll] = useState(false);

  async function handleRowClick(n: Notification) {
    if (!n.is_read) {
      await markRead(n.id);
    }
    router.push(n.target_link);
  }

  async function handleMarkAll() {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await markAllRead();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to mark all read");
    } finally {
      setMarkingAll(false);
    }
  }

  if (loading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {unreadCount === 0
              ? "You're all caught up."
              : `${unreadCount} unread notification${
                  unreadCount === 1 ? "" : "s"
                }.`}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={markingAll}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border hover:bg-muted font-medium disabled:opacity-50 transition-colors"
          >
            <CheckCheck className="h-4 w-4" />
            {markingAll ? "Marking..." : "Mark all read"}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing here yet. Notifications arrive when someone applies to
            your request, accepts an application, completes a session,
            leaves a review, or sends a message.
          </p>
        </div>
      ) : (
        <ul className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => handleRowClick(n)}
                className={cn(
                  "w-full text-left px-4 py-3 hover:bg-muted transition-colors",
                  !n.is_read && "bg-accent/5"
                )}
              >
                <p className="text-sm text-foreground">
                  <span className="font-medium">
                    {n.actor?.username ?? "System"}
                  </span>{" "}
                  {notificationCopy(n)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(n.created_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function notificationCopy(n: Notification): string {
  switch (n.kind) {
    case "application_received":
      return `applied to your request on ${n.target_label}.`;
    case "application_accepted":
      return `accepted your application on ${n.target_label}.`;
    case "application_rejected":
      return `rejected your application on ${n.target_label}.`;
    case "engagement_cancelled":
      return `cancelled your engagement on ${n.target_label}.`;
    case "session_completed":
      return `marked ${n.target_label} complete.`;
    case "review_received":
      return `left you ${n.target_label}.`;
    case "message_received":
      return `sent a new message on ${n.target_label}.`;
  }
}