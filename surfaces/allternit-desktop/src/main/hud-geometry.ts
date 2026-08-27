/**
 * HUD geometry helpers.
 *
 * Allternit uses a compact bottom bar (720×96) that grows vertically up to
 * 520 px when streamed responses arrive. The helpers here validate renderer-
 * driven resize/move geometry and apply recovered bounds safely on platforms
 * where transparent frameless windows must not expose system resize edges.
 */

export const HUD_WIDTH = 720;
export const HUD_HEIGHT = 96;
export const HUD_MAX_HEIGHT = 520;
export const HUD_BOTTOM_MARGIN = 72;
export const HUD_MIN_WIDTH = 380;
export const HUD_MIN_HEIGHT = 80;

export interface HudWorkArea {
  height: number;
  width: number;
  x: number;
  y: number;
}

/** Display-aware default bounds used to spawn and recover the HUD layout. */
export function defaultHudBounds(area?: HudWorkArea): {
  height: number;
  width: number;
  x?: number;
  y?: number;
} {
  if (!area) {
    return { width: HUD_WIDTH, height: HUD_HEIGHT, x: undefined, y: undefined };
  }

  const width = Math.min(HUD_WIDTH, area.width);
  const height = Math.min(HUD_HEIGHT, area.height);

  return {
    width,
    height,
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(Math.max(area.y, area.y + area.height - height - HUD_BOTTOM_MARGIN)),
  };
}

export interface HudBoundsWindow {
  isDestroyed(): boolean;
  isResizable(): boolean;
  setBounds(bounds: { height: number; width: number; x?: number; y?: number }): void;
  setResizable(resizable: boolean): void;
}

export interface HudResizeBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

/** Validate renderer-provided resize geometry before it reaches native APIs. */
export function normalizeHudResizeBounds(value: unknown): HudResizeBounds | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<Record<keyof HudResizeBounds, unknown>>;
  const x = Number(candidate.x);
  const y = Number(candidate.y);
  const width = Number(candidate.width);
  const height = Number(candidate.height);

  if (![x, y, width, height].every(Number.isFinite)) {
    return null;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(HUD_MIN_WIDTH, Math.round(width)),
    height: Math.max(HUD_MIN_HEIGHT, Math.round(height)),
  };
}

/**
 * Apply recovery bounds. The HUD is created non-resizable (a transparent
 * frameless window must not expose a system resize hot-zone), which on
 * Windows/Linux also blocks programmatic setBounds sizing — flip it on
 * briefly, same as the corner-resize IPC.
 *
 * On native Wayland the compositor ignores the position half of setBounds
 * (clients cannot place themselves). Size still applies, which unsticks a
 * tall/narrow persisted geometry.
 */
export function applyHudResetBounds(
  win: HudBoundsWindow,
  bounds: { height: number; width: number; x?: number; y?: number }
): boolean {
  try {
    const wasResizable = win.isResizable();

    if (!wasResizable) {
      win.setResizable(true);
    }

    try {
      win.setBounds(bounds);
    } finally {
      if (!wasResizable && !win.isDestroyed()) {
        win.setResizable(false);
      }
    }

    return true;
  } catch {
    return false;
  }
}

/** Tiny debounce helper for persisting HUD geometry mid-drag/resize. */
export function debounce<T extends () => void>(fn: T, delayMs: number): T & { flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (() => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, delayMs);
  }) as T & { flush: () => void };

  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      fn();
    }
  };

  return debounced;
}
