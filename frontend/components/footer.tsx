import Link from "next/link";
import { Logo } from "@/components/logo";

interface FooterProps {
  isLoggedIn?: boolean;
}

export function Footer({ isLoggedIn = false }: FooterProps) {
  // Server Component: this evaluates per-request, not at build time.
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Logo size={32} />
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Peer learning for BaSU CS students. Learn async, get help sync.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Platform</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/topics" className="hover:text-foreground transition-colors">
                  Topics
                </Link>
              </li>
              <li>
                <Link href="/broadcasts" className="hover:text-foreground transition-colors">
                  Broadcasts
                </Link>
              </li>
              <li>
                <Link href="/requests" className="hover:text-foreground transition-colors">
                  Requests
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/privacy" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <a
                  href="mailto:hello@islalearn.com"
                  className="hover:text-foreground transition-colors"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Community (guest) OR Account (logged in) */}
          {isLoggedIn ? (
            <div>
              <h3 className="text-sm font-semibold mb-3">Account</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/dashboard" className="hover:text-foreground transition-colors">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/topics/new" className="hover:text-foreground transition-colors">
                    Create Topic
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard" className="hover:text-foreground transition-colors">
                    Settings
                  </Link>
                </li>
              </ul>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-semibold mb-3">Community</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/register" className="hover:text-foreground transition-colors">
                    Join
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-foreground transition-colors">
                    Log in
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>&copy; {currentYear} IslaLearn. All rights reserved.</p>
          <p>Built for the BaSU CS community.</p>
        </div>
      </div>
    </footer>
  );
}