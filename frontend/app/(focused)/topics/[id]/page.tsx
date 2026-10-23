"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Lock,
  FileText,
  Video as VideoIcon,
  ClipboardList,
  Clock,
  CheckCircle2,
  PlayCircle,
  Pencil,
} from "lucide-react";
import {
  getTopic,
  getMe,
  recordProgress,
  Topic,
  User,
  ApiError,
} from "@/lib/api";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageSkeleton } from "@/components/page-skeleton";
import { cn } from "@/lib/utils";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="reader" />}>
      <TopicDetailPage />
    </Suspense>
  );
}

function TopicDetailPage() {
  const params = useParams();
  const router = useRouter();
  const topicId = Number(params.id);

  const [topic, setTopic] = useState<Topic | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const [topicData, userData] = await Promise.all([
          getTopic(topicId),
          getMe(),
        ]);
        if (cancelled) return;

        setTopic(topicData);
        setCurrentUser(userData);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setError("Topic not found.");
        } else {
          setError(err instanceof Error ? err.message : "Failed to load topic");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [topicId]);

  async function handleStartReading() {
    if (!topic) return;
    setStartError("");
    setStarting(true);
    try {
      // Only write the initial progress row for first-time readers.
      // Returning readers already have progress; overwriting it with 0
      // would break the reader's resume-to-last-page behavior.
      if (!topic.progress) {
        await recordProgress(topic.id, 0);
      }
      router.push(`/topics/${topic.id}/read`);
    } catch (err) {
      setStartError(
        err instanceof Error ? err.message : "Failed to start reading."
      );
      setStarting(false);
    } finally{
      setStarting(false);
    }
  }

  if (loading) {
    return <PageSkeleton variant="reader" />;
  }

  if (error || !topic || !currentUser) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4">
        <p className="text-red-600">{error || "Topic not found."}</p>
        <Link href="/topics" className="text-accent underline">
          Back to topics
        </Link>
      </main>
    );
  }

  const isOwner = currentUser.id === topic.created_by.id;
  const pages = topic.pages || [];
  const pageCount = pages.length;
  const freeCount = Math.min(topic.free_page_count, pageCount);
  const lockedCount = Math.max(0, pageCount - freeCount);
  const firstPage = pages[0];

  const previewBody: string | null =
    firstPage && firstPage.page_type === "text" && firstPage.content?.body
      ? String(firstPage.content.body)
      : null;

  const previewType = firstPage?.page_type ?? null;

  const readButtonLabel = (() => {
    if (pageCount === 0) return "No pages yet";
    if (starting) return "Starting...";
    if (topic.progress?.is_completed) return "Read again";
    if (topic.progress) return "Continue reading";
    return "Start reading";
  })();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/topics"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Topics
            </Link>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Logo href="/dashboard" size={28} showText={false} />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Title block */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs font-medium px-2 py-1 bg-muted rounded-md text-muted-foreground">
              {topic.subject.name}
            </span>
            {!topic.is_published && (
              <span className="text-xs font-medium px-2 py-1 bg-orange-500/10 text-orange-600 rounded-md">
                Draft
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-3 break-words">
            {topic.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            by{" "}
            <span className="text-foreground">{topic.created_by.username}</span>
            {" · "}
            {pageCount} {pageCount === 1 ? "page" : "pages"}
          </p>
        </div>

        {/* Metadata cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <MetaCard
            icon={<BookOpen className="h-4 w-4" />}
            label="Total pages"
            value={String(pageCount)}
          />
          <MetaCard
            icon={<Clock className="h-4 w-4" />}
            label="Free pages"
            value={String(freeCount)}
            accent
          />
          <MetaCard
            icon={<Lock className="h-4 w-4" />}
            label="Locked pages"
            value={String(lockedCount)}
          />
        </div>

        {/* Description */}
        {topic.description && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              About this topic
            </h2>
            <p className="text-base leading-relaxed whitespace-pre-wrap text-foreground">
              {topic.description}
            </p>
          </section>
        )}

        {/* Preview */}
        {firstPage && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Preview: page 1
            </h2>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                {previewType === "text" && (
                  <FileText className="h-3.5 w-3.5" />
                )}
                {previewType === "video" && (
                  <VideoIcon className="h-3.5 w-3.5" />
                )}
                {previewType === "quiz" && (
                  <ClipboardList className="h-3.5 w-3.5" />
                )}
                <span className="capitalize">{previewType ?? "page"}</span>
              </div>
              {previewBody ? (
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap line-clamp-[12] break-words">
                  {previewBody}
                </p>
              ) : previewType === "video" ? (
                <p className="text-sm text-muted-foreground italic">
                  This topic starts with a video page.
                </p>
              ) : previewType === "quiz" ? (
                <p className="text-sm text-muted-foreground italic">
                  This topic starts with a quiz page.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  This page has no previewable content.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Actions */}
        <section className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {isOwner ? (
            <>
              <Link
                href={`/topics/${topic.id}/edit`}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
              >
                <Pencil className="h-4 w-4" />
                Edit topic
              </Link>
              <Link
                href={`/topics/${topic.id}/read`}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg border border-border hover:bg-muted font-medium transition-colors"
              >
                <PlayCircle className="h-4 w-4" />
                Read as student
              </Link>
            </>
          ) : (
            <button
              onClick={handleStartReading}
              disabled={starting || pageCount === 0}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg bg-accent text-accent-foreground font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <PlayCircle className="h-4 w-4" />
              {readButtonLabel}
            </button>
          )}
        </section>

        {startError && (
          <p className="mt-3 text-sm text-red-600 bg-red-500/10 p-3 rounded-lg">
            {startError}
          </p>
        )}

        {topic.progress?.is_completed && !isOwner && (
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            You completed this topic on{" "}
            {new Date(topic.progress.completed_at!).toLocaleDateString()}.
          </p>
        )}
      </main>
    </div>
  );
}

function MetaCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium mb-2",
          accent ? "text-accent" : "text-muted-foreground"
        )}
      >
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}