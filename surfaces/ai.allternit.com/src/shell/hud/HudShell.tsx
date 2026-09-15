"use client";

import React, { useEffect, useRef, useState } from "react";

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

  // Long-press / Ctrl-drag to move the HUD window from anywhere in the composer.
  const { grabbing, onPointerDown: onComposerPointerDown } = useHudComposerDrag(
    true,
    { controlDrag: true },
  );

  // Immediate drag from the dedicated drag strip at the top.
  const { grabbing: stripGrabbing, onPointerDown: onDragStripPointerDown } = useHudComposerDrag(
    true,
    { immediate: true },
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

  // Reflect whether the annotation overlay is currently open.
  const [annotationOpen, setAnnotationOpen] = useState(false);
  useEffect(() => {
    return window.allternit?.shell?.hud?.annotation?.onStateChange?.((state) => {
      setAnnotationOpen(state.open);
    });
  }, []);

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
        className="flex w-full flex-col overflow-visible rounded-2xl border border-white/25 dark:border-white/10 bg-white/75 dark:bg-neutral-900/75 text-neutral-900 dark:text-neutral-100 shadow-xl backdrop-blur-xl"
        onPointerDown={onComposerPointerDown}
      >
        {/* Drag strip — immediate grab for moving the HUD; buttons stay clickable. */}
        <div
          data-hud-drag-strip
          data-hud-grabbing={stripGrabbing ? "" : undefined}
          onPointerDown={onDragStripPointerDown}
          className="h-[16px] shrink-0 flex items-center justify-between px-2 select-none bg-transparent cursor-grab active:cursor-grabbing"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <div
            data-hud-grabber
            className="flex items-center gap-1 text-neutral-400 dark:text-neutral-500"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="8" r="1.5" />
              <circle cx="12" cy="8" r="1.5" />
              <circle cx="19" cy="8" r="1.5" />
              <circle cx="5" cy="16" r="1.5" />
              <circle cx="12" cy="16" r="1.5" />
              <circle cx="19" cy="16" r="1.5" />
            </svg>
          </div>
          <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <button
              type="button"
              onClick={() => window.allternit?.shell?.hud?.annotation?.open?.()}
              className={`rounded p-0.5 transition-colors ${
                annotationOpen
                  ? "text-blue-600 dark:text-blue-400 bg-blue-500/10"
                  : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-white/10 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`}
              aria-label="Open annotation overlay"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
                <circle cx="11" cy="11" r="2" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => window.allternit?.shell?.hud?.close?.()}
              className="rounded p-0.5 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-white/10 hover:text-neutral-900 dark:hover:text-neutral-100"
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
