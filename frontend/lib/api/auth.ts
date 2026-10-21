import { apiFetch, clearTokens, setTokens } from "./client";
import type { LoginResponse, User } from "./types.ts";

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

export function logout() {
  clearTokens();
}