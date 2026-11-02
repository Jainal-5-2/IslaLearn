"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, RotateCcw } from "lucide-react";

/**
 * The two modals the topic reader needs. Both are pure presentational:
 * they take props and own no app state. Kept together because they are
 * only used from the reader and both would be three lines of "new file"
 * boilerplate on their own.
 */

export function LockGate({
  pageIndex,
  onUnlock,
  unlocking,
}: {
  pageIndex: number;
  onUnlock: () => void;
  unlocking: boolean;
}) {
  return (
    <div className="flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
        <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Continue learning</h2>
        <p className="text-muted-foreground mb-6">
          Page {pageIndex + 1} is past the free preview. Unlock the rest of
          this topic to keep reading.
        </p>
        <button
          onClick={onUnlock}
          disabled={unlocking}
          className="w-full h-10 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {unlocking ? "Unlocking..." : "Unlock this topic"}
        </button>
      </div>
    </div>
  );
}

export function ResetProgressDialog({
  open,
  onCancel,
  onConfirm,
  totalPages,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  totalPages: number;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onCancel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-progress-title"
          aria-describedby="reset-progress-description"
        >
          <motion.div
            className="w-full max-w-md bg-card text-card-foreground border border-border rounded-2xl shadow-lg p-6"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2
                  id="reset-progress-title"
                  className="text-lg font-semibold text-foreground"
                >
                  Start from the beginning?
                </h2>
                <p
                  id="reset-progress-description"
                  className="text-sm text-muted-foreground mt-1"
                >
                  Your reading progress on this topic will be reset to page 1
                  of {totalPages}. Quiz results will also be cleared. This
                  cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
              <button
                ref={cancelRef}
                onClick={onCancel}
                className="h-10 px-4 rounded-md border border-border hover:bg-muted font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="h-10 rounded-md bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
              >
                Reset progress
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}