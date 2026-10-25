"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flag, Loader2 } from "lucide-react";
import { createReport, ReportCategory } from "@/lib/api";
import { showToast } from "@/components/toast";

const CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "impersonation", label: "Impersonation" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Other" },
];

export type ReportTarget =
  | { target_user: number }
  | { target_topic: number }
  | { target_broadcast: number }
  | { target_request: number };

export function ReportButton({
  target,
  label = "Report",
}: {
  target: ReportTarget;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory>("harassment");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function reset() {
    setCategory("harassment");
    setReason("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (category === "other" && !reason.trim()) {
      setError("A reason is required when the category is 'Other'.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await createReport({
        ...target,
        category,
        reason: reason.trim(),
      });
      showToast("Report submitted");
      setOpen(false);
      reset();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-600 transition-colors"
      >
        <Flag className="h-3.5 w-3.5" />
        {label}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
          >
            <motion.div
              className="w-full max-w-md bg-card text-card-foreground border border-border rounded-2xl shadow-lg p-6"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="report-title"
                className="text-lg font-semibold mb-1"
              >
                Report
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Reports go to the admin. Use this for harassment, spam, or
                anything that violates the platform rules.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as ReportCategory)
                    }
                    className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/50"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Reason{" "}
                    {category === "other" ? (
                      <span className="text-red-500">*</span>
                    ) : (
                      <span className="text-muted-foreground">(optional)</span>
                    )}
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                    placeholder="What happened?"
                    className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-500/10 p-3 rounded-lg">
                    {error}
                  </p>
                )}

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                  <button
                    ref={cancelRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                    className="h-10 px-4 rounded-md border border-border hover:bg-muted font-medium disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {submitting ? "Submitting..." : "Submit report"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}