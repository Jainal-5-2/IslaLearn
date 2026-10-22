"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Save } from "lucide-react";
import {
    getSubjects,
    createTopic,
    getMe,
    logout,
    Subject,
    User,
    isLoggedIn,
} from "@/lib/api";
import { AppShell } from "@/components/app-shell";

export default function NewTopicPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    const [subjectId, setSubjectId] = useState<number | "">("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [isPublished, setIsPublished] = useState(false);

    useEffect(() => {
        if (!isLoggedIn()) {
            router.replace("/login");
            return;
        }

        Promise.all([getMe(), getSubjects()])
            .then(([userData, subjectsData]) => {
                setUser(userData);
                setSubjects(subjectsData);
            })
            .catch((err) =>
                setError(err instanceof Error ? err.message : "Failed to load")
            )
            .finally(() => setIsCheckingAuth(false));
    }, [router]);

    function handleLogout() {
        logout();
        router.replace("/login");
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!subjectId) {
            setError("Please select a subject.");
            return;
        }
        setError("");
        setSubmitting(true);
        try {
            const topic = await createTopic({
                subject: Number(subjectId),
                title,
                description,
                is_published: isPublished,
                free_page_count: 2,
            });
            router.push(`/topics/${topic.id}/edit`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create topic");
        } finally {
            setSubmitting(false);
        }
    }

    if (!user) return null;

    return (
        <AppShell user={user} onLogout={handleLogout}>
            <div className="max-w-2xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold">Create a Topic</h1>
                        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                            Start a new async learning resource
                        </p>
                    </div>
                    <Link
                        href="/topics"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        &larr; Back to topics
                    </Link>
                </div>

                <motion.form
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onSubmit={handleSubmit}
                    className="bg-card border border-border rounded-xl p-6 space-y-5 shadow-sm"
                >
                    {error && (
                        <p className="text-sm text-red-600 bg-red-500/10 p-3 rounded-lg">
                            {error}
                        </p>
                    )}

                    <div>
                        <label className="block text-sm font-medium mb-1.5">
                            Subject <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={subjectId}
                            onChange={(e) =>
                                setSubjectId(e.target.value ? Number(e.target.value) : "")
                            }
                            required
                            className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
                        >
                            <option value="" disabled>
                                Select a subject...
                            </option>
                            {subjects.map((sub) => (
                                <option key={sub.id} value={sub.id}>
                                    {sub.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5">
                            Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            placeholder="e.g., Introduction to Python Functions"
                            className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            placeholder="What will students learn from this topic?"
                            className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
                        />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <input
                            type="checkbox"
                            id="publish"
                            checked={isPublished}
                            onChange={(e) => setIsPublished(e.target.checked)}
                            className="accent-accent w-4 h-4"
                        />
                        <label htmlFor="publish" className="text-sm">
                            Publish immediately{" "}
                            <span className="text-muted-foreground">
                                (otherwise saved as a draft)
                            </span>
                        </label>
                    </div>

                    <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                        You&apos;ll add pages (text, video, quiz) after creating the topic.
                    </p>

                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <Link
                            href="/topics"
                            className="inline-flex items-center justify-center h-10 px-4 rounded-md border border-border hover:bg-muted font-medium transition-colors"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                        >
                            <Save className="h-4 w-4" />
                            {submitting ? "Creating..." : "Create Topic"}
                        </button>
                    </div>
                </motion.form>
            </div>
        </AppShell>
    );
}