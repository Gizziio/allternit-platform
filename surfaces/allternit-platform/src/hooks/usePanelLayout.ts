"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSidecarStore } from "@/stores/sidecar-store";

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = "allternit:panelLayout";

const RAIL_MIN = 180;
const RAIL_MAX = 420;
const RAIL_DEFAULT = 248;

const SIDECAR_MIN = 260;
const SIDECAR_MAX = 700;
const SIDECAR_DEFAULT = 350;

// =============================================================================
// Types
// =============================================================================

export interface PanelLayout {
  railWidth: number;
  sidecarWidth: number;
}

const DEFAULT_LAYOUT: PanelLayout = {
  railWidth: RAIL_DEFAULT,
  sidecarWidth: SIDECAR_DEFAULT,
};

// =============================================================================
// Persistence helpers
// =============================================================================

function loadLayout(): PanelLayout {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<PanelLayout>;
    return {
      railWidth: clampRail(parsed.railWidth ?? RAIL_DEFAULT),
      sidecarWidth: clampSidecar(parsed.sidecarWidth ?? SIDECAR_DEFAULT),
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function saveLayout(layout: PanelLayout): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore quota errors
  }
}

function clampRail(w: number): number {
  return Math.min(RAIL_MAX, Math.max(RAIL_MIN, w));
}

function clampSidecar(w: number): number {
  return Math.min(SIDECAR_MAX, Math.max(SIDECAR_MIN, w));
}

// =============================================================================
// Hook
// =============================================================================

export interface UsePanelLayoutReturn {
  railWidth: number;
  sidecarWidth: number;
  setRailWidth: (w: number) => void;
  setSidecarWidth: (w: number) => void;
  resetLayout: () => void;
  /** Exported constraints so resize handles can reference them */
  constraints: {
    rail: { min: number; max: number; default: number };
    sidecar: { min: number; max: number; default: number };
  };
}

export function usePanelLayout(): UsePanelLayoutReturn {
  const [layout, setLayout] = useState<PanelLayout>(loadLayout);
  const setSidecarWidth_store = useSidecarStore((s) => s.setWidth);

  // Persist on every change
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    saveLayout(layout);
  }, [layout]);

  const setRailWidth = useCallback((w: number) => {
    setLayout((prev) => ({ ...prev, railWidth: clampRail(w) }));
  }, []);

  const setSidecarWidth = useCallback((w: number) => {
    setLayout((prev) => ({ ...prev, sidecarWidth: clampSidecar(w) }));
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    // Also reset sidecar width in the sidecar store
    setSidecarWidth_store(SIDECAR_DEFAULT);
  }, [setSidecarWidth_store]);

  return {
    railWidth: layout.railWidth,
    sidecarWidth: layout.sidecarWidth,
    setRailWidth,
    setSidecarWidth,
    resetLayout,
    constraints: {
      rail: { min: RAIL_MIN, max: RAIL_MAX, default: RAIL_DEFAULT },
      sidecar: { min: SIDECAR_MIN, max: SIDECAR_MAX, default: SIDECAR_DEFAULT },
    },
  };
}
