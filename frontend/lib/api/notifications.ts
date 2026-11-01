import { apiFetch, getAccessToken } from "./client";
import type { Notification } from "./types";
import type { Paginated } from "./pagination";

type NotificationListResponse = Paginated<Notification> & {
  unread_count: number;
};

export async function getNotifications(): Promise<NotificationListResponse> {
  return apiFetch<NotificationListResponse>("/notifications/");
}

export async function markNotificationRead(
  id: number
): Promise<Notification> {
  return apiFetch<Notification>(`/notifications/${id}/read/`, {
    method: "POST",
  });
}

export async function markAllNotificationsRead(): Promise<{
  updated: number;
  unread_count: number;
}> {
  return apiFetch<{ updated: number; unread_count: number }>(
    "/notifications/read-all/",
    { method: "POST" }
  );
}

/**
 * Build the WebSocket URL for the per-user notification channel.
 * Returns null when the API URL or token is missing (e.g. during SSR
 * or after logout), so callers can skip opening a socket instead of
 * connecting unauthenticated.
 *
 * The token is a query parameter for the same reason as the thread
 * socket: a browser cannot set headers on a WebSocket handshake. Same
 * caveat as the backend middleware.
 */
export function getNotificationSocketUrl(): string | null {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const token = getAccessToken();
  if (!apiUrl || !token) return null;
  const base = apiUrl.replace(/^http/, "ws").replace(/\/api\/?$/, "");
  return `${base}/ws/notifications/?token=${encodeURIComponent(token)}`;
}