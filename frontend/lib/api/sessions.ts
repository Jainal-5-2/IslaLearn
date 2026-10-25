import { apiFetch } from "./client";
import { normalizePaginated, type Paginated } from "./pagination";
import type {
  Review,
  Session,
  SessionDetailData,
  SessionSummary,
  UserReviewsResponse,
} from "./types";

export async function completeRequest(requestId: number): Promise<Session> {
  return apiFetch<Session>(`/requests/${requestId}/complete/`, {
    method: "POST",
  });
}

export async function completeBroadcast(
  broadcastId: number
): Promise<Session> {
  return apiFetch<Session>(`/broadcasts/${broadcastId}/complete/`, {
    method: "POST",
  });
}

export async function createReview(
  sessionId: number,
  data: { reviewee: number; rating: number; text?: string }
): Promise<Review> {
  return apiFetch<Review>(`/sessions/${sessionId}/reviews/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getUserReviews(
  userId: number
): Promise<UserReviewsResponse> {
  return apiFetch<UserReviewsResponse>(`/users/${userId}/reviews/`);
}

export async function getSessions(params?: {
  type?: "one_on_one" | "broadcast";
}): Promise<Paginated<SessionSummary>> {
  const search = new URLSearchParams();
  if (params?.type) search.set("type", params.type);
  const qs = search.toString();
  const data = await apiFetch<Paginated<SessionSummary> | SessionSummary[]>(
    `/sessions/${qs ? `?${qs}` : ""}`
  );
  return normalizePaginated(data);
}

export async function getSession(id: number): Promise<SessionDetailData> {
  return apiFetch<SessionDetailData>(`/sessions/${id}/`);
}