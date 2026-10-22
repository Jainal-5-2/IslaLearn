"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Save } from "lucide-react";
import {
  getMe,
  getSubjects,
  createRequest,
  isLoggedIn,
  logout,
  Subject,
  User,
} from "@/lib/api";
import { AppShell } from "@/components/app-shell";

function NewRequestPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTimeOfDay, setPreferredTimeOfDay] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    Promise.all([getMe(), getSubjects()])
      .then(([u, s]) => {
        setUser(u);
        setSubjects(s);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setIsCheckingAuth(false));
  }, [router]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId) {
      setError("Please select a subject.");
      return;
    }
    if (!!preferredDate !== !!preferredTimeOfDay) {
      setError(
        "Please provide both a date and a time for your preferred slot, or leave both blank."
      );
      return;
    }

    let preferred_time: string | null = null;
    if (preferredDate && preferredTimeOfDay) {
      const parsed = new Date(`${preferredDate}T${preferredTimeOfDay}`);
      if (Number.isNaN(parsed.getTime())) {
        setError("The preferred date/time isn't valid. Please pick it again.");
        return;
      }
      preferred_time = parsed.toISOString();
    }

    setError("");
    setSubmitting(true);
    try {
      const req = await createRequest({
        subject: Number(subjectId),
        description,
        preferred_time,
      });
      router.push(`/requests/${req.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  const preferredTimePreview = (() => {
    if (!preferredDate || !preferredTimeOfDay) return null;
    const d = new Date(`${preferredDate}T${preferredTimeOfDay}`);
    if (Number.isNaN(d.getTime())) return { ok: false, text: "Invalid date/time" };
    return {
      ok: true,
      text: d.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    };
  })();

  return (
    <AppShell user={user} onLogout={handleLogout}>
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Post a Request</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Tell tutors what you need help with
            </p>
          </div>
          <Link
            href="/requests"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Back to requests
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
              What do you need help with?{" "}
              <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={5}
              placeholder="e.g., I'm stuck on recursion and linked lists in my Data Structures class. Need help understanding the base cases."
              className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Preferred time{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={preferredTimeOfDay}
                  onChange={(e) => setPreferredTimeOfDay(e.target.value)}
                  className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>
            {preferredTimePreview && (
              <p
                className={`text-xs mt-1 ${
                  preferredTimePreview.ok
                    ? "text-muted-foreground"
                    : "text-red-600"
                }`}
              >
                {preferredTimePreview.ok
                  ? `Will be posted as: ${preferredTimePreview.text}`
                  : preferredTimePreview.text}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Leave both blank if you&apos;re flexible. Fill both if you have a
              specific slot in mind.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Link
              href="/requests"
              className="inline-flex items-center justify-center h-10 px-4 rounded-md border border-border hover:bg-muted font-medium transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              {submitting ? "Posting..." : "Post request"}
            </button>
          </div>
        </motion.form>
      </div>
    </AppShell>
  );
}