"use client";

import { useEffect, useRef, useState } from "react";
import { updateMe, User } from "@/lib/api";
import { showToast } from "@/components/toast";
import { cn } from "@/lib/utils";

export function ProfileSettings({
  user,
  onSaved,
}: {
  user: User;
  onSaved: (updated: User) => void;
}) {
  const [bio, setBio] = useState(user.bio ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Blob URL for the newly selected file. Revoked on cleanup so the
  // browser can release the underlying File handle.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const bioChanged = bio !== (user.bio ?? "");
  const fileChanged = file !== null;
  const canSubmit = (bioChanged || fileChanged) && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setSaving(true);
    try {
      const updated = await updateMe({
        bio: bioChanged ? bio : undefined,
        picture: fileChanged ? file : undefined,
      });
      onSaved(updated);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      showToast("Profile updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const avatarSrc =
    previewUrl ?? user.profile_picture ?? null;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card border border-border rounded-xl p-6 space-y-5"
    >
      {error && (
        <p className="text-sm text-red-600 bg-red-500/10 p-3 rounded-lg">
          {error}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium mb-2">Profile picture</label>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden shrink-0">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarSrc}
                alt="Profile picture preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xl font-bold text-accent">
                {user.username[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-muted file:text-foreground hover:file:bg-muted/80"
            />
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG, or GIF. Replacing is supported; removing is not.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label
          htmlFor="bio"
          className="block text-sm font-medium mb-2"
        >
          Bio
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={5}
          maxLength={500}
          placeholder="Tell tutors and tutees a bit about yourself."
          className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
        />
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {bio.length}/500
        </p>
      </div>

      <div className="flex justify-end pt-4 border-t border-border">
        <button
          type="submit"
          disabled={!canSubmit}
          className={cn(
            "inline-flex items-center justify-center h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors",
            !canSubmit && "opacity-50 cursor-not-allowed"
          )}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}