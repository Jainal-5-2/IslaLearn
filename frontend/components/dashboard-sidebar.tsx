"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BookOpen,
  Plus,
  Video,
  MessageSquare,
  Settings,
  HelpCircle,
  ChevronsRight,
  X,
} from "lucide-react";
import { User } from "@/lib/api";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

interface DashboardSidebarProps {
  user: User;
  open: boolean;
  setOpen: (v: boolean) => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  onLogout: () => void;
}

export function DashboardSidebar({
  user,
  open,
  setOpen,
  isMobileOpen,
  onMobileClose,
  onLogout,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { Icon: Home, title: "Dashboard", href: "/dashboard" },
    { Icon: BookOpen, title: "Browse Topics", href: "/topics" },
    { Icon: Plus, title: "Create Topic", href: "/topics/new" },
    { Icon: Video, title: "Broadcasts", href: "/broadcasts" },
    { Icon: MessageSquare, title: "Requests", href: "/requests" },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/topics/new") return pathname === "/topics/new";
    // For /topics, don't match /topics/new or /topics/[id]
    if (href === "/topics") {
      return pathname === "/topics" || /^\/topics\/\d+/.test(pathname);
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <nav
        className={cn(
          // Base: flex column, full height
          "flex flex-col bg-card border-r border-border transition-transform duration-300 ease-in-out",
          // Desktop: sticky column, collapsible via width
          "lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0",
          open ? "lg:w-64" : "lg:w-16",
          // Mobile: fixed drawer
          "fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] h-screen",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header / User (fixed) */}
        <div className="shrink-0 border-b border-border p-2">
          <div className="flex items-center justify-between gap-2 rounded-md p-2">
            <div className="flex items-center gap-3 min-w-0">
              <Logo size={40} showText={false} />
              {(open || isMobileOpen) && (
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {user.username}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {user.plan} plan
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={onMobileClose}
              className="lg:hidden text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable middle section */}
        <div className="flex-1 overflow-y-auto px-2 py-4">
          {/* Nav Items */}
          <div className="space-y-1 mb-6">
            {navItems.map(({ Icon, title, href }) => (
              <SidebarItem
                key={title}
                Icon={Icon}
                title={title}
                href={href}
                isSelected={isActive(href)}
                onClick={onMobileClose}
                open={open || isMobileOpen}
              />
            ))}
          </div>

          {/* Account Section */}
          {(open || isMobileOpen) && (
            <div className="border-t border-border pt-4 space-y-1">
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Account
              </div>
              <SidebarItem
                Icon={Settings}
                title="Settings"
                isSelected={false}
                onClick={onMobileClose}
                open={true}
              />
              <SidebarItem
                Icon={HelpCircle}
                title="Help"
                isSelected={false}
                onClick={onMobileClose}
                open={true}
              />
              <button
                onClick={onLogout}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-500/10 transition-colors"
              >
                Log out
              </button>
            </div>
          )}
        </div>

        {/* Desktop collapse toggle (fixed at bottom) */}
        <button
          onClick={() => setOpen(!open)}
          className="hidden lg:block shrink-0 border-t border-border transition-colors hover:bg-muted"
        >
          <div className="flex items-center p-3">
            <div className="grid size-10 place-content-center">
              <ChevronsRight
                className={cn(
                  "h-4 w-4 transition-transform duration-300 text-muted-foreground",
                  open && "rotate-180"
                )}
              />
            </div>
            {open && (
              <span className="text-sm font-medium text-muted-foreground">
                Hide
              </span>
            )}
          </div>
        </button>
      </nav>
    </>
  );
}

function SidebarItem({
  Icon,
  title,
  href,
  isSelected,
  onClick,
  open,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  href?: string;
  isSelected: boolean;
  onClick: () => void;
  open: boolean;
}) {
  const className = cn(
    "relative flex h-11 w-full items-center rounded-md transition-all duration-200",
    isSelected
      ? "bg-accent/10 text-accent shadow-sm border-l-2 border-accent"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  );

  const inner = (
    <>
      <div className="grid h-full w-12 place-content-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      {open && <span className="text-sm font-medium truncate">{title}</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {inner}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {inner}
    </button>
  );
}