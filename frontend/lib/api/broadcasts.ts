import { apiFetch } from "./client";
import { normalizePaginated, type Paginated } from "./pagination";
import type { Broadcast, BroadcastDetail } from "./types";

export async function getBroadcasts(params?: {
  subject?: number;
  past?: boolean;
  tutor?: number;
}): Promise<Paginated<Broadcast>> {
  const search = new URLSearchParams();
  if (params?.subject) search.set("subject", String(params.subject));
  if (params?.past) search.set("past", "true");
  if (params?.tutor) search.set("tutor", String(params.tutor));
  const qs = search.toString();
  const data = await apiFetch<Paginated<Broadcast> | Broadcast[]>(
    `/broadcasts/${qs ? `?${qs}` : ""}`
  );
  return normalizePaginated(data);
}

export async function getBroadcast(id: number): Promise<BroadcastDetail> {
  return apiFetch<BroadcastDetail>(`/broadcasts/${id}/`);
}

export async function createBroadcast(data: {
  subject: number;
  title: string;
  description?: string;
  scheduled_at: string;
  duration_minutes: number;
  capacity: number;
}): Promise<BroadcastDetail> {
  return apiFetch<BroadcastDetail>("/broadcasts/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function joinBroadcast(id: number): Promise<BroadcastDetail> {
  return apiFetch<BroadcastDetail>(`/broadcasts/${id}/join/`, {
    method: "POST",
  });
}

export async function leaveBroadcast(id: number): Promise<void> {
  return apiFetch<void>(`/broadcasts/${id}/leave/`, {
    method: "DELETE",
  });
}

export async function cancelBroadcast(id: number): Promise<BroadcastDetail> {
  return apiFetch<BroadcastDetail>(`/broadcasts/${id}/cancel/`, {
    method: "POST",
  });
}

export async function getBroadcastRoomUrl(
  id: number
): Promise<{ room_url: string }> {
  return apiFetch<{ room_url: string }>(`/broadcasts/${id}/room-url/`);
}