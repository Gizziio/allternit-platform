"use client";

import { useMemo } from "react";
import { useThemeStore, resolveTheme } from "@/design/ThemeStore";

export interface StudioTheme {
  accent: string;
  bg: string;
  bgCard: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
}

const DARK_THEME: StudioTheme = {
  accent: "#D4B08C",
  bg: "#1A1612",
  bgCard: "rgba(26, 22, 18, 0.95)",
  border: "rgba(212, 176, 140, 0.16)",
  borderSubtle: "rgba(212, 176, 140, 0.10)",
  textPrimary: "#ECECEC",
  textSecondary: "#9B9B9B",
  textMuted: "#6E6E6E",
};

const LIGHT_THEME: StudioTheme = {
  accent: "#B08D6E",
  bg: "#FDF8F3",
  bgCard: "rgba(253, 248, 243, 0.95)",
  border: "rgba(154, 118, 88, 0.18)",
  borderSubtle: "rgba(154, 118, 88, 0.10)",
  textPrimary: "#2A1F16",
  textSecondary: "#664E3A",
  textMuted: "#9A7658",
};

function readCssVars(): StudioTheme {
  if (typeof document === "undefined") return DARK_THEME;
  const style = getComputedStyle(document.documentElement);
  const bg = style.getPropertyValue("--bg-primary").trim();
  const isDark = !bg || bg === "#1A1612";

  return {
    accent: style.getPropertyValue("--accent-primary").trim() || (isDark ? "#D4B08C" : "#B08D6E"),
    bg: bg || (isDark ? "#1A1612" : "#FDF8F3"),
    bgCard: style.getPropertyValue("--glass-bg-thick").trim() || (isDark ? "rgba(26, 22, 18, 0.95)" : "rgba(253, 248, 243, 0.95)"),
    border: style.getPropertyValue("--border-default").trim() || (isDark ? "rgba(212, 176, 140, 0.16)" : "rgba(154, 118, 88, 0.18)"),
    borderSubtle: style.getPropertyValue("--border-subtle").trim() || (isDark ? "rgba(212, 176, 140, 0.10)" : "rgba(154, 118, 88, 0.10)"),
    textPrimary: style.getPropertyValue("--text-primary").trim() || (isDark ? "#ECECEC" : "#2A1F16"),
    textSecondary: style.getPropertyValue("--text-secondary").trim() || (isDark ? "#9B9B9B" : "#664E3A"),
    textMuted: style.getPropertyValue("--text-tertiary").trim() || (isDark ? "#6E6E6E" : "#9A7658"),
  };
}

/**
 * Returns the current studio theme, reading CSS variables once per render.
 * Memoized to prevent layout thrashing from repeated getComputedStyle calls.
 */
export function useStudioTheme(): StudioTheme {
  const theme = useThemeStore((state) => state.theme);

  return useMemo(() => {
    // Force re-computation when theme changes
    resolveTheme(theme);
    return readCssVars();
  }, [theme]);
}

/**
 * Static fallback for non-React contexts.
 * Defaults to dark since that was the previous hardcoded behavior.
 */
export const STUDIO_THEME_FALLBACK: StudioTheme = DARK_THEME;
