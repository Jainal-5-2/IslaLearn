"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  getNotifications,
  getNotificationSocketUrl,
  markAllNotificationsRead,
  markNotificationRead,
  Notification,
} from "@/lib/api";

const FALLBACK_POLL_MS = 60_000;

/**
 * True if `link` is the current page. `/requests/17` matches
 * `/requests/17` and `/requests/17/` but not `/requests/170`.
 */
function matchesPath(link: string, pathname: string): boolean {
  if (link === pathname) return true;
  return pathname.startsWith(`${link}/`);
}

type DataValue = {
  items: Notification[];
  unreadCount: number;
  loading: boolean;
};

type ActionsValue = {
  refresh: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationDataContext = createContext<DataValue | null>(null);
const NotificationActionsContext = createContext<ActionsValue | null>(null);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Read the current pathname from event handlers without making the
  // socket effect depend on it. The socket stays open across
  // navigations; the handler reads the ref.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Same reason for items: the socket handler and the pathname effect
  // both need the current list without re-firing the socket effect.
  const itemsRef = useRef<Notification[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const baseTitleRef = useRef<string | null>(null);

  // Auto-mark a row that matches the current pathname. Returns the
  // rows it touched so the caller can setItems, and fires the POSTs.
  const applyAutoMark = useCallback(
    (rows: Notification[]): Notification[] => {
      const currentPath = pathnameRef.current;
      const markedIds: number[] = [];
      const next = rows.map((n) => {
        if (!n.is_read && matchesPath(n.target_link, currentPath)) {
          markedIds.push(n.id);
          return { ...n, is_read: true };
        }
        return n;
      });
      if (markedIds.length === 0) return rows;

      setUnreadCount((c) => Math.max(0, c - markedIds.length));
      for (const id of markedIds) {
        markNotificationRead(id).catch(() => {
          // Best-effort. The next refresh reverts the row.
        });
      }
      return next;
    },
    []
  );

  const refresh = useCallback(async () => {
    try {
      const data = await getNotifications();
      const marked = applyAutoMark(data.results);
      setItems(marked);
      setUnreadCount(
        data.unread_count -
          data.results.filter(
            (n) =>
              !n.is_read && matchesPath(n.target_link, pathnameRef.current)
          ).length
      );
    } catch {
      // Notifications are best-effort; the next poll will retry.
    } finally {
      setLoading(false);
    }
  }, [applyAutoMark]);

  const markRead = useCallback(async (id: number) => {
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, is_read: true } : x))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await markNotificationRead(id);
    } catch {
      refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
    setUnreadCount(0);
  }, []);

  // Initial fetch and 60s fallback poll. Skipped while the tab is
  // hidden so a background tab does not burn requests for nothing.
  useEffect(() => {
    refresh();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }, FALLBACK_POLL_MS);

    function onVisible() {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Realtime layer. Dependencies are [refresh] only: both are stable
  // (useCallback), so this runs once per provider mount and the socket
  // stays open across navigations.
  useEffect(() => {
    const url = getNotificationSocketUrl();
    if (!url) return;

    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;

    const connect = () => {
      ws = new WebSocket(url);
      ws.onopen = () => {
        retry = 0;
        refresh();
      };
      ws.onmessage = (ev) => {
        try {
          const frame = JSON.parse(ev.data);
          if (frame.type !== "notification") return;
          const incoming = frame.notification as Notification;
          const isForCurrentPage = matchesPath(
            incoming.target_link,
            pathnameRef.current
          );

          setItems((prev) => {
            if (prev.some((n) => n.id === incoming.id)) return prev;
            const toAdd = isForCurrentPage
              ? { ...incoming, is_read: true }
              : incoming;
            return [toAdd, ...prev].slice(0, 20);
          });

          if (!incoming.is_read && !isForCurrentPage) {
            setUnreadCount((c) => c + 1);
          }
          if (!incoming.is_read && isForCurrentPage) {
            markNotificationRead(incoming.id).catch(() => {
              refresh();
            });
          }
        } catch {
          // Ignore malformed frames; the next reconnect will resync.
        }
      };
      ws.onclose = () => {
        if (closed) return;
        const delay = Math.min(1000 * 2 ** retry, 15000);
        retry += 1;
        timer = setTimeout(connect, delay);
      };
    };
    connect();

    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }, [refresh]);

  // Pathname changes: auto-mark any unread rows already in `items` that
  // point at the new page.
  useEffect(() => {
    if (itemsRef.current.length === 0) return;
    const next = applyAutoMark(itemsRef.current);
    if (next !== itemsRef.current) {
      setItems(next);
    }
  }, [pathname, applyAutoMark]);

  // Tab title badge.
  useEffect(() => {
    if (baseTitleRef.current === null) {
      baseTitleRef.current = document.title.replace(/^\(\d+\+?\)\s*/, "");
    }
    const base = baseTitleRef.current;
    document.title = unreadCount > 0 ? `(${unreadCount}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [unreadCount]);

  // Favicon red dot.
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>(
      'link[rel~="icon"]'
    );
    if (!link) return;
    const originalHref = link.dataset.originalHref ?? link.href;
    if (!link.dataset.originalHref) {
      link.dataset.originalHref = originalHref;
    }

    if (unreadCount === 0) {
      link.href = originalHref;
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, size, size);
      ctx.beginPath();
      ctx.arc(size - 12, 12, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#dc2626";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
      link.href = canvas.toDataURL("image/png");
    };
    img.src = originalHref;
    return () => {
      cancelled = true;
      link.href = originalHref;
    };
  }, [unreadCount]);

  const dataValue = useMemo<DataValue>(
    () => ({ items, unreadCount, loading }),
    [items, unreadCount, loading]
  );

  const actionsValue = useMemo<ActionsValue>(
    () => ({ refresh, markRead, markAllRead }),
    [refresh, markRead, markAllRead]
  );

  return (
    <NotificationDataContext.Provider value={dataValue}>
      <NotificationActionsContext.Provider value={actionsValue}>
        {children}
      </NotificationActionsContext.Provider>
    </NotificationDataContext.Provider>
  );
}

export function useNotificationData(): DataValue {
  const ctx = useContext(NotificationDataContext);
  if (!ctx) {
    throw new Error(
      "useNotificationData must be used within a NotificationProvider"
    );
  }
  return ctx;
}

export function useNotificationActions(): ActionsValue {
  const ctx = useContext(NotificationActionsContext);
  if (!ctx) {
    throw new Error(
      "useNotificationActions must be used within a NotificationProvider"
    );
  }
  return ctx;
}