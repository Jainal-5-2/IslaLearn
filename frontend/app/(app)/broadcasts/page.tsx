"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Calendar, Users, CheckCircle2 } from "lucide-react";
import {
  getSubjects,
  getBroadcasts,
  Subject,
  Broadcast,
} from "@/lib/api";
import { SubjectCombobox } from "@/components/subject-combobox";
import { PageSkeleton } from "@/components/page-skeleton";

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
      <BroadcastsPage />
    </Suspense>
  );
}

function BroadcastsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
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
    getBroadcasts({ subject: selectedSubject ?? undefined })
      .then((data) => {
        if (!cancelled) setBroadcasts(data.results);
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
  }, [selectedSubject]);

  return (
    // Fixed to the viewport: header and filter pinned, only the list
    // region scrolls. 4rem is the (app) layout's mobile header;
    // 3rem is main's vertical padding on lg+.
    <div className="flex flex-col h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-3rem)]">
      {/* Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Broadcasts</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Upcoming group sessions from your peers
          </p>
        </div>
        <Link
          href="/broadcasts/new"
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Schedule broadcast
        </Link>
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
            {broadcasts.length}{" "}
            {broadcasts.length === 1 ? "broadcast" : "broadcasts"}
          </p>
        )}
      </div>

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
        ) : broadcasts.length === 0 ? (
          // h-full centers the empty state in the available height
          // instead of hugging the top of the scroll region.
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12 bg-card border border-dashed border-border rounded-xl">
            <h3 className="text-base sm:text-lg font-semibold mb-2">
              No upcoming broadcasts
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-md">
              {selectedSubject
                ? "Nothing scheduled for this subject yet."
                : "The community hasn't scheduled anything yet."}
            </p>
            <Link
              href="/broadcasts/new"
              className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
            >
              Schedule the first broadcast
            </Link>
          </div>
        ) : (
          <motion.div
            className="space-y-3 pb-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {broadcasts.map((b) => (
              <motion.div key={b.id} variants={itemVariants}>
                <BroadcastCard broadcast={b} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function BroadcastCard({ broadcast }: { broadcast: Broadcast }) {
  const isFull = broadcast.is_full;
  const joined = !!broadcast.my_participation;
  const isCompleted = broadcast.is_completed;
  const isPast = new Date(broadcast.scheduled_at).getTime() < Date.now();
  const isEnded = !isCompleted && isPast;

  return (
    <Link
      href={`/broadcasts/${broadcast.id}`}
      className="block bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-accent/40 transition-all"
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-xs font-medium px-2 py-1 bg-muted rounded-md text-muted-foreground">
          {broadcast.subject.name}
        </span>
        {isCompleted && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 bg-green-500/10 text-green-600 rounded-md">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        )}
        {isEnded && (
          <span className="text-xs font-medium px-2 py-1 bg-muted text-muted-foreground rounded-md">
            Ended
          </span>
        )}
        {joined && !isCompleted && (
          <span className="text-xs font-medium px-2 py-1 bg-accent/10 text-accent rounded-md">
            Joined
          </span>
        )}
        {isFull && !joined && !isCompleted && !isEnded && (
          <span className="text-xs font-medium px-2 py-1 bg-muted text-muted-foreground rounded-md">
            Full
          </span>
        )}
      </div>
      <h2 className="text-lg font-bold mb-1">{broadcast.title}</h2>
      {broadcast.description && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {broadcast.description}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {new Date(broadcast.scheduled_at).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {broadcast.participant_count} / {broadcast.capacity}
        </span>
        <span>by {broadcast.tutor.username}</span>
      </div>
    </Link>
  );
}