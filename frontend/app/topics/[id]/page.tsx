"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  Lock,
  FileText,
  Video as VideoIcon,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  getTopic,
  getMe,
  isLoggedIn,
  Topic,
  TopicPage,
  User,
  ApiError,
} from "@/lib/api";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Footer } from "@/components/footer";
import { FullPageLoader } from "@/components/full-page-loader";
import { cn } from "@/lib/utils";

export default function Page() {
  return (
    <Suspense fallback={<FullPageLoader message="Loading topic..." />}>
      <TopicReaderPage />
    </Suspense>
  );
}

function TopicReaderPage() {
  const params = useParams();
  const router = useRouter();
  const topicId = Number(params.id);

  const [topic, setTopic] = useState<Topic | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }

    async function loadData() {
      try {
        setLoading(true);
        const [topicData, userData] = await Promise.all([
          getTopic(topicId),
          getMe(),
        ]);
        setTopic(topicData);
        setCurrentUser(userData);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setError("Topic not found.");
        } else {
          setError(err instanceof Error ? err.message : "Failed to load topic");
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [topicId, router]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activePageIndex]);

  if (loading) {
    return <FullPageLoader message="Loading topic..." />;
  }

  if (error || !topic) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <p className="text-red-600">{error || "Topic not found."}</p>
        <Link href="/topics" className="text-accent underline">
          Back to topics
        </Link>
      </main>
    );
  }

  const isOwner = currentUser?.id === topic.created_by.id;
  const pages = topic.pages || [];
  const activePage = pages[activePageIndex];

  const handleNext = () => {
    if (activePageIndex < pages.length - 1) {
      setActivePageIndex(activePageIndex + 1);
    }
  };

  const handlePrev = () => {
    if (activePageIndex > 0) {
      setActivePageIndex(activePageIndex - 1);
    }
  };

  const handleSelectPage = (index: number) => {
    setActivePageIndex(index);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="inline-flex items-center gap-2 text-sm font-medium hover:text-accent transition-colors"
          aria-label="Open contents"
        >
          <Menu className="h-5 w-5" />
          Contents
        </button>
        <span className="text-sm text-muted-foreground truncate max-w-[40%]">
          {activePageIndex + 1} / {pages.length}
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/topics"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Exit
          </Link>
        </div>
      </div>

      {/* 
        Middle Row:
        flex-1 makes it stretch to fill the available space above the footer.
        lg:flex-row puts the sidebar and content side-by-side on desktop.
      */}
      <div className="flex flex-1 lg:flex-row min-h-0">
        {/* Mobile backdrop */}
        {isSidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar: 
            sticky top-0 on desktop so it stays in view when scrolling.
            h-screen makes it viewport height.
        */}
        <aside
          className={cn(
            "bg-card border-border flex flex-col",
            "fixed lg:sticky inset-y-0 lg:inset-y-auto left-0 z-50 lg:z-auto w-80 max-w-[85vw] sm:max-w-sm transition-transform duration-300",
            isSidebarOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0",
            "lg:w-80 lg:border-r lg:top-0 lg:h-screen lg:shrink-0"
          )}
        >
          <div className="p-6 border-b border-border flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-4">
                <Logo href="/dashboard" size={32} showText={false} />
                <Link
                  href="/topics"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  &larr; All Topics
                </Link>
              </div>
              <h1 className="text-xl font-bold leading-tight mb-1 truncate">
                {topic.title}
              </h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="bg-muted px-2 py-0.5 rounded truncate">
                  {topic.subject.name}
                </span>
                <span className="truncate">by {topic.created_by.username}</span>
              </div>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Close contents"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
              Pages
            </h2>
            <nav className="space-y-1">
              {pages.map((page, index) => (
                <button
                  key={page.id}
                  onClick={() => handleSelectPage(index)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between transition-colors",
                    index === activePageIndex
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="text-xs text-muted-foreground w-4">
                      {index + 1}.
                    </span>
                    <span className="flex items-center gap-2 truncate">
                      {page.page_type === "text" && (
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                      )}
                      {page.page_type === "video" && (
                        <VideoIcon className="h-3.5 w-3.5 shrink-0" />
                      )}
                      {page.page_type === "quiz" && (
                        <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate capitalize">
                        {page.page_type}
                      </span>
                    </span>
                  </span>
                  {page.is_locked && (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                </button>
              ))}
            </nav>
          </div>

          {isOwner && (
            <div className="p-4 border-t border-border bg-muted/30">
              <p className="text-xs text-muted-foreground mb-2">
                You are the creator.
              </p>
              <Link
                href={`/topics/${topic.id}/edit`}
                className="block w-full text-center text-sm bg-background border border-border hover:bg-muted px-3 py-2 rounded-md font-medium transition-colors"
              >
                Edit Topic & Pages
              </Link>
            </div>
          )}
        </aside>

        {/* Main content */}
        <section className="flex-1 min-w-0 px-6 lg:px-12 pt-6 lg:pt-12 pb-12">
          <div className="max-w-3xl mx-auto w-full min-w-0">
            {!activePage ? (
              <div className="text-center py-20">
                <h2 className="text-2xl font-bold mb-2">This topic is empty</h2>
                <p className="text-muted-foreground mb-6">
                  {isOwner
                    ? "Add your first page to get started."
                    : "The creator hasn't added any pages yet."}
                </p>
                {isOwner && (
                  <Link
                    href={`/topics/${topic.id}/edit`}
                    className="inline-block bg-accent text-accent-foreground px-4 py-2 rounded-md font-medium hover:bg-accent/90"
                  >
                    + Add Page
                  </Link>
                )}
              </div>
            ) : activePage.is_locked ? (
              <LockGate page={activePage} />
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePage.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="min-w-0"
                >
                  <div className="mb-6 hidden lg:block">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Page {activePageIndex + 1} of {pages.length}
                    </span>
                  </div>

                  <div className="min-w-0">
                    {activePage.page_type === "text" && (
                      <TextPageRenderer content={activePage.content} />
                    )}
                    {activePage.page_type === "video" && (
                      <VideoPageRenderer content={activePage.content} />
                    )}
                    {activePage.page_type === "quiz" && (
                      <QuizPageRenderer content={activePage.content} />
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-12 pt-6 border-t border-border">
                    <button
                      onClick={handlePrev}
                      disabled={activePageIndex === 0}
                      className="inline-flex items-center gap-1 h-10 px-4 rounded-md border border-border hover:bg-muted font-medium disabled:opacity-50 disabled:pointer-events-none transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </button>
                    <button
                      onClick={handleNext}
                      disabled={activePageIndex === pages.length - 1}
                      className="inline-flex items-center gap-1 h-10 px-4 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 font-medium disabled:opacity-50 disabled:pointer-events-none transition-colors"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </section>
      </div>

      {/* Footer */}
      <Footer isLoggedIn />
    </div>
  );
}

// ---------- Renderers ----------

function LockGate({ page }: { page: TopicPage }) {
  return (
    <div className="flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
        <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Continue learning</h2>
        <p className="text-muted-foreground mb-6">
          This page is locked. In the future, you&apos;ll be able to unlock it
          by purchasing the topic. For now, everything is free during the MVP
          phase.
        </p>
        <button
          disabled
          className="w-full h-10 rounded-md bg-accent text-accent-foreground font-medium opacity-50 cursor-not-allowed"
        >
          Unlock (Coming Soon)
        </button>
      </div>
    </div>
  );
}

function TextPageRenderer({ content }: { content: any }) {
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none min-w-0">
      {content?.body ? (
        <div className="whitespace-pre-wrap break-words text-lg leading-relaxed text-foreground">
          {content.body}
        </div>
      ) : (
        <p className="text-muted-foreground italic">No text content.</p>
      )}
    </div>
  );
}

function VideoPageRenderer({ content }: { content: any }) {
  const url = content?.url || "";

  let embedUrl = url;
  if (url.includes("youtube.com/watch?v=")) {
    embedUrl = url.replace("watch?v=", "embed/");
  } else if (url.includes("youtu.be/")) {
    embedUrl = url.replace("youtu.be/", "www.youtube.com/embed/");
  }

  if (!embedUrl) {
    return <p className="text-muted-foreground italic">No video URL provided.</p>;
  }

  return (
    <div className="aspect-video w-full max-w-full rounded-xl overflow-hidden border border-border bg-black">
      <iframe
        src={embedUrl}
        title="Topic Video"
        className="w-full h-full"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    </div>
  );
}

function QuizPageRenderer({ content }: { content: any }) {
  const questions = content?.questions || [];
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);

  if (questions.length === 0) {
    return (
      <p className="text-muted-foreground italic">No quiz questions provided.</p>
    );
  }

  const q = questions[currentQIndex];
  const isLastQuestion = currentQIndex === questions.length - 1;

  const handleSubmit = () => {
    if (selectedOption === null) return;
    setIsAnswered(true);
    if (selectedOption === q.correct_index) {
      setScore(score + 1);
    }
  };

  const handleNext = () => {
    if (isLastQuestion) {
      setCurrentQIndex(0);
      setSelectedOption(null);
      setIsAnswered(false);
      setScore(0);
      return;
    }
    setCurrentQIndex(currentQIndex + 1);
    setSelectedOption(null);
    setIsAnswered(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 min-w-0">
      <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
        <span>
          Question {currentQIndex + 1} of {questions.length}
        </span>
        <span>Score: {score}</span>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 min-w-0">
        <h3 className="text-xl font-semibold mb-6 break-words">{q.question}</h3>

        <div className="space-y-3">
          {q.options.map((opt: string, i: number) => {
            const isSelected = selectedOption === i;
            const isCorrect = i === q.correct_index;

            let optionClass =
              "border-border hover:border-accent/50 bg-background";
            if (isAnswered) {
              if (isCorrect) optionClass = "border-green-500 bg-green-500/10";
              else if (isSelected && !isCorrect)
                optionClass = "border-red-500 bg-red-500/10";
              else optionClass = "border-border opacity-50";
            } else if (isSelected) {
              optionClass = "border-accent bg-accent/5 ring-1 ring-accent";
            }

            return (
              <button
                key={i}
                onClick={() => !isAnswered && setSelectedOption(i)}
                disabled={isAnswered}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-between gap-2 min-w-0",
                  optionClass
                )}
              >
                <span className="break-words min-w-0">{opt}</span>
                {isAnswered && isCorrect && (
                  <span className="text-green-600 text-sm font-bold shrink-0">
                    Correct
                  </span>
                )}
                {isAnswered && isSelected && !isCorrect && (
                  <span className="text-red-600 text-sm font-bold shrink-0">
                    Incorrect
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex justify-end">
          {!isAnswered ? (
            <button
              onClick={handleSubmit}
              disabled={selectedOption === null}
              className="h-10 px-6 rounded-md bg-accent text-accent-foreground font-medium disabled:opacity-50 transition-colors"
            >
              Check Answer
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="h-10 px-6 rounded-md bg-accent text-accent-foreground font-medium transition-colors"
            >
              {isLastQuestion ? "Restart Quiz" : "Next Question"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}