import { apiFetch } from "./client";
import type { Subject } from "./types";

export async function getSubjects(): Promise<Subject[]> {
  return apiFetch<Subject[]>("/subjects/");
}