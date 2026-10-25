"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BookOpen,
  Plus,
  Video,
  MessageSquare,
  MessageCircle,
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

type NavItem = {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  href: string;
  owns?: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  { Icon: Home, title: "Dashboard", href: "/dashboard" },
  {
    Icon: Plus,
    title: "Create Topic",
    href: "/topics/new",
    owns: (p) => p === "/topics/new",
  },
  {
    Icon: BookOpen,
    title: "Browse Topics",
    href: "/topics",
    owns: (p) =>
      p === "/topics" ||
      (/^\/topics\/\d+/.test(p) && !p.endsWith("/edit") && p !== "/topics/new"),
  },
  {
    Icon: Plus,
    title: "Post Request",
    href: "/requests/new",
    owns: (p) => p === "/requests/new",
  },
  {
    Icon: MessageSquare,
    title: "Requests",
    href: "/requests",
    owns: (p) => p === "/requests" || /^\/requests\/\d+/.test(p),
  },
  {
    Icon: MessageCircle,
    title: "Sessions",
    href: "/sessions",
    owns: (p) => p === "/sessions" || /^\/sessions\/\d+/.test(p),
  },
  { Icon: Video, title: "Broadcasts", href: "/broadcasts" },
];

export function DashboardSidebar({
  user,
  open,
  setOpen,
  isMobileOpen,
  onMobileClose,
  onLogout,
}: DashboardSidebarProps) {
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
          "flex flex-col bg-card border-r border-border transition-transform duration-300 ease-in-out",
          "lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0",
          open ? "lg:w-64" : "lg:w-16",
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
          {/* Nav Items — active state streams in via Suspense */}
          <Suspense
            fallback={
              <ActiveNavItemsFallback open={open || isMobileOpen} />
            }
          >
            <ActiveNavItems
              open={open || isMobileOpen}
              onItemClick={onMobileClose}
            />
          </Suspense>

          {/* Account Section */}
          {(open || isMobileOpen) && (
            <div className="border-t border-border pt-4 mt-6 space-y-1">
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

/**
 * Renders the nav items with active-state highlight. This is the ONLY
 * component in the sidebar tree that reads `usePathname()`, so it's the
 * only one that suspends during prerendering.
 */
function ActiveNavItems({
  open,
  onItemClick,
}: {
  open: boolean;
  onItemClick: () => void;
}) {
  const pathname = usePathname();

  const activeHref = (() => {
    for (const item of NAV_ITEMS) {
      if (item.owns) {
        if (item.owns(pathname)) return item.href;
      } else if (
        pathname === item.href ||
        pathname.startsWith(`${item.href}/`)
      ) {
        return item.href;
      }
    }
    return null;
  })();

  return (
    <div className="space-y-1">
      {NAV_ITEMS.map((item) => (
        <SidebarItem
          key={item.href}
          Icon={item.Icon}
          title={item.title}
          href={item.href}
          isSelected={activeHref === item.href}
          onClick={onItemClick}
          open={open}
        />
      ))}
    </div>
  );
}

/**
 * Fallback rendered while `usePathname()` is resolving during prerender
 * and hydration. Identical layout, no active highlight.
 */
function ActiveNavItemsFallback({ open }: { open: boolean }) {
  return (
    <div className="space-y-1">
      {NAV_ITEMS.map((item) => (
        <SidebarItem
          key={item.href}
          Icon={item.Icon}
          title={item.title}
          href={item.href}
          isSelected={false}
          onClick={() => {}}
          open={open}
        />
      ))}
    </div>
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
    "group relative flex h-11 w-full items-center rounded-md transition-colors duration-150",
    isSelected
      ? "bg-accent/10 text-accent font-semibold"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  );

  const inner = (
    <>
      {isSelected && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-accent"
        />
      )}
      <div className="grid h-full w-12 place-content-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      {open && (
        <span
          className={cn(
            "text-sm truncate",
            isSelected ? "font-semibold" : "font-medium"
          )}
        >
          {title}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={className}
        onClick={onClick}
        aria-current={isSelected ? "page" : undefined}
      >
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