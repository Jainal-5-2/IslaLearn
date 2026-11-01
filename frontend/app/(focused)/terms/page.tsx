import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Footer } from "@/components/footer";

export const metadata = {
  title: "Terms of Service | IslaLearn",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Logo href="/" size={28} showText={false} />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Last updated: 1 November 2026
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="text-lg font-semibold mb-2">
              What IslaLearn is
            </h2>
            <p>
              IslaLearn is a peer-to-peer learning platform for Basilan
              State University Computer Science students. It connects
              students who want to learn with students who want to teach.
              Everything on the platform is free during the MVP phase.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              Accounts and age
            </h2>
            <p>
              You must be 18 or older, or have parental consent, to use
              IslaLearn. This is a self-declaration during signup. No
              identity verification is performed in this version.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              Your content
            </h2>
            <p>
              You are responsible for the content you create: topics,
              pages, requests, applications, broadcasts, reviews, reports,
              and messages. Do not post content that is illegal,
              harassing, or that you do not have the right to share.
              Administrators may remove content that violates these rules.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              Tutors and tutees
            </h2>
            <p>
              IslaLearn does not verify tutor qualifications. Reviews are
              written by participants after a completed session and
              reflect their experience; they are not an endorsement by
              the platform. If a session does not go as expected, use
              the report feature to notify administrators.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              Group sessions
            </h2>
            <p>
              Group broadcasts run on Whereby Embedded. On the free plan,
              Whereby caps each meeting at 30 minutes. IslaLearn does not
              control that cap and cannot extend it. If a broadcast is
              scheduled for longer than 30 minutes, the room will drop at
              the cap.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              Reports and moderation
            </h2>
            <p>
              Reports about profiles, topics, broadcasts, or requests go
              to the platform administrators. Report the target accurately;
              false reports made in bad faith are themselves a violation
              of these terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              Availability
            </h2>
            <p>
              IslaLearn is a student-run project. It may be unavailable
              for maintenance, and features may change between phases.
              There is no service-level guarantee in this version.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              Payments
            </h2>
            <p>
              No payments are collected by IslaLearn. There is no billing,
              no escrow, and no in-app money transfer. Any future paid
              features will come with an updated version of these terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Changes</h2>
            <p>
              These terms may change as the platform adds features. The
              date at the top of this page reflects the most recent
              change. Continuing to use IslaLearn after a change means
              you accept the updated terms.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}