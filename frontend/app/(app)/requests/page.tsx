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
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
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
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mb-4">
        {(["browse", "mine"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
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
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <SubjectCombobox
          subjects={subjects}
          value={selectedSubject}
          onChange={setSelectedSubject}
        />
        {!loading && (
          <p className="text-sm text-muted-foreground">
            {requests.length} {requests.length === 1 ? "request" : "requests"}
          </p>
        )}
      </div>

      {error && (
        <p className="text-red-600 bg-red-500/10 p-3 rounded-lg mb-6">{error}</p>
      )}

      {loading ? (
        <PageSkeleton variant="list" />
      ) : requests.length === 0 ? (
        <div className="text-center py-20 bg-card border border-dashed border-border rounded-xl">
          <h3 className="text-lg font-semibold mb-2">
            {tab === "mine"
              ? "You haven't posted any requests"
              : "No open requests"}
          </h3>
          <p className="text-muted-foreground mb-6">
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
          className="space-y-3"
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
    </>
  );
}