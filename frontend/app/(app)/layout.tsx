"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, isLoggedIn, logout, User } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { PageSkeleton } from "@/components/page-skeleton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load")
      );
  }, [router]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleLogout}
            className="text-sm text-accent underline"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="w-64 max-w-[85vw] border-r border-border bg-card shrink-0 hidden lg:block" />
        <div className="flex-1 p-4 sm:p-6">
          <PageSkeleton variant="list" />
        </div>
      </div>
    );
  }

  return (
    <AppShell user={user} onLogout={handleLogout}>
      {children}
    </AppShell>
  );
}