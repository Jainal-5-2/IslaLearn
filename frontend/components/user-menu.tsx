"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import { logout, User } from "@/lib/api";

export function UserMenu({ user }: { user: User }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // A <Link> does not unmount this component, so the dropdown would stay
  // open after navigating. Close it whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on outside click and Escape, same as NotificationBell.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  const initial = user.username[0]?.toUpperCase() ?? "?";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent overflow-hidden hover:ring-2 hover:ring-accent/40 transition-shadow"
      >
        {user.profile_picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.profile_picture}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-card shadow-lg z-50 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border">
            <p className="text-sm font-semibold truncate">{user.username}</p>
            <p className="text-xs text-muted-foreground truncate">
              {user.email || "No email set"}
            </p>
          </div>

          <Link
            href={`/profile/${user.id}`}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            Profile
          </Link>

          <Link
            href="/settings"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
            Settings
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 transition-colors border-t border-border"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}