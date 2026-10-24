"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Save, AlertCircle } from "lucide-react";
import { getSubjects, createBroadcast, Subject } from "@/lib/api";
import { PageSkeleton } from "@/components/page-skeleton";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <NewBroadcastPage />
    </Suspense>
  );
}

function NewBroadcastPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [capacity, setCapacity] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSubjects()
      .then(setSubjects)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId) {
      setError("Please select a subject.");
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      setError("Please set a date and time.");
      return;
    }

    const parsed = new Date(`${scheduledDate}T${scheduledTime}`);
    if (Number.isNaN(parsed.getTime())) {
      setError("The scheduled date/time isn't valid. Please pick it again.");
      return;
    }
    if (parsed.getTime() <= Date.now()) {
      setError("The broadcast must be scheduled for a future time.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const broadcast = await createBroadcast({
        subject: Number(subjectId),
        title,
        description,
        scheduled_at: parsed.toISOString(),
        duration_minutes: durationMinutes,
        capacity,
      });
      router.push(`/broadcasts/${broadcast.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create broadcast");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <PageSkeleton variant="form" />;
  }

  const overCap = durationMinutes > 30;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Schedule a Broadcast</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Host a live group session for your peers
          </p>
        </div>
        <Link
          href="/broadcasts"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to broadcasts
        </Link>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-xl p-6 space-y-5 shadow-sm"
      >
        {error && (
          <p className="text-sm text-red-600 bg-red-500/10 p-3 rounded-lg">
            {error}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Subject <span className="text-red-500">*</span>
          </label>
          <select
            value={subjectId}
            onChange={(e) =>
              setSubjectId(e.target.value ? Number(e.target.value) : "")
            }
            required
            className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option value="" disabled>
              Select a subject...
            </option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g., Debugging recursive functions together"
            className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What will you cover? Who is this for?"
            className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Scheduled at <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
                className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Time
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
                className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Duration (minutes) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              required
              className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Capacity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              required
              className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
        </div>

        {overCap && (
          <div className="flex items-start gap-2 text-sm text-orange-700 dark:text-orange-400 bg-orange-500/10 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              The free plan caps each meeting at 30 minutes. Your broadcast
              will drop when it hits the cap, even though you asked for{" "}
              {durationMinutes} minutes. Set the duration to 30 or less to
              avoid a surprise.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Link
            href="/broadcasts"
            className="inline-flex items-center justify-center h-10 px-4 rounded-md border border-border hover:bg-muted font-medium transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            <Save className="h-4 w-4" />
            {submitting ? "Scheduling..." : "Schedule broadcast"}
          </button>
        </div>
      </motion.form>
    </div>
  );
}