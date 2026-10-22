"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getRequest,
  applyToRequest,
  TutoringRequest,
} from "@/lib/api";
import { PageSkeleton } from "@/components/page-skeleton";
import { showToast } from "@/components/toast";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <ApplyPage />
    </Suspense>
  );
}

function ApplyPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = Number(params.id);

  const [req, setReq] = useState<TutoringRequest | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRequest(requestId)
      .then(setReq)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [requestId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await applyToRequest(requestId, message);
      showToast("Application sent");
      router.push(`/requests/${requestId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <PageSkeleton variant="form" />;
  }

  if (!req) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600">{error || "Not found."}</p>
        <Link
          href="/requests"
          className="text-accent underline mt-4 inline-block"
        >
          Back to requests
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={`/requests/${req.id}`}
        className="inline-block text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; Back to request
      </Link>

      <div className="bg-muted/50 border border-border rounded-xl p-4">
        <p className="text-xs text-muted-foreground uppercase mb-1">
          Request from {req.tutee.username}
        </p>
        <p className="text-sm whitespace-pre-wrap line-clamp-4">
          {req.description}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm"
      >
        {error && (
          <p className="text-sm text-red-600 bg-red-500/10 p-3 rounded-lg">
            {error}
          </p>
        )}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Your message <span className="text-red-500">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={5}
            placeholder="Introduce yourself. What experience do you have with this topic? When are you free?"
            className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Link
            href={`/requests/${req.id}`}
            className="inline-flex items-center justify-center h-10 px-4 rounded-md border border-border hover:bg-muted font-medium transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Sending..." : "Send application"}
          </button>
        </div>
      </form>
    </div>
  );
}