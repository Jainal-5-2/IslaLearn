"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { login, isLoggedIn } from "@/lib/api";
import { GoogleButton } from "@/components/google-button";
import { PasswordInput } from "@/components/password-input";
import { Logo } from "@/components/logo";

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
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    // Guard: Redirect already-authenticated users to the dashboard
    useEffect(() => {
        if (isLoggedIn()) {
            router.replace("/dashboard");
            // Don't flip isCheckingAuth — we're redirecting away.
            return;
        }
        setIsCheckingAuth(false);
    }, [router]);

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

    // Show a full-page loader while checking auth
    if (isCheckingAuth) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Logo size={64} showText={false} />
                    <p className="text-sm text-muted-foreground animate-pulse">
                        Loading...
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-background p-4">
            <motion.div
                className="w-full max-w-sm"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <motion.div
                    variants={itemVariants}
                    className="flex flex-col items-center mb-8"
                >
                    <Logo size={72} showText={false} />
                    <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
                        Welcome back
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Peer learning for BaSU CS
                    </p>
                </motion.div>

                <motion.form
                    variants={itemVariants}
                    onSubmit={handleSubmit}
                    className="bg-card text-card-foreground rounded-2xl border border-border p-6 space-y-4 shadow-sm"
                >
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