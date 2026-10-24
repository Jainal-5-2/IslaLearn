import { apiFetch } from "./client";
import type { Report, ReportCategory } from "./types";

export async function createReport(data: {
  target_user?: number;
  target_topic?: number;
  target_broadcast?: number;
  category: ReportCategory;
  reason?: string;
}): Promise<Report> {
  return apiFetch<Report>("/reports/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

