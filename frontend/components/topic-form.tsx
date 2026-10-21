"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { Subject, Topic, updateTopic } from "@/lib/api";
import { showToast } from "@/components/toast";

interface TopicFormProps {
  topic: Topic;
  subjects: Subject[];
  onSaved: () => void;
}

export function TopicForm({ topic, subjects, onSaved }: TopicFormProps) {
  const [title, setTitle] = useState(topic.title);
  const [description, setDescription] = useState(topic.description);
  const [subjectId, setSubjectId] = useState(topic.subject.id);
  const [isPublished, setIsPublished] = useState(topic.is_published);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateTopic(topic.id, {
        title,
        description,
        subject: subjectId,
        is_published: isPublished,
      });
      showToast("Topic updated");
      onSaved();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <h2 className="text-lg font-semibold border-b border-border pb-4">
        Topic details
      </h2>

      <div>
        <label className="block text-sm font-medium mb-1.5">Subject</label>
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(Number(e.target.value))}
          className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="publish"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
          className="accent-accent w-4 h-4"
        />
        <label htmlFor="publish" className="text-sm">
          Published
        </label>
      </div>

      <div className="flex justify-end pt-4 border-t border-border">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 font-medium transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save details"}
        </button>
      </div>
    </div>
  );
}