import { useEffect, useState, useCallback } from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "allternit-platform-theme";

function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    // localStorage may be unavailable
  }
  return "system";
}

function storeTheme(theme: ThemePreference): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(preference: ThemePreference): "light" | "dark" {
  const resolved = preference === "system" ? getSystemTheme() : preference;
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", resolved);
  }
  return resolved;
}

export function useTheme(): {
  theme: ThemePreference;
  resolved: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;
} {
  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredTheme());
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    typeof document !== "undefined"
      ? applyTheme(getStoredTheme())
      : "dark"
  );

  const setTheme = useCallback((next: ThemePreference) => {
    storeTheme(next);
    setThemeState(next);
    setResolved(applyTheme(next));
  }, []);

  useEffect(() => {
    setResolved(applyTheme(theme));

    if (theme !== "system" || typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolved(applyTheme("system"));
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme]);

  return { theme, resolved, setTheme };
}

export function initializeTheme(): void {
  if (typeof document === "undefined") return;
  applyTheme(getStoredTheme());
}
