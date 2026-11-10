"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { login, isLoggedIn } from "@/lib/api";
import { GoogleButton } from "@/components/google-button";
import { PasswordInput } from "@/components/password-input";
import { Logo } from "@/components/logo";
import { FullPageLoader } from "@/components/full-page-loader";

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

type LoginState = {
    error: string | null;
    success: boolean;
    submissionId: number;
};

const INITIAL_STATE: LoginState = {
    error: null,
    success: false,
    submissionId: 0,
};

async function loginAction(
    prevState: LoginState,
    formData: FormData
): Promise<LoginState> {
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");

    if (!username || !password) {
        return {
            error: "Username and password are required.",
            success: false,
            submissionId: prevState.submissionId + 1,
        };
    }

    try {
        await login(username, password);
        return {
            error: null,
            success: true,
            submissionId: prevState.submissionId,
        };
    } catch (err) {
        return {
            error: err instanceof Error ? err.message : "Login failed",
            success: false,
            submissionId: prevState.submissionId + 1,
        };
    }
}

export default function LoginPage() {
    const router = useRouter();
    const [state, formAction, isPending] = useActionState(
        loginAction,
        INITIAL_STATE
    );
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    useEffect(() => {
        if (isLoggedIn()) {
            router.replace("/dashboard");
            return;
        }
        setIsCheckingAuth(false);
    }, [router]);

    useEffect(() => {
        if (state.success) {
            router.push("/dashboard");
        }
    }, [state.success, router]);

    if (isCheckingAuth) {
        return <FullPageLoader message="Loading..." />;
    }

    if (state.success) {
        return <FullPageLoader message="Signing you in..." />;
    }

    const isBusy = isPending || state.success;

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
                    action={formAction}
                    className="bg-card text-card-foreground rounded-2xl border border-border p-6 space-y-4 shadow-sm"
                >
                    {state.error && (
                        <p className="text-sm text-red-600 bg-red-500/10 p-2 rounded">
                            {state.error}
                        </p>
                    )}

                    <div
                        className={
                            isBusy
                                ? "opacity-60 pointer-events-none transition-opacity space-y-4"
                                : "transition-opacity space-y-4"
                        }
                        aria-busy={isBusy}
                    >
                        <GoogleButton />

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-card px-2 text-muted-foreground">or</span>
                            </div>
                        </div>

                        {/* Remounted on each failed submission so both fields reset. */}
                        <div key={state.submissionId} className="space-y-4">
                            <div>
                                <label
                                    htmlFor="login-username"
                                    className="block text-sm font-medium mb-1"
                                >
                                    Username
                                </label>
                                <input
                                    id="login-username"
                                    name="username"
                                    required
                                    disabled={isBusy}
                                    className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-60"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="login-password"
                                    className="block text-sm font-medium mb-1"
                                >
                                    Password
                                </label>
                                <PasswordFieldSync disabled={isBusy} />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isBusy}
                        className="w-full inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground rounded-lg px-3 py-2.5 font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                    >
                        {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isBusy ? "Logging in..." : "Log in"}
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

/**
 * PasswordInput is controlled (value + onChange), so it does not submit
 * a value under `action={formAction}`. The hidden input mirrors its
 * state into FormData under the "password" name.
 */
function PasswordFieldSync({ disabled }: { disabled?: boolean }) {
    const [password, setPassword] = useState("");
    return (
        <>
            <PasswordInput
                value={password}
                onChange={setPassword}
                required
                disabled={disabled}
            />
            <input type="hidden" name="password" value={password} />
        </>
    );
}