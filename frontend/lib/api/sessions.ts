import { apiFetch } from "./client";
import type { Review, Session, UserReviewsResponse } from "./types";

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