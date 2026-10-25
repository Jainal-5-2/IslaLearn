"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import {
  getSubjects,
  getRequests,
  Subject,
  TutoringRequest,
} from "@/lib/api";
import { SubjectCombobox } from "@/components/subject-combobox";
import { RequestCard } from "@/components/request-card";
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

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <RequestsPage />
    </Suspense>
  );
}

function RequestsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [requests, setRequests] = useState<TutoringRequest[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getSubjects()
      .then(setSubjects)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load subjects")
      );
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRequests({
      subject: selectedSubject || undefined,
      mine: tab === "mine",
    })
      .then((data) => {
        if (!cancelled) setRequests(data.results);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSubject, tab]);

  return (
    // Fixed to the viewport: the header, tabs, and filters are pinned,
    // and only the list region scrolls. 4rem is the (app) layout's
    // mobile header; 3rem is main's top+bottom padding on lg+.
    <div className="flex flex-col h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-3rem)]">
      {/* Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Requests</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Ask for 1:1 help or offer it to a classmate
          </p>
        </div>
        <Link
          href="/requests/new"
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Post a request
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
            {t === "browse" ? "Browse open" : "My requests"}
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
            {requests.length} {requests.length === 1 ? "request" : "requests"}
          </p>
        )}
      </div>

      {error && (
        <p className="shrink-0 text-red-600 bg-red-500/10 p-3 rounded-lg mb-6">
          {error}
        </p>
      )}

      {/* Scroll region. min-h-0 lets the flex child shrink below its
          content size, which is required for overflow-y-auto to kick in
          inside a fixed-height column. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <PageSkeleton variant="list" />
        ) : requests.length === 0 ? (
          // Fill the scroll region so the empty state is centered in
          // whatever height is available, not hugging the top.
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12 bg-card border border-dashed border-border rounded-xl">
            <h3 className="text-base sm:text-lg font-semibold mb-2">
              {tab === "mine"
                ? "You haven't posted any requests"
                : "No open requests"}
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-md">
              {tab === "mine"
                ? "Post a request and a tutor will reach out."
                : "Nothing here yet. Check back later or post your own."}
            </p>
            {tab === "mine" && (
              <Link
                href="/requests/new"
                className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
              >
                Post a request
              </Link>
            )}
          </div>
        ) : (
          <motion.div
            className="space-y-3 pb-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {requests.map((r) => (
              <motion.div key={r.id} variants={itemVariants}>
                <RequestCard request={r} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}