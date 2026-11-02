import { apiFetch } from "./client";
import { normalizePaginated, type Paginated } from "./pagination";
import type { Topic, TopicProgress } from "./types";

export async function getTopics(params?: {
  subject?: number;
  createdBy?: number;
  progressFor?: number;
}): Promise<Paginated<Topic>> {
  const search = new URLSearchParams();
  if (params?.subject) search.set("subject", String(params.subject));
  if (params?.createdBy) search.set("created_by", String(params.createdBy));
  if (params?.progressFor) search.set("progress_for", String(params.progressFor));
  const qs = search.toString();
  const data = await apiFetch<Paginated<Topic> | Topic[]>(
    `/topics/${qs ? `?${qs}` : ""}`
  );
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

/**
 * POST /api/topics/{id}/quiz/{pageId}/submit/
 *
 * Server-side scoring. `answers` is an array of selected option indices,
 * one per question, in the same order as the page's questions. A retake
 * overwrites the stored result; no attempt history.
 *
 * The response includes `passing_score` (not part of the stored entry)
 * so the UI can explain a failure ("you needed 2 of 3").
 */
export async function submitQuiz(
  topicId: number,
  pageId: number,
  answers: number[]
): Promise<{
  score: number;
  total: number;
  passed: boolean;
  passing_score: number;
}> {
  return apiFetch(`/topics/${topicId}/quiz/${pageId}/submit/`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}