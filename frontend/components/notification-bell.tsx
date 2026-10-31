"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import {
  useNotificationActions,
  useNotificationData,
} from "@/components/notification-provider";
import { showToast } from "@/components/toast";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/api";

export function NotificationBell() {
  const router = useRouter();
  const { items, unreadCount } = useNotificationData();
  const { markRead, markAllRead } = useNotificationActions();
  const [open, setOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleRowClick(n: Notification) {
    if (!n.is_read) {
      await markRead(n.id);
    }
    setOpen(false);
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

  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${
          unreadCount > 0 ? ` (${unreadCount} unread)` : ""
        }`}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold">
            {badgeText}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={markingAll}
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-medium disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {markingAll ? "Marking..." : "Mark all read"}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleRowClick(n)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 hover:bg-muted transition-colors border-b border-border last:border-b-0",
                      !n.is_read && "bg-accent/5"
                    )}
                  >
                    <p className="text-sm text-foreground line-clamp-2">
                      <span className="font-medium">
                        {n.actor?.username ?? "System"}
                      </span>{" "}
                      {notificationCopy(n)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
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

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/notifications");
            }}
            className="w-full px-3 py-2 text-sm text-center text-accent hover:bg-muted font-medium border-t border-border transition-colors"
          >
            View all
          </button>
        </div>
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
    case "session_completed":
      return `marked ${n.target_label} complete.`;
    case "review_received":
      return `left you ${n.target_label}.`;
    case "message_received":
      return `sent a new message on ${n.target_label}.`;
  }
}