import { apiFetch } from "./client";
import type { PublicUser } from "./types";

export async function getUser(id: number): Promise<PublicUser> {
  return apiFetch<PublicUser>(`/users/${id}/`);
}