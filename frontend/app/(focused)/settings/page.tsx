"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut, Shield, Scale } from "lucide-react";
import { getMe, logout, User, ApiError } from "@/lib/api";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProfileSettings } from "@/components/profile-settings";
import { PageSkeleton } from "@/components/page-skeleton";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
        } else {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (loading) {
    return <PageSkeleton variant="form" />;
  }

  if (error || !user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4">
        <p className="text-red-600">{error || "Failed to load."}</p>
        <Link href="/dashboard" className="text-accent underline">
          Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Logo href="/dashboard" size={28} showText={false} />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Manage your profile and account.
          </p>
        </div>

        <ProfileSettings user={user} onSaved={setUser} />

        <section className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Account</h2>
          <dl className="space-y-3 text-sm mb-6">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Username</dt>
              <dd className="truncate text-right">{user.username}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate text-right">{user.email || "Not set"}</dd>
            </div>
          </dl>
          <div className="space-y-2">
            <Link
              href="/privacy"
              className="flex items-center gap-2 text-sm text-foreground hover:text-accent transition-colors"
            >
              <Shield className="h-4 w-4" />
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="flex items-center gap-2 text-sm text-foreground hover:text-accent transition-colors"
            >
              <Scale className="h-4 w-4" />
              Terms of Service
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-red-600 hover:bg-red-500/10 -mx-2 px-2 py-1 rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </section>

        <section className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2">Plan</h2>
          <p className="text-sm text-muted-foreground">
            You are on the{" "}
            <span className="font-medium text-foreground capitalize">
              {user.plan}
            </span>{" "}
            plan. Everything is free during the MVP phase. Paid plans are
            not offered yet.
          </p>
        </section>
      </main>
    </div>
  );
}