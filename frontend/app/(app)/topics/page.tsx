"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import {
  getSubjects,
  getTopics,
  Subject,
  Topic,
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

export default function TopicsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getSubjects()
      .then(setSubjects)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load subjects")
      );
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTopics(selectedSubject || undefined)
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
  }, [selectedSubject]);

  const selectedSubjectName =
    selectedSubject !== null
      ? subjects.find((s) => s.id === selectedSubject)?.name
      : null;

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
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

      {/* Filter row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <SubjectCombobox
          subjects={subjects}
          value={selectedSubject}
          onChange={setSelectedSubject}
        />
        {!loading && (
          <p className="text-sm text-muted-foreground">
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
        <p className="text-red-600 bg-red-500/10 p-3 rounded-lg mb-6">{error}</p>
      )}

      {/* Cards */}
      {loading ? (
        <PageSkeleton variant="list" />
      ) : topics.length === 0 ? (
        <div className="text-center py-20 bg-card border border-dashed border-border rounded-xl">
          <h3 className="text-lg font-semibold mb-2">No topics found</h3>
          <p className="text-muted-foreground mb-6">
            {selectedSubject
              ? "No topics in this subject yet. Be the first to create one!"
              : "The community hasn't published any topics yet."}
          </p>
          <Link
            href="/topics/new"
            className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
          >
            Create the first topic
          </Link>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 content-start auto-rows-fr"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {topics.map((topic) => (
            <motion.div key={topic.id} variants={itemVariants}>
              <Link
                href={`/topics/${topic.id}`}
                className="group flex flex-col h-full bg-card text-card-foreground border border-border rounded-xl p-5 hover:shadow-md hover:border-accent/40 transition-all"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium px-2 py-1 bg-muted rounded-md text-muted-foreground">
                    {topic.subject.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {topic.page_count} pages
                  </span>
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
          ))}
        </motion.div>
      )}
    </>
  );
}