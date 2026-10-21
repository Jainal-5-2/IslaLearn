import { apiFetch } from "./client";
import type { TopicPage } from "./types";

export async function createTopicPage(
  topicId: number,
  data: {
    order: number;
    page_type: "text" | "video" | "quiz";
    content: Record<string, unknown>;
  }
): Promise<TopicPage> {
  return apiFetch<TopicPage>(`/topics/${topicId}/pages/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTopicPage(
  topicId: number,
  pageId: number,
  data: {
    order?: number;
    page_type?: "text" | "video" | "quiz";
    content?: Record<string, unknown>;
  }
): Promise<TopicPage> {
  return apiFetch<TopicPage>(`/topics/${topicId}/pages/${pageId}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteTopicPage(
  topicId: number,
  pageId: number
): Promise<void> {
  return apiFetch<void>(`/topics/${topicId}/pages/${pageId}/`, {
    method: "DELETE",
  });
}