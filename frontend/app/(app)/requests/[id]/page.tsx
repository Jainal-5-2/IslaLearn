"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Lock, Save, X, XCircle, MessageSquare } from "lucide-react";
import {
  getRequest,
  getMe,
  getSubjects,
  getThreads,
  updateRequest,
  closeRequest,
  decideApplication,
  TutoringRequest,
  ThreadSummary,
  Subject,
  User,
  ApiError,
} from "@/lib/api";
import { RequestCard } from "@/components/request-card";
import { SubjectCombobox } from "@/components/subject-combobox";
import { SessionPanel, ReviewableUser } from "@/components/sessions-panel";
import { PageSkeleton } from "@/components/page-skeleton";
import { ReportButton } from "@/components/report-button";
import { showToast } from "@/components/toast";
import { cn } from "@/lib/utils";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <RequestDetailPage />
    </Suspense>
  );
}

function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = Number(params.id);

  const [req, setReq] = useState<TutoringRequest | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [thread, setThread] = useState<ThreadSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deciding, setDeciding] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [draftSubjectId, setDraftSubjectId] = useState<number | null>(null);
  const [draftDescription, setDraftDescription] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftTimeOfDay, setDraftTimeOfDay] = useState("");

  function refresh() {
    getRequest(requestId)
      .then(setReq)
      .catch((e) =>
        showToast(e instanceof Error ? e.message : "Failed to refresh")
      );
  }

  useEffect(() => {
    Promise.all([
      getRequest(requestId),
      getMe(),
      getSubjects(),
      getThreads().catch(() => ({
        count: 0,
        next: null,
        previous: null,
        results: [] as ThreadSummary[],
      })),
    ])
      .then(([r, u, s, threads]) => {
        setReq(r);
        setUser(u);
        setSubjects(s);
        const match =
          threads.results.find((t) => t.request === requestId) ?? null;
        setThread(match);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404)
          setError("Request not found.");
        else setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, [requestId, router]);

  function enterEdit() {
    if (!req) return;
    if (req.tutee.id !== user?.id) return;
    if (req.status !== "open") return;

    setEditError("");
    setDraftSubjectId(req.subject.id);
    setDraftDescription(req.description);
    if (req.preferred_time) {
      const d = new Date(req.preferred_time);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      setDraftDate(`${yyyy}-${mm}-${dd}`);
      const hh = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      setDraftTimeOfDay(`${hh}:${min}`);
    } else {
      setDraftDate("");
      setDraftTimeOfDay("");
    }
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditError("");
  }

  async function saveEdit() {
    if (!req) return;
    if (req.tutee.id !== user?.id) {
      setEditError("You don't have permission to edit this request.");
      return;
    }
    if (req.status !== "open") {
      setEditError("This request is closed and can no longer be edited.");
      return;
    }

    if (!!draftDate !== !!draftTimeOfDay) {
      setEditError(
        "Please provide both a date and a time for your preferred slot, or leave both blank."
      );
      return;
    }

    let preferred_time: string | null = null;
    if (draftDate && draftTimeOfDay) {
      const parsed = new Date(`${draftDate}T${draftTimeOfDay}`);
      if (Number.isNaN(parsed.getTime())) {
        setEditError("The preferred date/time isn't valid. Please pick it again.");
        return;
      }
      preferred_time = parsed.toISOString();
    }

    const payload: {
      subject?: number;
      description?: string;
      preferred_time?: string | null;
    } = {
      description: draftDescription,
      preferred_time,
    };
    if (
      draftSubjectId !== null &&
      draftSubjectId !== req.subject.id &&
      !req.subject_locked
    ) {
      payload.subject = draftSubjectId;
    }

    setEditError("");
    setSaving(true);
    try {
      const updated = await updateRequest(req.id, payload);
      setReq(updated);
      setEditing(false);
      showToast("Request updated");
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleClose() {
    if (!req) return;
    if (req.tutee.id !== user?.id) {
      showToast("You don't have permission to close this request.");
      return;
    }
    if (
      !confirm(
        "Close this request? Pending applications will be rejected and no new tutors can apply."
      )
    )
      return;
    setClosing(true);
    try {
      const updated = await closeRequest(req.id);
      setReq(updated);
      showToast("Request closed");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to close");
    } finally {
      setClosing(false);
    }
  }

  async function handleDecision(appId: number, status: "accepted" | "rejected") {
    setDeciding(appId);
    try {
      await decideApplication(appId, status);
      showToast(
        status === "accepted" ? "Application accepted" : "Application rejected"
      );
      const updated = await getRequest(requestId);
      setReq(updated);

      // On accept, the backend creates the thread. Re-fetch the list so
      // the "Message" button appears without a manual page reload.
      if (status === "accepted") {
        getThreads()
          .then((threads) => {
            const match =
              threads.results.find((t) => t.request === requestId) ?? null;
            setThread(match);
          })
          .catch(() => {
            // Non-fatal; the request page still works.
          });
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setDeciding(null);
    }
  }

  if (loading) {
    return <PageSkeleton variant="list" />;
  }

  if (error || !req || !user) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">{error || "Request not found."}</p>
        <Link href="/requests" className="text-accent underline">
          Back to requests
        </Link>
      </div>
    );
  }

  const isOwner = req.tutee.id === user.id;
  const myApplication = req.applications?.find((a) => a.tutor.id === user.id);
  const canApply = !isOwner && req.status === "open" && !myApplication;
  const canEdit = isOwner && req.status === "open";
  const canClose = isOwner && req.status === "open";

  const acceptedApplication = req.applications?.find(
    (a) => a.status === "accepted"
  );
  const isAcceptedTutor = acceptedApplication?.tutor.id === user.id;

  // Who can this user review? Only meaningful once a session exists.
  const reviewableUsers: ReviewableUser[] = [];
  if (req.session) {
    if (isOwner && acceptedApplication) {
      reviewableUsers.push({
        id: acceptedApplication.tutor.id,
        username: acceptedApplication.tutor.username,
      });
    } else if (isAcceptedTutor) {
      reviewableUsers.push({
        id: req.tutee.id,
        username: req.tutee.username,
      });
    }
  }

  const preferredTimePreview = (() => {
    if (!draftDate || !draftTimeOfDay) return null;
    const d = new Date(`${draftDate}T${draftTimeOfDay}`);
    if (Number.isNaN(d.getTime()))
      return { ok: false as const, text: "Invalid date/time" };
    return {
      ok: true as const,
      text: d.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    };
  })();

  const headerActions =
    (canEdit || canClose) && !editing ? (
      <div className="flex items-center gap-1">
        {canEdit && (
          <button
            onClick={enterEdit}
            aria-label="Edit request"
            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {canClose && (
          <button
            onClick={handleClose}
            disabled={closing}
            aria-label="Close request"
            className="inline-flex items-center justify-center h-8 px-2 rounded-md border border-border text-muted-foreground hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/40 disabled:opacity-50 transition-colors"
          >
            <XCircle className="h-3.5 w-3.5" />
            <span className="text-xs ml-1">
              {closing ? "..." : "Close"}
            </span>
          </button>
        )}
      </div>
    ) : null;

  const editFooter = editing ? (
    <div className="space-y-4">
      {editError && (
        <p className="text-sm text-red-600 bg-red-500/10 p-2 rounded">
          {editError}
        </p>
      )}

      <div>
        <label className="block text-xs font-medium mb-1.5 text-muted-foreground uppercase tracking-wider">
          Subject
        </label>
        {req.subject_locked ? (
          <>
            <div className="inline-flex items-center gap-1.5 text-sm px-2 py-1 bg-muted rounded-md text-muted-foreground">
              <Lock className="h-3 w-3" />
              {req.subject.name}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Locked. {req.applications?.length ?? 0} tutor
              {(req.applications?.length ?? 0) === 1 ? "" : "s"} have applied.
              Close and repost to change the subject.
            </p>
          </>
        ) : (
          <SubjectCombobox
            subjects={subjects}
            value={draftSubjectId}
            onChange={(id) => setDraftSubjectId(id)}
          />
        )}
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5 text-muted-foreground uppercase tracking-wider">
          Description
        </label>
        <textarea
          value={draftDescription}
          onChange={(e) => setDraftDescription(e.target.value)}
          rows={4}
          className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5 text-muted-foreground uppercase tracking-wider">
          Preferred time <span className="normal-case">(optional)</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <input
            type="time"
            value={draftTimeOfDay}
            onChange={(e) => setDraftTimeOfDay(e.target.value)}
            className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
        {preferredTimePreview && (
          <p
            className={`text-xs mt-1 ${
              preferredTimePreview.ok ? "text-muted-foreground" : "text-red-600"
            }`}
          >
            {preferredTimePreview.ok
              ? `Will be saved as: ${preferredTimePreview.text}`
              : preferredTimePreview.text}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={cancelEdit}
          disabled={saving}
          className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
        <button
          onClick={saveEdit}
          disabled={saving}
          className="inline-flex items-center gap-1 h-9 px-3 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/requests"
        className="inline-block text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; Back to requests
      </Link>

      <RequestCard
        request={req}
        showApplications={false}
        isOwner={isOwner}
        action={headerActions}
        footer={editFooter ?? undefined}
      />

      {!editing && req.preferred_time && (
        <div className="bg-muted/50 border border-border rounded-xl p-4 text-sm">
          <span className="text-muted-foreground">Preferred time: </span>
          {new Date(req.preferred_time).toLocaleString()}
        </div>
      )}

      {isOwner && thread && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Link
            href={`/messages/${thread.id}`}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
            Message {thread.other_party?.username ?? "tutor"}
          </Link>
        </div>
      )}

      {/* Actions row: applies to any non-owner viewer. The message
          button appears only when the thread exists, which happens
          the moment the request is accepted. */}
      {!isOwner && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {canApply && (
            <Link
              href={`/requests/${req.id}/apply`}
              className="flex-1 text-center h-11 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 leading-[2.75rem] transition-colors"
            >
              Apply to help
            </Link>
          )}
          {myApplication && (
            <div className="flex-1 bg-card border border-border rounded-xl p-4 text-sm">
              You applied on{" "}
              {new Date(myApplication.created_at).toLocaleDateString()} with
              status:{" "}
              <span className="font-medium capitalize">
                {myApplication.status}
              </span>
            </div>
          )}
          {req.status === "closed" && !myApplication && (
            <p className="flex-1 text-sm text-muted-foreground">
              This request is closed.
            </p>
          )}
          {thread && (
            <Link
              href={`/messages/${thread.id}`}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              Message {thread.other_party?.username ?? "participant"}
            </Link>
          )}
          <ReportButton
            target={{ target_request: req.id }}
            label="Report request"
          />
        </div>
      )}

      {req.session ? (
        <SessionPanel
          kind="request"
          targetId={req.id}
          session={req.session}
          reviewableUsers={reviewableUsers}
          isTutor={!!isAcceptedTutor}
          onSessionChanged={refresh}
        />
      ) : (
        acceptedApplication && (
          <SessionPanel
            kind="request"
            targetId={req.id}
            session={null}
            reviewableUsers={reviewableUsers}
            isTutor={!!isAcceptedTutor}
            onSessionChanged={refresh}
          />
        )
      )}

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">
          Applications ({req.applications?.length ?? 0})
        </h2>
        {!req.applications || req.applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No applications yet.</p>
        ) : (
          <div className="space-y-3">
            {req.applications.map((a) => (
              <div
                key={a.id}
                className="border border-border rounded-lg p-4 bg-background"
              >
                <div className="flex items-center justify-between mb-2">
                  <Link
                    href={`/profile/${a.tutor.id}`}
                    className="font-medium text-sm hover:text-accent transition-colors"
                  >
                    {a.tutor.username}
                  </Link>
                  <span
                    className={cn(
                      "text-xs px-2 py-1 rounded-md font-medium",
                      a.status === "accepted" &&
                        "bg-green-500/10 text-green-600",
                      a.status === "rejected" && "bg-red-500/10 text-red-600",
                      a.status === "pending" &&
                        "bg-muted text-muted-foreground"
                    )}
                  >
                    {a.status}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{a.message}</p>
                {isOwner && a.status === "pending" && req.status === "open" && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleDecision(a.id, "accepted")}
                      disabled={deciding === a.id}
                      className="h-9 px-3 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                    >
                      {deciding === a.id ? "..." : "Accept"}
                    </button>
                    <button
                      onClick={() => handleDecision(a.id, "rejected")}
                      disabled={deciding === a.id}
                      className="h-9 px-3 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}