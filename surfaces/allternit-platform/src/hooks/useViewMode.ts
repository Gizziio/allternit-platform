"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

export type ViewMode = "verbose" | "normal" | "summary";

const STORAGE_KEY = "allternit:viewMode";
const MODE_ORDER: ViewMode[] = ["verbose", "normal", "summary"];
const DEFAULT_MODE: ViewMode = "normal";

function readStorage(): ViewMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "verbose" || stored === "normal" || stored === "summary") {
      return stored;
    }
  } catch {
    // localStorage unavailable (private browsing, SSR, etc.)
  }
  return DEFAULT_MODE;
}

function writeStorage(mode: ViewMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useViewMode() {
  const [viewMode, setViewModeState] = useState<ViewMode>(readStorage);

  // Keep localStorage in sync
  const setViewMode = useCallback((mode: ViewMode) => {
    writeStorage(mode);
    setViewModeState(mode);
    // Dispatch a custom event so other instances of the hook can react
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("allternit:viewModeChange", { detail: mode }));
    }
  }, []);

  const cycleViewMode = useCallback(() => {
    setViewModeState((current) => {
      const idx = MODE_ORDER.indexOf(current);
      const next = MODE_ORDER[(idx + 1) % MODE_ORDER.length];
      writeStorage(next);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("allternit:viewModeChange", { detail: next }));
      }
      return next;
    });
  }, []);

  // Sync across tabs / hook instances via the custom event
  useEffect(() => {
    function onExternal(e: Event) {
      const detail = (e as CustomEvent<ViewMode>).detail;
      if (detail) setViewModeState(detail);
    }
    window.addEventListener("allternit:viewModeChange", onExternal);
    return () => window.removeEventListener("allternit:viewModeChange", onExternal);
  }, []);

  // ⌘+Shift+V keyboard shortcut — cycles through modes
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "V" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        cycleViewMode();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cycleViewMode]);

  return { viewMode, setViewMode, cycleViewMode };
}
