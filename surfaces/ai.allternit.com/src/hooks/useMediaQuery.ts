"use client";

import { useEffect, useState } from "react";

// =============================================================================
// Constants
// =============================================================================

/** Viewports narrower than this (in px) use the mobile shell layout. */
export const MOBILE_BREAKPOINT_PX = 768;

// =============================================================================
// Hooks
// =============================================================================

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    // Sync in case the query changed or the initial state was stale.
    setMatches(mediaQueryList.matches);
    mediaQueryList.addEventListener("change", onChange);
    return () => mediaQueryList.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True when the viewport is narrower than the mobile breakpoint (< 768px). */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
}
