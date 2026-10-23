"use client";

import { Suspense, useEffect, useRef, useState } from "react";
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
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import {
  getTopic,
  getMe,
  recordProgress,
  unlockTopic,
  Topic,
  TopicPage,
  User,
  ApiError,
} from "@/lib/api";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageSkeleton } from "@/components/page-skeleton";
import { cn } from "@/lib/utils";

const PROGRESS_DEBOUNCE_MS = 500;

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="reader" />}>
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

  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [finishing, setFinishing] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const [progressLastPageIndex, setProgressLastPageIndex] = useState(-1);

  const isOwnerRef = useRef<boolean | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [topicData, userData] = await Promise.all([
          getTopic(topicId),
          getMe(),
        ]);
        setTopic(topicData);
        setCurrentUser(userData);

        const owner = userData.id === topicData.created_by.id;
        isOwnerRef.current = owner;

        if (topicData.progress) {
          setProgressLastPageIndex(topicData.progress.last_page_index);
        }

        if (
          !owner &&
          topicData.progress &&
          topicData.progress.last_page_index > 0 &&
          topicData.progress.last_page_index < (topicData.pages?.length ?? 0)
        ) {
          setActivePageIndex(topicData.progress.last_page_index);
          setShowResumeBanner(true);
        }
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
  }, [topicId]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activePageIndex]);

  useEffect(() => {
    if (loading) return;
    if (isOwnerRef.current !== false) return;
    if (!topic || !topic.pages || topic.pages.length === 0) return;

    if (progressTimerRef.current !== null) {
      clearTimeout(progressTimerRef.current);
    }

    const pageIndex = activePageIndex;
    progressTimerRef.current = setTimeout(() => {
      recordProgress(topic.id, pageIndex)
        .then((updated) => {
          setProgressLastPageIndex(updated.last_page_index);
        })
        .catch(() => {});
      progressTimerRef.current = null;
    }, PROGRESS_DEBOUNCE_MS);

    return () => {
      if (progressTimerRef.current !== null) {
        clearTimeout(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageIndex, loading]);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current !== null) {
        clearTimeout(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, []);

  function requestStartFromBeginning() {
    setShowResetConfirm(true);
  }

  function confirmStartFromBeginning() {
    setShowResetConfirm(false);
    setActivePageIndex(0);
    setProgressLastPageIndex(0);
    setShowResumeBanner(false);
    if (topic && isOwnerRef.current === false) {
      recordProgress(topic.id, 0, { reset: true })
        .then((updated) => {
          setProgressLastPageIndex(updated.last_page_index);
        })
        .catch(() => {});
    }
  }

  async function handleUnlock() {
    if (!topic) return;
    setUnlocking(true);
    try {
      await unlockTopic(topic.id);
      // Refetch so the now-unlocked pages come back with real content.
      const refreshed = await getTopic(topic.id);
      setTopic(refreshed);
    } catch (err) {
      // Leave the gate visible. The user can retry.
    } finally {
      setUnlocking(false);
    }
  }

  async function handleFinish() {
    if (!topic) return;
    setFinishing(true);
    try {
      await recordProgress(topic.id, activePageIndex).catch(() => {});
      router.push(`/topics/${topic.id}`);
    } finally {
      setFinishing(false);
    }
  }

  if (loading) {
    return <PageSkeleton variant="reader" />;
  }

  if (error || !topic || !currentUser) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <p className="text-red-600">{error || "Topic not found."}</p>
        <Link href="/topics" className="text-accent underline">
          Back to topics
        </Link>
      </main>
    );
  }

  const isOwner = currentUser.id === topic.created_by.id;
  const pages = topic.pages || [];
  const activePage = pages[activePageIndex];

  const unlockedUpTo = Math.max(activePageIndex, progressLastPageIndex);
  const completedUpTo = Math.max(activePageIndex, progressLastPageIndex) - 1;
  const isLastPage = activePageIndex === pages.length - 1;

  const handleNext = () => {
    if (activePageIndex < pages.length - 1) {
      setActivePageIndex(activePageIndex + 1);
      if (showResumeBanner) setShowResumeBanner(false);
    }
  };

  const handlePrev = () => {
    if (activePageIndex > 0) {
      setActivePageIndex(activePageIndex - 1);
      if (showResumeBanner) setShowResumeBanner(false);
    }
  };

  const handleSelectPage = (index: number) => {
    if (!isOwner && index > unlockedUpTo) return;
    setActivePageIndex(index);
    setIsSidebarOpen(false);
    if (showResumeBanner) setShowResumeBanner(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
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
            href={`/topics/${topic.id}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Exit
          </Link>
        </div>
      </div>

      <div className="flex flex-1 lg:flex-row min-h-0">
        {isSidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

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
                  href={`/topics/${topic.id}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  &larr; About this topic
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
              {pages.map((page, index) => {
                const progressLocked = !isOwner && index > unlockedUpTo;
                const payLocked = page.is_locked;
                const isCompleted = !isOwner && index <= completedUpTo;

                return (
                  <button
                    key={page.id}
                    onClick={() => handleSelectPage(index)}
                    disabled={progressLocked}
                    aria-disabled={progressLocked}
                    title={
                      progressLocked
                        ? "Keep reading to unlock this page"
                        : undefined
                    }
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between transition-colors",
                      index === activePageIndex
                        ? "bg-accent/10 text-accent font-medium"
                        : progressLocked
                          ? "text-muted-foreground/60 cursor-not-allowed"
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
                    {isCompleted ? (
                      <CheckCircle2
                        className="h-3.5 w-3.5 text-green-600 shrink-0"
                        aria-label="Completed"
                      />
                    ) : payLocked || progressLocked ? (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : null}
                  </button>
                );
              })}
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

        <section className="flex-1 min-w-0 px-6 lg:px-12 pt-6 lg:pt-12 pb-12">
          <div className="max-w-3xl mx-auto w-full min-w-0">
            {showResumeBanner && !isOwner && (
              <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
                <span className="text-foreground">
                  Resumed to page {activePageIndex + 1} of {pages.length}.
                </span>
                <button
                  onClick={requestStartFromBeginning}
                  className="inline-flex items-center gap-1 text-accent hover:underline font-medium shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Start from beginning
                </button>
              </div>
            )}

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
              <LockGate
                pageIndex={activePageIndex}
                onUnlock={handleUnlock}
                unlocking={unlocking}
              />
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
                      <QuizPageRenderer
                        content={activePage.content}
                        onFinish={handleFinish}
                        isLastPage={isLastPage}
                        finishing={finishing}
                      />
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

                    {isLastPage ? (
                      activePage.page_type === "quiz" ? null : (
                        <button
                          onClick={handleFinish}
                          disabled={finishing}
                          className="inline-flex items-center gap-1 h-10 px-4 rounded-md bg-green-600 text-white hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {finishing ? "Finishing..." : "Finished"}
                        </button>
                      )
                    ) : (
                      <button
                        onClick={handleNext}
                        className="inline-flex items-center gap-1 h-10 px-4 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 font-medium transition-colors"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </section>
      </div>

      <ResetProgressDialog
        open={showResetConfirm}
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={confirmStartFromBeginning}
        totalPages={pages.length}
      />
    </div>
  );
}

// ---------- Renderers ----------

function LockGate({
  pageIndex,
  onUnlock,
  unlocking,
}: {
  pageIndex: number;
  onUnlock: () => void;
  unlocking: boolean;
}) {
  return (
    <div className="flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
        <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Continue learning</h2>
        <p className="text-muted-foreground mb-6">
          Page {pageIndex + 1} is past the free preview. Unlock the rest of
          this topic to keep reading.
        </p>
        <button
          onClick={onUnlock}
          disabled={unlocking}
          className="w-full h-10 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {unlocking ? "Unlocking..." : "Unlock this topic"}
        </button>
      </div>
    </div>
  );
}

function ResetProgressDialog({
  open,
  onCancel,
  onConfirm,
  totalPages,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  totalPages: number;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onCancel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-progress-title"
          aria-describedby="reset-progress-description"
        >
          <motion.div
            className="w-full max-w-md bg-card text-card-foreground border border-border rounded-2xl shadow-lg p-6"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2
                  id="reset-progress-title"
                  className="text-lg font-semibold text-foreground"
                >
                  Start from the beginning?
                </h2>
                <p
                  id="reset-progress-description"
                  className="text-sm text-muted-foreground mt-1"
                >
                  Your reading progress on this topic will be reset to page 1
                  of {totalPages}. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
              <button
                ref={cancelRef}
                onClick={onCancel}
                className="h-10 px-4 rounded-md border border-border hover:bg-muted font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="h-10 rounded-md bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
              >
                Reset progress
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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

function QuizPageRenderer({
  content,
  onFinish,
  isLastPage,
  finishing,
}: {
  content: any;
  onFinish: () => void;
  isLastPage: boolean;
  finishing: boolean;
}) {
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

        <div className="mt-8 flex flex-wrap justify-end gap-2">
          {!isAnswered ? (
            <button
              onClick={handleSubmit}
              disabled={selectedOption === null}
              className="h-10 px-6 rounded-md bg-accent text-accent-foreground font-medium disabled:opacity-50 transition-colors"
            >
              Check Answer
            </button>
          ) : (
            <>
              <button
                onClick={handleNext}
                className="h-10 px-6 rounded-md bg-accent text-accent-foreground font-medium transition-colors"
              >
                {isLastQuestion ? "Restart Quiz" : "Next Question"}
              </button>
              {isLastQuestion && (
                <button
                  onClick={isLastPage ? onFinish : handleNext}
                  disabled={finishing}
                  className="inline-flex items-center gap-1 h-10 px-6 rounded-md bg-green-600 text-white hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isLastPage
                    ? finishing
                      ? "Finishing..."
                      : "Finished"
                    : "Next"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}