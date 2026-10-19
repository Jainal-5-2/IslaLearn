"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { login } from "@/lib/api";
import { GoogleButton } from "@/components/google-button";
import { PasswordInput } from "@/components/password-input";

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await login(username, password);
            router.push("/dashboard");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-background p-4">
            <motion.div
                className="w-full max-w-sm"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <motion.div variants={itemVariants} className="text-center mb-8">
                    <Link
                        href="/"
                        className="text-2xl font-bold tracking-tight text-foreground hover:text-accent transition-colors"
                    >
                        IslaLearn
                    </Link>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Peer learning for BaSU CS
                    </p>
                </motion.div>

                <motion.form
                    variants={itemVariants}
                    onSubmit={handleSubmit}
                    className="bg-card text-card-foreground rounded-2xl border border-border p-6 space-y-4 shadow-sm"
                >
                    <h1 className="text-xl font-bold text-center">Welcome back</h1>

                    {error && (
                        <p className="text-sm text-red-600 bg-red-500/10 p-2 rounded">
                            {error}
                        </p>
                    )}

                    <GoogleButton />

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">or</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Username</label>
                        <input
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Password</label>
                        <PasswordInput
                            value={password}
                            onChange={setPassword}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-accent text-accent-foreground rounded-lg px-3 py-2.5 font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                    >
                        {loading ? "Logging in..." : "Log in"}
                    </button>

                    <p className="text-sm text-center text-muted-foreground">
                        New here?{" "}
                        <Link href="/register" className="text-accent underline">
                            Create an account
                        </Link>
                    </p>
                </motion.form>
            </motion.div>
        </main>
    );
}