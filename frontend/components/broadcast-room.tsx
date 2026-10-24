"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { getBroadcastRoomUrl } from "@/lib/api";

/**
 * The only component that knows Whereby exists. It fetches the room
 * URL from the backend (which enforces tutor-or-participant access)
 * and embeds it in an iframe. If the provider changes, only this file
 * needs to change.
 */
export function BroadcastRoom({
  broadcastId,
  displayName,
}: {
  broadcastId: number;
  displayName: string;
}) {
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getBroadcastRoomUrl(broadcastId)
      .then((data) => {
        if (!cancelled) setRoomUrl(data.room_url);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load the room."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [broadcastId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Joining the room...</p>
        </div>
      </div>
    );
  }

  if (error || !roomUrl) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-3" />
          <p className="text-sm text-red-600 mb-2">
            {error || "The room is not available."}
          </p>
          <p className="text-xs text-muted-foreground">
            If you are the tutor, make sure the broadcast has not been
            cancelled. If you are a participant, make sure you joined the
            broadcast first.
          </p>
        </div>
      </div>
    );
  }

  // Whereby's Prebuilt iframe reads ?displayName= to pre-fill the
  // participant name, so users do not retype their IslaLearn username
  // every time they enter a room.
  const params = new URLSearchParams();
  params.set("embed", "1");
  if (displayName) params.set("displayName", displayName);
  const separator = roomUrl.includes("?") ? "&" : "?";
  const embedUrl = `${roomUrl}${separator}${params.toString()}`;

  return (
    <iframe
      src={embedUrl}
      allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
      className="w-full h-full border-0"
      title="Broadcast room"
    />
  );
}