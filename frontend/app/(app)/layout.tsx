"use client";

import { AppShell } from "@/components/app-shell";
import { PageSkeleton } from "@/components/page-skeleton";
import { getMe, isLoggedIn, logout, User } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);

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

  async function handleRetry() {
    setRetrying(true);
    setError("");
    try {
      const u = await getMe();
      setUser(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setRetrying(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {retrying ? "Retrying..." : "Try again"}
            </button>
            <button
              onClick={handleLogout}
              className="h-10 px-4 rounded-md border border-border hover:bg-muted font-medium transition-colors"
            >
              Log out
            </button>
          </div>
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