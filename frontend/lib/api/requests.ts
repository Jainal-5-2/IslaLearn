import { apiFetch } from "./client";
import { normalizePaginated, type Paginated } from "./pagination";
import type { Application, TutoringRequest } from "./types";

export async function getRequests(params?: {
  subject?: number;
  mine?: boolean;
  status?: "open" | "closed";
}): Promise<Paginated<TutoringRequest>> {
  const search = new URLSearchParams();
  if (params?.subject) search.set("subject", String(params.subject));
  if (params?.mine) search.set("mine", "true");
  if (params?.status) search.set("status", params.status);
  const qs = search.toString();
  const data = await apiFetch<Paginated<TutoringRequest> | TutoringRequest[]>(
    `/requests/${qs ? `?${qs}` : ""}`
  );
  return normalizePaginated(data);
}

export async function getRequest(id: number): Promise<TutoringRequest> {
  return apiFetch<TutoringRequest>(`/requests/${id}/`);
}

export async function createRequest(data: {
  subject: number;
  description: string;
  preferred_time?: string | null;
}): Promise<TutoringRequest> {
  return apiFetch<TutoringRequest>("/requests/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateRequest(
  id: number,
  data: {
    subject?: number;
    description?: string;
    preferred_time?: string | null;
  }
): Promise<TutoringRequest> {
  return apiFetch<TutoringRequest>(`/requests/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function closeRequest(id: number): Promise<TutoringRequest> {
  return apiFetch<TutoringRequest>(`/requests/${id}/close/`, {
    method: "POST",
  });
}

export async function applyToRequest(
  requestId: number,
  message: string
): Promise<Application> {
  return apiFetch<Application>(`/requests/${requestId}/apply/`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function decideApplication(
  applicationId: number,
  status: "accepted" | "rejected"
): Promise<Application> {
  return apiFetch<Application>(`/applications/${applicationId}/`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}