"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, Send } from "lucide-react";
import {
  getMe,
  getThreadMessages,
  getThreads,
  getThreadSocketUrl,
  sendThreadMessage,
  Message,
  ThreadSummary,
  User,
  ApiError,
} from "@/lib/api";
import { PageSkeleton } from "@/components/page-skeleton";
import { showToast } from "@/components/toast";
import { cn } from "@/lib/utils";

const HEARTBEAT_INTERVAL_MS = 10_000;

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ThreadPage />
    </Suspense>
  );
}

function ThreadPage() {
  const params = useParams();
  const threadId = Number(params.id);

  const [user, setUser] = useState<User | null>(null);
  const [thread, setThread] = useState<ThreadSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState("");

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<number>(0);
  const firstScrollRef = useRef(true);

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    // Scroll the message list only, not the document. Called from an
    // effect that runs after React commits the new list, so the
    // container's scrollHeight is already correct. The "instant"
    // variant is used for the first render, where a smooth animation
    // from the top looks like a glitch.
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }

  function appendNewMessages(incoming: Message[]) {
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      if (fresh.length === 0) return prev;
      const next = [...prev, ...fresh];
      lastIdRef.current = next[next.length - 1].id;
      return next;
    });
  }

  // Initial load: thread metadata, user, and the full message list.
  useEffect(() => {
    Promise.all([getMe(), getThreads(), getThreadMessages(threadId)])
      .then(([u, threadData, messageData]) => {
        setUser(u);
        const found = threadData.results.find((t) => t.id === threadId) ?? null;
        setThread(found);
        setMessages(messageData);
        lastIdRef.current =
          messageData.length > 0 ? messageData[messageData.length - 1].id : 0;
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) {
          setError("Thread not found.");
        } else if (e instanceof ApiError && e.status === 403) {
          setError("You are not a party to this thread.");
        } else if (e instanceof ApiError && e.status === 401) {
          setError("Session expired. Please log in again.");
        } else {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      })
      .finally(() => setLoading(false));
  }, [threadId]);

  // Scroll to bottom after the message list renders. Runs whenever the
  // number of messages changes, including the initial load. "instant"
  // on the first paint so it does not animate from the top; smooth
  // afterwards so new messages ease into view.
  useEffect(() => {
    if (messages.length === 0) return;
    if (firstScrollRef.current) {
      scrollToBottom("instant");
      firstScrollRef.current = false;
    } else {
      scrollToBottom("smooth");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // WebSocket. Handles three frame types: message, presence, and
  // presence_snapshot. appendNewMessages is the single mutation point
  // for messages; the online set has its own reducer.
  useEffect(() => {
    if (loading || !thread) return;
    const url = getThreadSocketUrl(threadId);
    if (!url) return;

    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let ws: WebSocket | null = null;

    const startHeartbeat = () => {
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "heartbeat" }));
        }
      }, HEARTBEAT_INTERVAL_MS);
    };

    const stopHeartbeat = () => {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    };

    const connect = () => {
      ws = new WebSocket(url);
      ws.onopen = () => {
        retry = 0;
        startHeartbeat();
        // Catch up on anything sent while the socket was down. Fires on
        // the initial connect too (harmless: the mount load just ran).
        // The appendNewMessages helper dedupes by id, so ordering does
        // not matter.
        getThreadMessages(threadId)
          .then((incoming) => appendNewMessages(incoming))
          .catch(() => {});
      };
      ws.onmessage = (ev) => {
        try {
          const frame = JSON.parse(ev.data);
          if (frame.type === "message") {
            appendNewMessages([frame.message as Message]);
          } else if (frame.type === "presence") {
            setOnlineIds((prev) => {
              const next = new Set(prev);
              if (frame.online) next.add(frame.user_id);
              else next.delete(frame.user_id);
              return next;
            });
          } else if (frame.type === "presence_snapshot") {
            setOnlineIds(new Set(frame.user_ids as number[]));
          }
        } catch {
          // Ignore malformed frames; the next reconnect will resync.
        }
      };
      ws.onclose = () => {
        stopHeartbeat();
        if (closed) return;
        // We just lost contact with the server, so we cannot claim
        // anyone is online. Clear the set; the next snapshot will
        // reseed it.
        setOnlineIds(new Set());
        const delay = Math.min(1000 * 2 ** retry, 15000);
        retry += 1;
        timer = setTimeout(connect, delay);
      };
    };
    connect();

    return () => {
      closed = true;
      stopHeartbeat();
      if (timer) clearTimeout(timer);
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, threadId, thread?.id]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSendError("");
    setSending(true);
    try {
      const message = await sendThreadMessage(threadId, body);
      // Use appendNewMessages, not a raw setMessages: the socket echo can
      // arrive before this await resolves, so the message may already be
      // in state. appendNewMessages dedupes by id and handles both
      // orderings.
      appendNewMessages([message]);
      lastIdRef.current = Math.max(lastIdRef.current, message.id);
      setDraft("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send";
      setSendError(msg);
      showToast(msg);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <PageSkeleton variant="list" />;
  }

  if (error || !user || !thread) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">{error || "Thread not found."}</p>
        <Link href="/messages" className="text-accent underline">
          Back to messages
        </Link>
      </div>
    );
  }

  const otherName = thread.other_party?.username ?? "Unknown";
  const otherId = thread.other_party?.id ?? null;
  const otherOnline = otherId !== null && onlineIds.has(otherId);
  const canSend = thread.is_open;

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <Link
          href="/messages"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Messages
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 mb-4 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate flex items-center gap-2">
              {otherName}
              {otherOnline && (
                <span
                  className="inline-block h-2 w-2 rounded-full bg-green-500"
                  aria-label="Online"
                  title="Online"
                />
              )}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {thread.source_title}
            </p>
          </div>
          {thread.is_open ? (
            <span className="text-xs font-medium px-2 py-1 rounded-md bg-green-500/10 text-green-600">
              Open
            </span>
          ) : (
            <span className="text-xs font-medium px-2 py-1 rounded-md bg-muted text-muted-foreground">
              Closed
            </span>
          )}
        </div>
      </div>

      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto bg-card border border-border rounded-xl p-4 mb-4 space-y-3"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No messages yet. Say hello.
          </p>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              isMine={m.sender.id === user.id}
            />
          ))
        )}
      </div>

      {!canSend && (
        <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg mb-3 shrink-0">
          <Lock className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            This conversation is closed. You can read the history but cannot
            send new messages. A conversation closes when the session is marked
            complete.
          </p>
        </div>
      )}

      <form
        onSubmit={handleSend}
        className="bg-card border border-border rounded-xl p-3 shrink-0"
      >
        {sendError && (
          <p className="text-sm text-red-600 bg-red-500/10 p-2 rounded mb-2">
            {sendError}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend && draft.trim() && !sending) {
                  void handleSend(e as unknown as React.FormEvent);
                }
              }
            }}
            rows={1}
            disabled={!canSend || sending}
            placeholder={
              canSend
                ? "Type a message. Enter to send, Shift+Enter for newline."
                : "This conversation is closed."
            }
            maxLength={2000}
            className={cn(
              "flex-1 border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none",
              (!canSend || sending) && "opacity-60 cursor-not-allowed"
            )}
          />
          <button
            type="submit"
            disabled={!canSend || sending || !draft.trim()}
            className="inline-flex items-center justify-center h-10 w-10 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {draft.length}/2000
        </p>
      </form>
    </div>
  );
}

function MessageBubble({
  message,
  isMine,
}: {
  message: Message;
  isMine: boolean;
}) {
  return (
    <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2",
          isMine
            ? "bg-accent text-accent-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        )}
      >
        {!isMine && (
          <p className="text-xs font-medium mb-0.5 opacity-80">
            {message.sender.username}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.body}
        </p>
        <p
          className={cn(
            "text-[10px] mt-1",
            isMine ? "text-accent-foreground/70" : "text-muted-foreground"
          )}
        >
          {new Date(message.created_at).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>
    </div>
  );
}