"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { register, login, ApiError } from "@/lib/api";
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

export default function RegisterPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [ageConfirmed, setAgeConfirmed] = useState(false);
    const [error, setError] = useState("");
    const [ageError, setAgeError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setAgeError("");
        setLoading(true);
        try {
            await register(username, email, password, ageConfirmed);
            await login(username, password);
            router.push("/dashboard");
        } catch (err) {
            if (err instanceof ApiError && err.body && typeof err.body === "object") {
                const body = err.body as Record<string, unknown>;
                if ("age_confirmed" in body) {
                    const ageMsg = body.age_confirmed;
                    if (Array.isArray(ageMsg) && ageMsg.length > 0) {
                        setAgeError(String(ageMsg[0]));
                    } else if (typeof ageMsg === "string") {
                        setAgeError(ageMsg);
                    } else {
                        setAgeError("Please confirm your age to continue.");
                    }
                } else {
                    setError(err.message);
                }
            } else {
                setError(err instanceof Error ? err.message : "Registration failed");
            }
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
                    <h1 className="text-xl font-bold text-center">Create your account</h1>

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
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                    </div>

                    <PasswordInput
                        value={password}
                        onChange={setPassword}
                        required
                    />

                    <div>
                        <label className="flex items-start gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={ageConfirmed}
                                onChange={(e) => {
                                    setAgeConfirmed(e.target.checked);
                                    if (e.target.checked) setAgeError("");
                                }}
                                className="mt-1 accent-accent"
                            />
                            <span className="text-muted-foreground">
                                I confirm I am 18 years or older, or I have parental consent to
                                use IslaLearn.
                            </span>
                        </label>
                        {ageError && (
                            <p className="text-xs text-red-600 mt-1 ml-6">{ageError}</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-accent text-accent-foreground rounded-lg px-3 py-2.5 font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                    >
                        {loading ? "Creating account..." : "Create account"}
                    </button>

                    <p className="text-sm text-center text-muted-foreground">
                        Already have an account?{" "}
                        <Link href="/login" className="text-accent underline">
                            Log in
                        </Link>
                    </p>
                </motion.form>
            </motion.div>
        </main>
    );
}