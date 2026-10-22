"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Bell,
  Globe,
  Lock,
  TrendingUp,
  Plus,
  Video,
  MessageSquare,
  MessageCircle,
} from "lucide-react";
import {
  getMe,
  getTopics,
  getRequests,
  User,
  Topic,
  TutoringRequest,
} from "@/lib/api";
import { StatCard } from "@/components/stat-card";
import { QuickAction } from "@/components/quick-action";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageSkeleton } from "@/components/page-skeleton";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [myRequests, setMyRequests] = useState<TutoringRequest[]>([]);
  const [appliedRequests, setAppliedRequests] = useState<TutoringRequest[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getMe(),
      getTopics(),
      getRequests({ mine: true, status: "open" }),
      getRequests({ status: "open" }),
    ])
      .then(([userData, topicsData, mineData, browseData]) => {
        setUser(userData);
        setTopics(
          topicsData.results.filter((t) => t.created_by.id === userData.id)
        );
        setMyRequests(mineData.results);
        setAppliedRequests(
          browseData.results.filter((r) => !!r.my_application_status)
        );
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load")
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <PageSkeleton variant="list" />;
  }

  if (error) {
    return (
      <div className="max-w-md w-full mx-auto bg-card border border-border rounded-xl p-6 text-center mt-20">
        <p className="text-red-600 mb-4">{error}</p>
      </div>
    );
  }

  if (!user) return null;

  const publishedCount = topics.filter((t) => t.is_published).length;
  const draftCount = topics.filter((t) => !t.is_published).length;

  return (
    <>
      {/* Header */}
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

      {/* Stats */}
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

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Topics */}
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
                  You haven&apos;t created any topics yet.
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

          {/* My open requests */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">My open requests</h3>
              <Link
                href="/requests/new"
                className="text-sm text-accent hover:underline font-medium"
              >
                + New request
              </Link>
            </div>
            {myRequests.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground mb-4">
                  You don&apos;t have any open requests.
                </p>
                <Link
                  href="/requests/new"
                  className="inline-flex items-center justify-center h-9 px-3 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
                >
                  Post a request
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {myRequests.slice(0, 5).map((r) => (
                  <Link
                    key={r.id}
                    href={`/requests/${r.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {r.subject.name}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {r.description}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-md font-medium shrink-0 ml-2 bg-green-500/10 text-green-600">
                      {r.application_count ?? 0} application
                      {(r.application_count ?? 0) === 1 ? "" : "s"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Requests I've applied to */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Requests I&apos;ve applied to
              </h3>
              <Link
                href="/requests"
                className="text-sm text-accent hover:underline font-medium"
              >
                Browse
              </Link>
            </div>
            {appliedRequests.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground mb-4">
                  You haven&apos;t applied to any open requests yet.
                </p>
                <Link
                  href="/requests"
                  className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-border hover:bg-muted text-sm font-medium transition-colors"
                >
                  Browse open requests
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {appliedRequests.slice(0, 5).map((r) => (
                  <Link
                    key={r.id}
                    href={`/requests/${r.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {r.subject.name}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        by {r.tutee.username}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-xs px-2 py-1 rounded-md font-medium shrink-0 ml-2 capitalize",
                        r.my_application_status === "accepted" &&
                        "bg-green-500/10 text-green-600",
                        r.my_application_status === "rejected" &&
                        "bg-red-500/10 text-red-600",
                        r.my_application_status === "pending" &&
                        "bg-muted text-muted-foreground"
                      )}
                    >
                      {r.my_application_status}
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
              <QuickAction icon={Plus} label="Create a topic" href="/topics/new" />
              <QuickAction icon={BookOpen} label="Browse all topics" href="/topics" />
              <QuickAction icon={Video} label="Schedule broadcast" href="/broadcasts/new" />
              <QuickAction icon={MessageSquare} label="Post a request" href="/requests/new" />
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
    </>
  );
}