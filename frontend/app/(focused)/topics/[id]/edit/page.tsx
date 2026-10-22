"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Menu, X } from "lucide-react";
import {
  getTopic,
  getMe,
  getSubjects,
  Topic,
  Subject,
  User,
  ApiError,
} from "@/lib/api";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { TopicForm } from "@/components/topic-form";
import { PageList } from "@/components/page-list";
import { PageEditor } from "@/components/page-editor";
import { PageSkeleton } from "@/components/page-skeleton";
import { cn } from "@/lib/utils";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="editor" />}>
      <TopicEditPage />
    </Suspense>
  );
}

function TopicEditPage() {
  const params = useParams();
  const topicId = Number(params.id);

  const [topic, setTopic] = useState<Topic | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingPageIndex, setEditingPageIndex] = useState<number | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [topicData, userData, subjectsData] = await Promise.all([
          getTopic(topicId),
          getMe(),
          getSubjects(),
        ]);
        setTopic(topicData);
        setCurrentUser(userData);
        setSubjects(subjectsData);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setError("Topic not found.");
        } else if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to edit this topic.");
        } else {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [topicId, refreshKey]);

  if (loading) {
    return <PageSkeleton variant="editor" />;
  }

  if (error || !topic) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <p className="text-red-600">{error || "Topic not found."}</p>
        <Link href="/topics" className="text-accent underline">
          Back to topics
        </Link>
      </main>
    );
  }

  if (currentUser?.id !== topic.created_by.id) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <p className="text-red-600">
          You don&apos;t have permission to edit this topic.
        </p>
        <Link href={`/topics/${topic.id}`} className="text-accent underline">
          View topic instead
        </Link>
      </main>
    );
  }

  const pages = topic.pages || [];
  const isEditing = isAddingNew || editingPageIndex !== null;
  const editingPage =
    editingPageIndex !== null ? pages[editingPageIndex] : null;

  function handleCancel() {
    setIsAddingNew(false);
    setEditingPageIndex(null);
  }

  function handleSaved() {
    handleCancel();
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Mobile Top Bar */}
      <div className="lg:hidden sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="inline-flex items-center gap-2 text-sm font-medium hover:text-accent transition-colors"
          aria-label="Open pages"
        >
          <Menu className="h-5 w-5" />
          Pages
        </button>
        <Logo size={32} showText={false} />
        <ThemeToggle />
      </div>

      <div className="flex flex-1 lg:flex-row min-h-0">
        {isSidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside
          className={cn(
            "bg-card border-border flex flex-col",
            "fixed lg:sticky inset-y-0 lg:inset-y-auto left-0 z-50 lg:z-auto w-80 max-w-[85vw] sm:max-w-sm transition-transform duration-300",
            isSidebarOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0",
            "lg:w-80 lg:border-r lg:top-0 lg:h-screen lg:shrink-0"
          )}
        >
          <div className="p-6 border-b border-border flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-4">
                <Logo href="/dashboard" size={32} showText={false} />
                <Link
                  href={`/topics/${topic.id}`}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  View topic
                </Link>
              </div>
              <h1 className="text-xl font-bold leading-tight mb-1 truncate">
                Editing: {topic.title}
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                {topic.subject.name}
              </p>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Close pages"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
              Pages ({pages.length})
            </h2>
            <PageList
              pages={pages}
              activeIndex={editingPageIndex ?? -1}
              onSelect={(index) => {
                setEditingPageIndex(index);
                setIsAddingNew(false);
                setIsSidebarOpen(false);
              }}
              onAdd={() => {
                setEditingPageIndex(null);
                setIsAddingNew(true);
                setIsSidebarOpen(false);
              }}
            />
          </div>
        </aside>

        <section className="flex-1 min-w-0 px-6 lg:px-12 py-6 lg:py-12">
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <TopicForm
              topic={topic}
              subjects={subjects}
              onSaved={handleSaved}
            />

            {isEditing ? (
              <PageEditor
                topicId={topic.id}
                page={editingPage}
                nextOrder={pages.length + 1}
                onSaved={handleSaved}
                onCancel={handleCancel}
              />
            ) : (
              <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
                <h3 className="text-lg font-semibold mb-2">
                  Select a page to edit
                </h3>
                <p className="text-muted-foreground mb-6">
                  {pages.length === 0
                    ? "Add your first page to start building this topic."
                    : "Choose a page from the sidebar, or add a new one."}
                </p>
                <button
                  onClick={() => setIsAddingNew(true)}
                  className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
                >
                  + Add page
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}