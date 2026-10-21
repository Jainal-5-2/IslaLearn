"use client";

import { useState } from "react";
import { Plus, Trash2, Save, X } from "lucide-react";
import { TopicPage, createTopicPage, updateTopicPage, deleteTopicPage } from "@/lib/api";
import { showToast } from "@/components/toast";
import { cn } from "@/lib/utils";

type PageType = "text" | "video" | "quiz";

interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
}

interface PageEditorProps {
  topicId: number;
  page: TopicPage | null; // null = new page
  nextOrder: number;
  onSaved: () => void;
  onCancel: () => void;
}

export function PageEditor({
  topicId,
  page,
  nextOrder,
  onSaved,
  onCancel,
}: PageEditorProps) {
  const isNew = !page;
  const [pageType, setPageType] = useState<PageType>(
    (page?.page_type as PageType) || "text"
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Text content
  const [textBody, setTextBody] = useState<string>(
    (page?.content?.body as string) || ""
  );
  // Video content
  const [videoUrl, setVideoUrl] = useState<string>(
    (page?.content?.url as string) || ""
  );
  // Quiz content
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    (page?.content?.questions as QuizQuestion[]) || [
      { question: "", options: ["", "", "", ""], correct_index: 0 },
    ]
  );

  function buildContent(): Record<string, unknown> {
    if (pageType === "text") return { body: textBody };
    if (pageType === "video") return { url: videoUrl };
    return { questions };
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data = { page_type: pageType, content: buildContent() };
      if (isNew) {
        await createTopicPage(topicId, { order: nextOrder, ...data });
        showToast("Page added");
      } else {
        await updateTopicPage(topicId, page!.id, data);
        showToast("Page updated");
      }
      onSaved();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!page) return;
    if (!confirm("Delete this page? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteTopicPage(topicId, page.id);
      showToast("Page deleted");
      onSaved();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  function updateQuestion(index: number, patch: Partial<QuizQuestion>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q))
    );
  }

  function updateOption(qIndex: number, oIndex: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((o, j) => (j === oIndex ? value : o)) }
          : q
      )
    );
  }

  function addQuestion() {
    setQuestions((prev) => [
      ...prev,
      { question: "", options: ["", "", "", ""], correct_index: 0 },
    ]);
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h2 className="text-lg font-semibold">
          {isNew ? "Add a new page" : "Edit page"}
        </h2>
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Cancel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Page type selector */}
      <div>
        <label className="block text-sm font-medium mb-2">Page type</label>
        <div className="flex gap-2">
          {(["text", "video", "quiz"] as PageType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setPageType(t)}
              className={cn(
                "flex-1 px-4 py-2 rounded-md border text-sm font-medium capitalize transition-colors",
                pageType === t
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-background border-border hover:bg-muted"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content form */}
      {pageType === "text" && (
        <div>
          <label className="block text-sm font-medium mb-2">Content</label>
          <textarea
            value={textBody}
            onChange={(e) => setTextBody(e.target.value)}
            rows={12}
            placeholder="Write your lesson content here..."
            className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Plain text with line breaks. Markdown coming later.
          </p>
        </div>
      )}

      {pageType === "video" && (
        <div>
          <label className="block text-sm font-medium mb-2">Video URL</label>
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <p className="text-xs text-muted-foreground mt-1">
            YouTube or Vimeo links will auto-convert to embed.
          </p>
          {videoUrl && (
            <div className="mt-4 aspect-video rounded-lg overflow-hidden border border-border bg-black">
              <iframe
                src={videoUrl
                  .replace("watch?v=", "embed/")
                  .replace("youtu.be/", "www.youtube.com/embed/")}
                className="w-full h-full"
                allowFullScreen
              />
            </div>
          )}
        </div>
      )}

      {pageType === "quiz" && (
        <div className="space-y-4">
          {questions.map((q, qIndex) => (
            <div
              key={qIndex}
              className="bg-muted/30 border border-border rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Question {qIndex + 1}</span>
                {questions.length > 1 && (
                  <button
                    onClick={() => removeQuestion(qIndex)}
                    className="text-red-600 hover:bg-red-500/10 p-1 rounded"
                    aria-label="Remove question"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <input
                value={q.question}
                onChange={(e) =>
                  updateQuestion(qIndex, { question: e.target.value })
                }
                placeholder="What is...?"
                className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <div className="space-y-2">
                {q.options.map((opt, oIndex) => (
                  <div key={oIndex} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${qIndex}`}
                      checked={q.correct_index === oIndex}
                      onChange={() =>
                        updateQuestion(qIndex, { correct_index: oIndex })
                      }
                      className="accent-accent w-4 h-4 shrink-0"
                    />
                    <input
                      value={opt}
                      onChange={(e) =>
                        updateOption(qIndex, oIndex, e.target.value)
                      }
                      placeholder={`Option ${oIndex + 1}`}
                      className="flex-1 border border-border bg-background text-foreground rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Select the radio button next to the correct answer.
              </p>
            </div>
          ))}
          <button
            type="button"
            onClick={addQuestion}
            className="flex items-center gap-2 text-sm text-accent hover:underline font-medium"
          >
            <Plus className="h-4 w-4" />
            Add question
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center pt-4 border-t border-border">
        <div>
          {!isNew && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 text-sm text-red-600 hover:bg-red-500/10 px-3 py-2 rounded-md transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "Deleting..." : "Delete page"}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="h-10 px-4 rounded-md border border-border hover:bg-muted font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 font-medium transition-colors"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : isNew ? "Add page" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}