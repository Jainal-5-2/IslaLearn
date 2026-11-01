import { apiFetch, clearTokens, setTokens } from "./client";
import type { LoginResponse, User } from "./types";

export async function register(
  username: string,
  email: string,
  password: string,
  ageConfirmed: boolean
): Promise<User> {
  return apiFetch<User>("/auth/register/", {
    method: "POST",
    body: JSON.stringify({
      username,
      email,
      password,
      age_confirmed: ageConfirmed,
    }),
  });
}

export async function login(
  username: string,
  password: string
): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setTokens(data.access, data.refresh);
  return data;
}

export async function getMe(): Promise<User> {
  return apiFetch<User>("/auth/me/");
}

/**
 * PATCH /api/auth/me/ with a FormData body. Bio is always sent when
 * provided; the picture is only sent when a File is passed, so a
 * caller that only edits bio does not re-upload the current picture.
 *
 * The caller must pass `picture` as `undefined` when it did not touch
 * the file input. Passing `null` is treated the same as `undefined`.
 * Removing a picture is not supported in v1.
 */
export async function updateMe(input: {
  bio?: string;
  picture?: File | null;
}): Promise<User> {
  const form = new FormData();
  if (input.bio !== undefined) {
    form.append("bio", input.bio);
  }
  if (input.picture instanceof File) {
    form.append("profile_picture", input.picture);
  }
  return apiFetch<User>("/auth/me/", {
    method: "PATCH",
    body: form,
  });
}

export function logout() {
  clearTokens();
}