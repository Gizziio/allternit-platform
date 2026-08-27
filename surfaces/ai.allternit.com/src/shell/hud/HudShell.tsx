"use client";

import React, { useEffect, useRef } from "react";

import { ChatViewWrapper } from "../ChatViewWrapper";
import { useThemeStore, useResolvedTheme } from "@/design/ThemeStore";

import { useHudClickThrough } from "./click-through";
import { useHudComposerDrag } from "./composer-drag";
import { useHudGameOverlay } from "./game-overlay";
import { useHudGlass } from "./glass";
import { useHudGoto, useReportHudSession } from "./handoff";
import { hudResizeDirections, useHudResizeHandle } from "./resize-handle";
import { useHudThreadFocus } from "./thread-focus";

import "./hud-shell.css";

/**
 * HUD mode's shell — the chrome-free floating chat.
 *
 * Renders only the live chat surface inside a translucent sheet, with no
 * titlebar, rail, or sidebars.  Wires up the HUD-specific hooks for
 * click-through, drag-to-move, resize handles, game-overlay detection,
 * native frost, and thread-focus preservation.
 */
export function HudShell(): React.ReactNode {
  // Report the active session to main so closing the HUD can hand the
  // conversation back to the main app window.
  useReportHudSession();
  // Handle retarget requests when another surface asks to show a different
  // session in the HUD.
  useHudGoto();

  const rootRef = useRef<HTMLDivElement>(null);
  const hudContainerRef = useRef<HTMLDivElement>(null);

  // Match the HUD surface to the app's theme (light/dark) instead of forcing dark.
  const themePreference = useThemeStore((state) => state.theme);
  const resolvedTheme = useResolvedTheme(themePreference);

  // Focus the composer textarea once it mounts so the HUD is ready to type.
  useEffect(() => {
    let attempts = 0;
    const id = setInterval(() => {
      const ta = document.querySelector(
        'textarea[aria-label="Text Area"]',
      ) as HTMLTextAreaElement | null;
      if (ta) {
        ta.focus();
        clearInterval(id);
      }
      if (++attempts > 20) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, []);

  // Keep the transparent HUD window sized to its content so there is no empty
  // chrome below the sheet.
  useEffect(() => {
    const el = hudContainerRef.current;
    if (!el || !window.allternit?.shell?.setHudBounds) return;

    let frame: number | null = null;
    let lastHeight = 0;
    const updateBounds = () => {
      const height = Math.round(el.scrollHeight);
      if (height === lastHeight || height === 0) return;
      lastHeight = height;
      void window.allternit?.shell?.setHudBounds?.({ height });
    };

    const ro = new ResizeObserver(() => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateBounds);
    });
    ro.observe(el);
    updateBounds();

    return () => {
      ro.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const gameUnder = useHudGameOverlay();

  // Long-press / Ctrl-drag to move the HUD window.
  const { grabbing, onPointerDown: onComposerPointerDown } = useHudComposerDrag(
    true,
    { controlDrag: true },
  );

  // Edge/corner resize handles.
  const { resizing, onPointerDown: onResizePointerDown } = useHudResizeHandle();

  // Platform windowing profile: native Wayland cannot set global x/y, so only
  // expose the right/bottom resize handles there.  The `windowing` slice is not
  // yet bridged to the renderer, so fall back to the full set.
  const hudApi = window.allternit?.shell?.hud as
    | { windowing?: { clientPlacement?: boolean } }
    | undefined;
  const resizeDirections = hudResizeDirections(
    hudApi?.windowing?.clientPlacement !== false,
  );

  // HUD shell hooks.
  useHudGlass(rootRef, /* filled */ true);
  useHudClickThrough(rootRef);
  useHudThreadFocus(rootRef);

  return (
    <div
      ref={rootRef}
      data-hud-shell
      data-hud-game={gameUnder ? "" : undefined}
      className="relative flex h-screen w-screen flex-col overflow-hidden"
      style={
        {
          WebkitAppRegion: "no-drag",
          colorScheme: resolvedTheme,
          "--view-chat-bg": "transparent",
          "--surface-canvas": "transparent",
        } as React.CSSProperties
      }
    >
      {/* Native frost/vibrancy layer behind the band. */}
      <div aria-hidden data-hud-glass />

      {/* Composer surface + drag strip.  Long-pressing anywhere inside here
          starts a window drag; the bounds wrapper also keeps thread clicks from
          stealing focus from the composer. */}
      <div
        ref={hudContainerRef}
        data-hud-composer-bounds
        data-hud-grabbing={grabbing ? "" : undefined}
        className="flex w-full flex-col overflow-visible rounded-2xl border border-[var(--chat-composer-border)] bg-[var(--chat-composer-bg)] text-[var(--ui-text-primary)] shadow-xl backdrop-blur-xl"
        onPointerDown={onComposerPointerDown}
      >
        {/* Slim drag strip + close */}
        <div
          data-hud-drag-strip
          className="h-[10px] shrink-0 flex items-center justify-between px-2 select-none bg-transparent"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <div
            data-hud-grabber
            className="flex items-center gap-1 text-[var(--ui-text-muted)] cursor-grab active:cursor-grabbing hover:text-[var(--ui-text-secondary)]"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="8" r="1.5" />
              <circle cx="12" cy="8" r="1.5" />
              <circle cx="19" cy="8" r="1.5" />
              <circle cx="5" cy="16" r="1.5" />
              <circle cx="12" cy="16" r="1.5" />
              <circle cx="19" cy="16" r="1.5" />
            </svg>
          </div>
          <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <button
              type="button"
              onClick={() => window.allternit?.shell?.hud?.close?.()}
              className="rounded p-0.5 text-[var(--ui-text-muted)] hover:bg-[var(--ui-border-muted)] hover:text-[var(--ui-text-primary)]"
              aria-label="Close HUD"
            >
              <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor">
                <path
                  d="M1 1 L9 9 M9 1 L1 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Live chat surface; never show the full-screen empty state. */}
        <ChatViewWrapper hideEmptyState hudMode />
      </div>

      {/* Edge/corner resize frame. */}
      {resizeDirections.map((direction) => (
        <div
          key={direction}
          aria-hidden
          data-hud-resize={direction}
          data-hud-grabbing={resizing ? "" : undefined}
          onPointerDown={(event) => onResizePointerDown(event, direction)}
        />
      ))}
    </div>
  );
}
