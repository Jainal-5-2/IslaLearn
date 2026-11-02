"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, PlayCircle, CheckCircle2 } from "lucide-react";
import {
  getSubjects,
  getTopics,
  getMe,
  Subject,
  Topic,
  User,
} from "@/lib/api";
import { SubjectCombobox } from "@/components/subject-combobox";
import { PageSkeleton } from "@/components/page-skeleton";
import { cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

type Tab = "browse" | "mine";

export default function TopicsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("browse");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getSubjects(), getMe()])
      .then(([subjectsData, userData]) => {
        setSubjects(subjectsData);
        setUser(userData);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load")
      );
  }, []);

  useEffect(() => {
    // Do not fire the topics fetch until we know who the user is. The
    // "mine" tab needs user.id and the "browse" tab would just waste a
    // request that gets replaced a tick later.
    if (!user) return;

    let cancelled = false;
    setLoading(true);
    getTopics({
      subject: selectedSubject ?? undefined,
      createdBy: tab === "mine" ? user.id : undefined,
    })
      .then((data) => {
        if (!cancelled) setTopics(data.results);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSubject, tab, user]);

  const selectedSubjectName =
    selectedSubject !== null
      ? subjects.find((s) => s.id === selectedSubject)?.name
      : null;

  return (
    // Fixed to the viewport: header, tabs, and filter pinned; only the
    // grid scrolls. 4rem is the (app) layout's mobile header; 3rem is
    // main's vertical padding on lg+.
    <div className="flex flex-col h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-3rem)]">
      {/* Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Browse Topics</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Async learning resources from your peers
          </p>
        </div>
        <Link
          href="/topics/new"
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Create Topic
        </Link>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex gap-1 p-1 bg-muted rounded-lg w-full sm:w-fit mb-4">
        {(["browse", "mine"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors",
              tab === t
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "browse" ? "Browse" : "My topics"}
          </button>
        ))}
      </div>

      {/* Filter row */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-6">
        <SubjectCombobox
          subjects={subjects}
          value={selectedSubject}
          onChange={setSelectedSubject}
        />
        {!loading && (
          <p className="text-xs sm:text-sm text-muted-foreground px-1 sm:px-0">
            {topics.length === 0
              ? "No topics"
              : `${topics.length} ${
                  topics.length === 1 ? "topic" : "topics"
                }${selectedSubjectName ? ` in ${selectedSubjectName}` : ""}`}
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="shrink-0 text-red-600 bg-red-500/10 p-3 rounded-lg mb-6">
          {error}
        </p>
      )}

      {/* Scroll region. min-h-0 lets the flex child shrink below its
          content size so overflow-y-auto takes over. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <PageSkeleton variant="list" />
        ) : topics.length === 0 ? (
          // h-full centers the empty state in the available height
          // instead of hugging the top of the scroll region.
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12 bg-card border border-dashed border-border rounded-xl">
            <h3 className="text-base sm:text-lg font-semibold mb-2">
              {tab === "mine" ? "You haven't created any topics" : "No topics found"}
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-md">
              {tab === "mine"
                ? selectedSubject
                  ? "No topics in this subject yet. Create one to get started."
                  : "Create your first topic and publish it for your peers."
                : selectedSubject
                  ? "No topics in this subject yet. Be the first to create one!"
                  : "The community hasn't published any topics yet."}
            </p>
            {tab === "mine" ? (
              <Link
                href="/topics/new"
                className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
              >
                Create a topic
              </Link>
            ) : (
              <Link
                href="/topics/new"
                className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
              >
                Create the first topic
              </Link>
            )}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 content-start auto-rows-fr pb-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {topics.map((topic) => {
              const progress = topic.progress;
              const isCompleted = !!progress?.is_completed;
              const isInProgress = !!progress && !isCompleted;

              return (
                <motion.div key={topic.id} variants={itemVariants}>
                  <Link
                    href={`/topics/${topic.id}`}
                    className="group flex flex-col h-full bg-card text-card-foreground border border-border rounded-xl p-5 hover:shadow-md hover:border-accent/40 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="text-xs font-medium px-2 py-1 bg-muted rounded-md text-muted-foreground">
                        {topic.subject.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {topic.page_count} pages
                      </span>
                      {/*
                        progress is null for the topic creator (backend
                        short-circuits in _getProgress), so these badges
                        never render on the "My topics" tab. No frontend
                        branch is needed; keep the conditionals as they
                        are so a reader sees why.
                      */}
                      {isInProgress && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 bg-accent/10 text-accent rounded-md">
                          <PlayCircle className="h-3 w-3" />
                          Continue
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 bg-green-500/10 text-green-600 rounded-md">
                          <CheckCircle2 className="h-3 w-3" />
                          Completed
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold mb-2 group-hover:text-accent transition-colors">
                      {topic.title}
                    </h2>
                    <p className="text-sm text-muted-foreground line-clamp-3 flex-1">
                      {topic.description || "No description provided."}
                    </p>
                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                      <span>by {topic.created_by.username}</span>
                      {!topic.is_published && (
                        <span className="text-orange-500 font-medium">Draft</span>
                      )}
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}