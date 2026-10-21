"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HeroSection } from "@/components/hero-section";
import { Logo } from "@/components/logo";
import { Footer } from "@/components/footer";
import { FullPageLoader } from "@/components/full-page-loader";
import { getAccessToken } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    if (getAccessToken()) {
      router.replace("/dashboard");
      return;
    }
    setIsCheckingAuth(false);
  }, [router]);

  if (isCheckingAuth) {
    return <FullPageLoader message="Loading..." />;
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo size={36} />
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium bg-foreground text-background hover:bg-foreground/90 px-4 py-2 rounded-lg transition-colors"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <HeroSection
        title={
          <>
            Teach what you know,
            <br />
            learn what you don&apos;t.
          </>
        }
        subtitle="IslaLearn is a peer tutoring platform for BaSU CS students. Read topics, ask for help, and join live sessions, all from your classmates."
        actions={[
          {
            text: "Join IslaLearn",
            onClick: () => router.push("/register"),
            variant: "default",
          },
          {
            text: "Log in",
            onClick: () => router.push("/login"),
            variant: "outline",
          },
        ]}
        stats={[
          { value: "CS", label: "focus area", icon: <CodeIcon /> },
          { value: "P2P", label: "learning model", icon: <UsersIcon /> },
          { value: "Live", label: "sessions", icon: <VideoIcon /> },
        ]}
        images={[
          "/root/hero-1.jpeg",
          "/root/hero-2.jpeg",
          "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=600&h=600&fit=crop",
        ]}
        imageAlts={[
          "Students collaborating on a laptop",
          "A peer tutor explaining code",
          "A study group discussion",
        ]}
      />

      <section className="py-20 sm:py-24 px-4 sm:px-6 max-w-6xl mx-auto w-full border-t border-border">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
            Learn async. Get help sync.
          </h2>
          <p className="text-muted-foreground">
            Three simple ways to learn with your peers. Pick whichever fits your schedule.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          <FeatureCard
            icon={<BookIcon />}
            title="Topics"
            description="Read structured async content created by your classmates. Text, video, and quizzes at your own pace."
          />
          <FeatureCard
            icon={<VideoIcon />}
            title="Broadcasts"
            description="Join scheduled group sessions for live video learning. No external links. The room is right here."
          />
          <FeatureCard
            icon={<ChatIcon />}
            title="1:1 Requests"
            description="Stuck on something specific? Post a request and get matched with a peer tutor for a live session."
          />
        </div>
      </section>

      <section className="py-20 sm:py-24 px-4 sm:px-6 max-w-4xl mx-auto w-full text-center">
        <div className="bg-card border border-border rounded-3xl p-8 sm:p-12 md:p-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Ready to start teaching?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Join a community of BaSU CS students sharing what they know. Everything is free during the MVP phase.
          </p>
          <button
            onClick={() => router.push("/register")}
            className="inline-flex items-center justify-center h-12 px-8 rounded-lg bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
          >
            Create your account
          </button>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 sm:p-8">
      <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function CodeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}