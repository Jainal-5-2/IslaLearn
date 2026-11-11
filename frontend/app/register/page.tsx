"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { register, login, isLoggedIn, ApiError } from "@/lib/api";
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

type RegisterState = {
    error: string | null;
    ageError: string | null;
    success: boolean;
    submissionId: number;
};

const INITIAL_STATE: RegisterState = {
    error: null,
    ageError: null,
    success: false,
    submissionId: 0,
};

async function registerAction(
    prevState: RegisterState,
    formData: FormData
): Promise<RegisterState> {
    const username = String(formData.get("username") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const ageConfirmed = formData.get("age_confirmed") === "on";
    const nextId = prevState.submissionId + 1;

    try {
        await register(username, email, password, ageConfirmed);
        await login(username, password);
        return {
            error: null,
            ageError: null,
            success: true,
            submissionId: prevState.submissionId,
        };
    } catch (err) {
        if (err instanceof ApiError && err.body && typeof err.body === "object") {
            const body = err.body as Record<string, unknown>;
            if ("age_confirmed" in body) {
                const ageMsg = body.age_confirmed;
                let ageError: string;
                if (Array.isArray(ageMsg) && ageMsg.length > 0) {
                    ageError = String(ageMsg[0]);
                } else if (typeof ageMsg === "string") {
                    ageError = ageMsg;
                } else {
                    ageError = "Please confirm your age to continue.";
                }
                return {
                    error: null,
                    ageError,
                    success: false,
                    submissionId: nextId,
                };
            }
            return {
                error: err.message,
                ageError: null,
                success: false,
                submissionId: nextId,
            };
        }
        return {
            error: err instanceof Error ? err.message : "Registration failed",
            ageError: null,
            success: false,
            submissionId: nextId,
        };
    }
}

export default function RegisterPage() {
    const router = useRouter();
    const [state, formAction, isPending] = useActionState(
        registerAction,
        INITIAL_STATE
    );
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    // Controlled so we can clear the age error the moment the user
    // checks the box, instead of a sticky one-way flag that swallowed
    // any later server-side age error after the first check.
    const [ageConfirmed, setAgeConfirmed] = useState(false);

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

    // A fresh submission should not inherit "dismissed" state from a
    // previous attempt. The server is the source of truth on failure;
    // if it returns an age error, show it.
    useEffect(() => {
        // no-op placeholder if needed; ageConfirmed is reset via the
        // remount boundary below, see key on the field block.
    }, [state.submissionId]);

    if (isCheckingAuth) {
        return <FullPageLoader message="Loading..." />;
    }

    if (state.success) {
        return <FullPageLoader message="Signing you in..." />;
    }

    const isBusy = isPending || state.success;
    // Hide the server age error only while the box is currently
    // checked. Unchecking it brings the error back into view if the
    // last submission failed on that field.
    const ageError = ageConfirmed ? null : state.ageError;

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
                        Create your account
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

                        {/* Remounted on each failed submission so the fields reset. */}
                        <div key={state.submissionId} className="space-y-4">
                            <div>
                                <label
                                    htmlFor="register-username"
                                    className="block text-sm font-medium mb-1"
                                >
                                    Username
                                </label>
                                <input
                                    id="register-username"
                                    name="username"
                                    required
                                    disabled={isBusy}
                                    className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-60"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="register-email"
                                    className="block text-sm font-medium mb-1"
                                >
                                    Email
                                </label>
                                <input
                                    id="register-email"
                                    name="email"
                                    type="email"
                                    required
                                    disabled={isBusy}
                                    className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-60"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="register-password"
                                    className="block text-sm font-medium mb-1"
                                >
                                    Password
                                </label>
                                <PasswordFieldSync disabled={isBusy} />
                                <p className="text-xs text-muted-foreground mt-1">
                                    At least 8 characters.
                                </p>
                            </div>

                            <div>
                                <label className="flex items-start gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        name="age_confirmed"
                                        checked={ageConfirmed}
                                        onChange={(e) =>
                                            setAgeConfirmed(e.target.checked)
                                        }
                                        disabled={isBusy}
                                        className="mt-1 accent-accent"
                                    />
                                    <span className="text-muted-foreground">
                                        I confirm I am 18 years or older, or I have parental consent
                                        to use IslaLearn, and I agree to the{" "}
                                        <Link
                                            href="/terms"
                                            className="text-accent underline"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Terms of Service
                                        </Link>{" "}
                                        and{" "}
                                        <Link
                                            href="/privacy"
                                            className="text-accent underline"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Privacy Policy
                                        </Link>
                                        .
                                    </span>
                                </label>
                                {ageError && (
                                    <p className="text-xs text-red-600 mt-1 ml-6">{ageError}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isBusy}
                        className="w-full inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground rounded-lg px-3 py-2.5 font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                    >
                        {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isBusy ? "Creating account..." : "Create account"}
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
                minLength={8}
                disabled={disabled}
            />
            <input type="hidden" name="password" value={password} />
        </>
    );
}