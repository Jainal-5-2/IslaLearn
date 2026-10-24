"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { getBroadcast, BroadcastDetail, ApiError } from "@/lib/api";
import { BroadcastRoom } from "@/components/broadcast-room";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageSkeleton } from "@/components/page-skeleton";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="reader" />}>
      <BroadcastRoomPage />
    </Suspense>
  );
}

function BroadcastRoomPage() {
  const params = useParams();
  const broadcastId = Number(params.id);

  const [broadcast, setBroadcast] = useState<BroadcastDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getBroadcast(broadcastId)
      .then(setBroadcast)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) {
          setError("Broadcast not found.");
        } else {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      })
      .finally(() => setLoading(false));
  }, [broadcastId]);

  if (loading) {
    return <PageSkeleton variant="reader" />;
  }

  if (error || !broadcast) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4">
        <p className="text-red-600">{error || "Broadcast not found."}</p>
        <Link href="/broadcasts" className="text-accent underline">
          Back to broadcasts
        </Link>
      </main>
    );
  }

  const allowed = broadcast.is_tutor || !!broadcast.my_participation;

  if (!allowed) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4">
        <p className="text-muted-foreground text-center max-w-md">
          You need to join this broadcast before you can enter the room.
        </p>
        <Link
          href={`/broadcasts/${broadcastId}`}
          className="text-accent underline"
        >
          Back to broadcast
        </Link>
      </main>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="shrink-0 bg-card border-b border-border px-4 py-2 flex items-center justify-between gap-3">
        <Link
          href={`/broadcasts/${broadcastId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Leave room
        </Link>
        <span className="text-sm font-medium truncate">
          {broadcast.title}
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Logo href="/dashboard" size={28} showText={false} />
        </div>
      </header>

      {broadcast.duration_minutes > 30 && (
        <div className="shrink-0 flex items-start gap-2 text-xs text-orange-700 dark:text-orange-400 bg-orange-500/10 px-4 py-2 border-b border-orange-500/20">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            This broadcast requested {broadcast.duration_minutes} minutes.
            The free plan caps the room at 30, so it will drop when it hits
            the cap.
          </span>
        </div>
      )}

      <div className="flex-1 min-h-0">
        <BroadcastRoom broadcastId={broadcastId} />
      </div>
    </div>
  );
}