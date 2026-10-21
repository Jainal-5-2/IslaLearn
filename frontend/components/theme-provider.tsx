"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("light");

    useEffect(() => {
        // Read what the inline script already applied
        const isDark = document.documentElement.classList.contains("dark");
        setThemeState(isDark ? "dark" : "light");
    }, []);

    function setTheme(next: Theme) {
        setThemeState(next);
        document.documentElement.classList.toggle("dark", next === "dark");
        localStorage.setItem("theme", next);
    }

    function toggle() {
        setTheme(theme === "dark" ? "light" : "dark");
    }

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return ctx;
}