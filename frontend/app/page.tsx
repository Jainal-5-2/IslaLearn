"use client";

import { useRouter } from "next/navigation";
import { HeroSection } from "@/components/hero-section";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-background">
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
    </main>
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