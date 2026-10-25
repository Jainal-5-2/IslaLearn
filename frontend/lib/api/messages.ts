import { apiFetch } from "./client";
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