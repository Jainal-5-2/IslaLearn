import { apiFetch } from "./client";
import type { Topic } from "./types";

export async function getTopics(
  subjectId?: number
): Promise<{ results: Topic[] }> {
  const query = subjectId ? `?subject=${subjectId}` : "";
  return apiFetch<{ results: Topic[] }>(`/topics/${query}`);
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