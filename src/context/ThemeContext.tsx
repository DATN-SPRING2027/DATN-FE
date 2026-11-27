"use client";

import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ThemeMode = "light" | "dark" | "auto";
type ResolvedTheme = "light" | "dark";

type ThemeContextType = {
  theme: ResolvedTheme; // Resolved theme actually active ("light" or "dark")
  themeMode: ThemeMode; // The configured preference ("light", "dark", or "auto")
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  if (resolved === "dark") {
    document.documentElement.classList.add("dark");
    document.documentElement.setAttribute("data-color-scheme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    document.documentElement.setAttribute("data-color-scheme", "light");
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const [theme, setTheme] = useState<ResolvedTheme>("light");
  const isInitializedRef = useRef(false);
  const themeRef = useRef<ResolvedTheme>(theme);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    let initialMode: ThemeMode = "light";
    try {
      const savedMode = localStorage.getItem("theme-mode") as ThemeMode | null;
      const legacySavedTheme = localStorage.getItem("theme") as ResolvedTheme | null;
      initialMode = savedMode || (legacySavedTheme as ThemeMode) || "light";
    } catch {
      initialMode = "light";
    }
    isInitializedRef.current = true;
    setThemeModeState(initialMode);
    if (initialMode === "auto") {
      const resolved =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      setTheme(resolved);
      applyResolvedTheme(resolved);
    } else {
      setTheme(initialMode);
      applyResolvedTheme(initialMode);
    }
  }, []);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    try {
      localStorage.setItem("theme-mode", themeMode);
    } catch {
      // Ignore storage access errors
    }

    if (themeMode === "auto") {
      const mediaQuery =
        typeof window.matchMedia === "function"
          ? window.matchMedia("(prefers-color-scheme: dark)")
          : null;
      const handleChange = () => {
        const resolved: ResolvedTheme = mediaQuery?.matches ? "dark" : "light";
        setTheme(resolved);
        applyResolvedTheme(resolved);
        try {
          localStorage.setItem("theme", resolved);
        } catch {
          // Ignore
        }
      };
      handleChange();
      mediaQuery?.addEventListener("change", handleChange);
      return () => {
        mediaQuery?.removeEventListener("change", handleChange);
      };
    }

    setTheme(themeMode);
    applyResolvedTheme(themeMode);
    try {
      localStorage.setItem("theme", themeMode);
    } catch {
      // Ignore
    }
  }, [themeMode]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    isInitializedRef.current = true;
    setThemeModeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    isInitializedRef.current = true;
    setThemeModeState(themeRef.current === "light" ? "dark" : "light");
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({ theme, themeMode, setThemeMode, toggleTheme }),
    [theme, themeMode, setThemeMode, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
