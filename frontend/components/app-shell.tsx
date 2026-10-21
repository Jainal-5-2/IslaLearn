"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { User } from "@/lib/api";
import { Logo } from "@/components/logo";
import { Footer } from "@/components/footer";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

interface AppShellProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

export function AppShell({ user, onLogout, children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top row: sidebar + main content */}
      <div className="flex flex-1 min-h-0">
        <DashboardSidebar
          user={user}
          open={isSidebarOpen}
          setOpen={setIsSidebarOpen}
          isMobileOpen={isMobileOpen}
          onMobileClose={() => setIsMobileOpen(false)}
          onLogout={onLogout}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header */}
          <div className="lg:hidden sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="inline-flex items-center gap-2 text-sm font-medium hover:text-accent transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
              Menu
            </button>
            <Logo size={32} showText={false} />
            <ThemeToggle />
          </div>

          {/* Page content */}
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>

      {/* Footer — full width, below sidebar + content */}
      <Footer isLoggedIn />
    </div>
  );
}