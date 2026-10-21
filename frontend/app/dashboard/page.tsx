"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Bell,
  Globe,
  Lock,
  TrendingUp,
  Menu,
  Plus,
  Video,
  MessageSquare,
} from "lucide-react";
import { getMe, getTopics, isLoggedIn, logout, User, Topic } from "@/lib/api";
import { Logo } from "@/components/logo";
import { Footer } from "@/components/footer";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { StatCard } from "@/components/stat-card";
import { QuickAction } from "@/components/quick-action";
import { ThemeToggle } from "@/components/theme-toggle";
import { FullPageLoader } from "@/components/full-page-loader";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [error, setError] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }

    Promise.all([getMe(), getTopics()])
      .then(([userData, topicsData]) => {
        setUser(userData);
        setTopics(
          topicsData.results.filter((t) => t.created_by.id === userData.id)
        );
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load")
      )
      .finally(() => setIsCheckingAuth(false));
  }, [router]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (isCheckingAuth) {
    return <FullPageLoader />;
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleLogout}
            className="text-sm text-accent underline"
          >
            Back to login
          </button>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const publishedCount = topics.filter((t) => t.is_published).length;
  const draftCount = topics.filter((t) => !t.is_published).length;

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar
        user={user}
        open={isSidebarOpen}
        setOpen={setIsSidebarOpen}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="inline-flex items-center gap-2 text-sm font-medium hover:text-accent transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
            Menu
          </button>
          <Logo size={32} showText={false} />
          <ThemeToggle />
        </div>

        {/* Main content */}
        <div className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                Welcome back, {user.username}
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 sm:gap-4">
              <button className="relative p-2 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground transition-colors">
                <Bell className="h-5 w-5" />
              </button>
              <ThemeToggle />
              <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent">
                {user.username[0].toUpperCase()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <StatCard
              icon={BookOpen}
              label="Total Topics"
              value={topics.length}
              hint="Created by you"
            />
            <StatCard
              icon={Globe}
              label="Published"
              value={publishedCount}
              hint="Visible to everyone"
              accent
            />
            <StatCard
              icon={Lock}
              label="Drafts"
              value={draftCount}
              hint="Only visible to you"
            />
            <StatCard
              icon={TrendingUp}
              label="Plan"
              value={user.plan === "paid" ? "Pro" : "Free"}
              hint="MVP phase: all free"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Your Topics</h3>
                  <Link
                    href="/topics/new"
                    className="text-sm text-accent hover:underline font-medium"
                  >
                    + New topic
                  </Link>
                </div>
                {topics.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground mb-4">
                      You haven't created any topics yet.
                    </p>
                    <Link
                      href="/topics/new"
                      className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
                    >
                      Create your first topic
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topics.slice(0, 5).map((topic) => (
                      <Link
                        key={topic.id}
                        href={`/topics/${topic.id}`}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {topic.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {topic.subject.name} · {topic.page_count} pages
                          </p>
                        </div>
                        <span
                          className={cn(
                            "text-xs px-2 py-1 rounded-md font-medium shrink-0 ml-2",
                            topic.is_published
                              ? "bg-green-500/10 text-green-600"
                              : "bg-orange-500/10 text-orange-600"
                          )}
                        >
                          {topic.is_published ? "Published" : "Draft"}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <QuickAction
                    icon={Plus}
                    label="Create a topic"
                    href="/topics/new"
                  />
                  <QuickAction
                    icon={BookOpen}
                    label="Browse all topics"
                    href="/topics"
                  />
                  <QuickAction
                    icon={Video}
                    label="Schedule broadcast"
                    href="/broadcasts/new"
                  />
                  <QuickAction
                    icon={MessageSquare}
                    label="Post a request"
                    href="/requests/new"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold mb-4">Your Profile</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="truncate ml-2">{user.email || "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Role</dt>
                    <dd>
                      {user.is_tutor && user.is_tutee
                        ? "Tutor & Tutee"
                        : user.is_tutor
                        ? "Tutor"
                        : "Tutee"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Plan</dt>
                    <dd className="capitalize">{user.plan}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <Footer isLoggedIn={true} />
      </div>
    </div>
  );
}