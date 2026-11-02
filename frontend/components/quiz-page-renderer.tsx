"use client";

import { useState } from "react";
import {
  CheckCircle2,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { submitQuiz, TopicPage, QuizResult } from "@/lib/api";
import { showToast } from "@/components/toast";
import { cn } from "@/lib/utils";

/**
 * Quiz page for the reader.
 *
 * Phase 12 moved scoring to the server: answers are POSTed to
 * /topics/{id}/quiz/{pageId}/submit/, the server returns
 * {score, total, passed, passing_score}, and only a passing result
 * enables Next/Finished.
 *
 * Local state:
 *   - `selected` per question, so the user can change their pick before
 *     submitting.
 *   - `submittedAnswers` snapshot, so after submission we can show which
 *     options the user picked and which were right.
 *   - `result`, the last server response. Null until the first submit.
 *
 * Retake: restarting clears `result` and re-enables the answer form.
 * The next submit overwrites quiz_results[str(pageId)] server-side;
 * the parent's onSubmitted callback updates the mirror so the sidebar
 * and Next button reflect it.
 *
 * passing_score: read from page.content.passing_score. The server
 * defaults it to len(questions) when missing, so for old quizzes the
 * review panel's "you needed N of M" is the same as "all of them".
 */
export function QuizPageRenderer({
  topicId,
  page,
  existingResult,
  onSubmitted,
  onFinish,
  isLastPage,
  finishing,
}: {
  topicId: number;
  page: TopicPage;
  existingResult: QuizResult | null;
  onSubmitted: (result: QuizResult) => void;
  onFinish: () => void;
  isLastPage: boolean;
  finishing: boolean;
}) {
  const questions: {
    question: string;
    options: string[];
    correct_index: number;
  }[] = page.content?.questions || [];

  const rawPassingScore = page.content?.passing_score;
  const passingScore =
    typeof rawPassingScore === "number" && rawPassingScore > 0
      ? rawPassingScore
      : questions.length;

  // Whether the user has already passed this quiz in a prior visit.
  // If so, they land on the review view; they can still retake.
  const alreadyPassed = existingResult?.passed === true;

  const [selected, setSelected] = useState<(number | null)[]>(() =>
    questions.map(() => null)
  );
  const [submittedAnswers, setSubmittedAnswers] = useState<number[] | null>(
    null
  );
  const [result, setResult] = useState<QuizResult | null>(
    existingResult ?? null
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  if (questions.length === 0) {
    return (
      <p className="text-muted-foreground italic">No quiz questions provided.</p>
    );
  }

  const allAnswered = selected.every((s) => s !== null);
  const showingReview = submittedAnswers !== null && result !== null;
  const passed = result?.passed === true;

  async function handleSubmit() {
    if (!allAnswered) return;
    const answers = selected as number[];
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await submitQuiz(topicId, page.id, answers);
      const quizResult: QuizResult = {
        score: res.score,
        total: res.total,
        passed: res.passed,
      };
      setResult(quizResult);
      setSubmittedAnswers(answers);
      onSubmitted(quizResult);
      if (res.passed) {
        showToast(`Passed: ${res.score} of ${res.total}.`);
      } else {
        showToast(
          `Not yet: ${res.score} of ${res.total}. Need ${res.passing_score} to pass.`
        );
      }
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "Failed to submit quiz."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleRestart() {
    setSelected(questions.map(() => null));
    setSubmittedAnswers(null);
    setResult(null);
    setSubmitError("");
  }

  // ---- Review view: submitted at least once ----
  if (showingReview && submittedAnswers && result) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 min-w-0">
        <div
          className={cn(
            "rounded-xl border-2 p-5",
            passed
              ? "border-green-500 bg-green-500/5"
              : "border-orange-500 bg-orange-500/5"
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            {passed ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <RotateCcw className="h-5 w-5 text-orange-600" />
            )}
            <h3 className="text-lg font-semibold text-foreground">
              {passed ? "Quiz passed" : "Not passed yet"}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            You scored{" "}
            <span className="font-semibold text-foreground">
              {result.score}
            </span>{" "}
            of {result.total}. You needed {passingScore} to pass.{" "}
            {passed
              ? "You can continue."
              : "Review the answers below and try again. Passing this quiz is required to move on."}
          </p>
        </div>

        <div className="space-y-4">
          {questions.map((q, qi) => {
            const given = submittedAnswers[qi];
            const isCorrect = given === q.correct_index;
            return (
              <div
                key={qi}
                className="bg-card border border-border rounded-xl p-5"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Question {qi + 1}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded",
                      isCorrect
                        ? "bg-green-500/10 text-green-600"
                        : "bg-red-500/10 text-red-600"
                    )}
                  >
                    {isCorrect ? "Correct" : "Incorrect"}
                  </span>
                </div>
                <h4 className="text-base font-medium mb-3 break-words">
                  {q.question}
                </h4>
                <ul className="space-y-2">
                  {q.options.map((opt, oi) => {
                    const isTheAnswer = oi === q.correct_index;
                    const isTheChoice = oi === given;
                    let cls =
                      "border-border bg-background text-foreground";
                    if (isTheAnswer) {
                      cls = "border-green-500 bg-green-500/10";
                    } else if (isTheChoice) {
                      cls = "border-red-500 bg-red-500/10";
                    }
                    return (
                      <li
                        key={oi}
                        className={cn(
                          "px-3 py-2 rounded-lg border-2 text-sm break-words flex items-center justify-between gap-2",
                          cls
                        )}
                      >
                        <span>{opt}</span>
                        {isTheAnswer && (
                          <span className="text-xs font-semibold text-green-600 shrink-0">
                            Correct answer
                          </span>
                        )}
                        {!isTheAnswer && isTheChoice && (
                          <span className="text-xs font-semibold text-red-600 shrink-0">
                            Your pick
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            onClick={handleRestart}
            className="inline-flex items-center gap-1 h-10 px-4 rounded-md border border-border hover:bg-muted font-medium transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            {passed ? "Retake quiz" : "Try again"}
          </button>
          {passed && isLastPage && (
            <button
              onClick={onFinish}
              disabled={finishing}
              className="inline-flex items-center gap-1 h-10 px-6 rounded-md bg-green-600 text-white hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              {finishing ? "Finishing..." : "Finished"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---- Answering view ----
  return (
    <div className="max-w-2xl mx-auto space-y-6 min-w-0">
      <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
        <span>
          {questions.length} question{questions.length === 1 ? "" : "s"} ·{" "}
          {passingScore} required to pass
        </span>
        <span>{selected.filter((s) => s !== null).length} answered</span>
      </div>

      {alreadyPassed && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-foreground">
          You already passed this quiz. Answer again to retake, or use the
          Next / Finished buttons below to continue.
        </div>
      )}

      <div className="space-y-4">
        {questions.map((q, qi) => (
          <div
            key={qi}
            className="bg-card border border-border rounded-xl p-5"
          >
            <h3 className="text-base font-semibold mb-4 break-words">
              <span className="text-muted-foreground mr-2">{qi + 1}.</span>
              {q.question}
            </h3>
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const isSelected = selected[qi] === oi;
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => {
                      setSelected((prev) => {
                        const next = [...prev];
                        next[qi] = oi;
                        return next;
                      });
                    }}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-between gap-2 min-w-0",
                      isSelected
                        ? "border-accent bg-accent/5 ring-1 ring-accent"
                        : "border-border hover:border-accent/50 bg-background"
                    )}
                  >
                    <span className="break-words min-w-0">{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {submitError && (
        <p className="text-sm text-red-600 bg-red-500/10 p-3 rounded-lg">
          {submitError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          className="inline-flex items-center gap-1 h-10 px-6 rounded-md bg-accent text-accent-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Submitting..." : "Submit answers"}
        </button>
      </div>
    </div>
  );
}