"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, isLoggedIn, logout, User } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    getMe()
      .then(setUser)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"));
  }, [router]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">{error}</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Hello, {user.username}</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-red-600 underline"
          >
            Log out
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-gray-500">Email</dt>
          <dd>{user.email || "—"}</dd>
          <dt className="text-gray-500">Plan</dt>
          <dd>{user.plan}</dd>
          <dt className="text-gray-500">Tutor</dt>
          <dd>{user.is_tutor ? "Yes" : "No"}</dd>
          <dt className="text-gray-500">Tutee</dt>
          <dd>{user.is_tutee ? "Yes" : "No"}</dd>
        </dl>

        <p className="text-xs text-gray-400 pt-2 border-t">
          This page is rendered from <code>GET /api/auth/me/</code> — proof
          that Next.js, Django, JWT, and MySQL are all talking.
        </p>
      </div>
    </main>
  );
}