import { apiFetch, getAccessToken } from "./client";
import { normalizePaginated, type Paginated } from "./pagination";
import type { Message, ThreadSummary } from "./types";

export async function getThreads(): Promise<Paginated<ThreadSummary>> {
  const data = await apiFetch<Paginated<ThreadSummary> | ThreadSummary[]>(
    "/threads/"
  );
  return normalizePaginated(data);
}

export async function getThreadMessages(threadId: number): Promise<Message[]> {
  return apiFetch<Message[]>(`/threads/${threadId}/messages/`);
}

export async function sendThreadMessage(
  threadId: number,
  body: string
): Promise<Message> {
  return apiFetch<Message>(`/threads/${threadId}/messages/`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

/**
 * Build the WebSocket URL for a thread. Returns null when the API URL
 * or token is missing (e.g. during SSR or after logout), so callers
 * can skip opening a socket instead of connecting unauthenticated.
 *
 * The token is a query parameter because a browser cannot set headers
 * on a WebSocket handshake. Same caveat as the backend middleware.
 */
export function getThreadSocketUrl(threadId: number): string | null {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const token = getAccessToken();
  if (!apiUrl || !token) return null;
  const base = apiUrl.replace(/^http/, "ws").replace(/\/api$/, "");
  return `${base}/ws/threads/${threadId}/?token=${encodeURIComponent(token)}`;
}