/**
 * API client for the IslaLearn DRF backend.
 *
 * Responsibilities:
 *   - Read and write JWT tokens from localStorage.
 *   - Attach the access token to every request.
 *   - On 401, transparently refresh the access token once and retry.
 *   - Surface non-2xx responses as ApiError with the server's message.
 *   - Preserve the response body on ApiError so callers can inspect
 *     field-level errors (e.g. `{ age_confirmed: [...] }`).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. Copy .env.example to .env.local " +
      "and fill it in, or pass it to `next dev` and `next build`."
  );
}

// ---------- Token storage ----------
export function setTokens(access: string, refresh: string) {
  localStorage.setItem("access", access);
  localStorage.setItem("refresh", refresh);
}

export function clearTokens() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access");
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh");
}

export function isLoggedIn(): boolean {
  return !!getAccessToken();
}

// ---------- Error class ----------
export class ApiError extends Error {
  body: unknown;
  status: number;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// ---------- Refresh logic ----------
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const res = await fetch(`${API_URL}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { access: string; refresh?: string };
    localStorage.setItem("access", data.access);
    if (data.refresh) localStorage.setItem("refresh", data.refresh);
    return true;
  } catch {
    return false;
  }
}

// ---------- Core fetch wrapper ----------
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const token = getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && !isRetry) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    // Wait for whichever refresh is in flight (this one or another
    // caller's), then retry once if it succeeded.
    const pending = refreshPromise;
    const success = pending ? await pending : false;

    if (success) {
      return apiFetch<T>(path, options, true);
    }

    clearTokens();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ApiError("Session expired. Please log in again.", 401, null);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let body: unknown = null;
    try {
      body = await res.json();
      message = firstErrorString(body) ?? message;
    } catch {
      // Non-JSON error body. Keep the status-based message.
    }
    throw new ApiError(message, res.status, body);
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

/**
 * Walk an arbitrary JSON error body and return the first string found.
 *
 * DRF produces several shapes:
 *   { "detail": "msg" }
 *   { "field": ["msg"] }
 *   { "non_field_errors": ["msg"] }
 *   ["msg"]
 *   "msg"
 *
 * This function returns the first leaf string in any of those shapes,
 * which is what we want for a single-line toast or inline error.
 */
function firstErrorString(body: unknown): string | null {
  if (typeof body === "string") return body;
  if (Array.isArray(body)) {
    for (const item of body) {
      const found = firstErrorString(item);
      if (found) return found;
    }
    return null;
  }
  if (body && typeof body === "object") {
    for (const value of Object.values(body)) {
      const found = firstErrorString(value);
      if (found) return found;
    }
    return null;
  }
  return null;
}