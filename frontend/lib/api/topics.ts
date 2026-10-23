import { apiFetch } from "./client";
import { normalizePaginated, type Paginated } from "./pagination";
import type { Topic, TopicProgress } from "./types";

export async function getTopics(
  subjectId?: number
): Promise<Paginated<Topic>> {
  const query = subjectId ? `?subject=${subjectId}` : "";
  const data = await apiFetch<Paginated<Topic> | Topic[]>(`/topics/${query}`);
  return normalizePaginated(data);
}

export async function getTopic(id: number): Promise<Topic> {
  return apiFetch<Topic>(`/topics/${id}/`);
}

export async function createTopic(data: {
  subject: number;
  title: string;
  description: string;
  is_published: boolean;
  free_page_count: number;
}): Promise<Topic> {
  return apiFetch<Topic>("/topics/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTopic(
  id: number,
  data: {
    subject?: number;
    title?: string;
    description?: string;
    is_published?: boolean;
    free_page_count?: number;
  }
): Promise<Topic> {
  return apiFetch<Topic>(`/topics/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteTopic(id: number): Promise<void> {
  return apiFetch<void>(`/topics/${id}/`, { method: "DELETE" });
}

export async function recordProgress(
  topicId: number,
  lastPageIndex: number,
  options?: { reset?: boolean }
): Promise<TopicProgress> {
  return apiFetch<TopicProgress>(`/topics/${topicId}/progress/`, {
    method: "POST",
    body: JSON.stringify({
      last_page_index: lastPageIndex,
      reset: options?.reset ?? false,
    }),
  });
}

export async function unlockTopic(topicId: number): Promise<TopicProgress> {
  return apiFetch<TopicProgress>(`/topics/${topicId}/unlock/`, {
    method: "POST",
  });
}