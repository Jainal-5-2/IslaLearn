import { apiFetch } from "./client";
import { normalizeList, type Paginated } from "./pagination";
import type { Subject } from "./types";

export async function getSubjects(): Promise<Subject[]> {
  const data = await apiFetch<Paginated<Subject> | Subject[]>("/subjects/");
  return normalizeList(data);
}