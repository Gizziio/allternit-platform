"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Plugs,
  Record,
  Square,
  UploadSimple,
  ArrowSquareOut,
  Spinner,
  Warning,
  CheckCircle,
} from "@phosphor-icons/react";
import { useApiCaptureStore } from "@/lib/api-capture/store";
import { getCaptureAdapter, type CaptureAdapter } from "@/lib/api-capture/adapter";
import type { CaptureSession } from "@/lib/api-capture/api";
import { cn } from "@/lib/utils";

interface BrowserApiCaptureButtonProps {
  domain?: string;
  disabled?: boolean;
  onOpenSiteApis?: () => void;
}

type CapturePhase = "idle" | "starting" | "capturing" | "stopping" | "derived";

interface MenuPosition {
  top: number;
  right: number;
}

function adapterSource(adapter: CaptureAdapter): CaptureSession["source"] {
  switch (adapter.name) {
    case "desktop":
      return "aci";
    case "extension":
      return "browser";
    default:
      return "upload";
  }
}

export function BrowserApiCaptureButton({ domain, disabled, onOpenSiteApis }: BrowserApiCaptureButtonProps) {
  const [phase, setPhase] = useState<CapturePhase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [adapterName, setAdapterName] = useState<string>("upload");
  const [menuPos, setMenuPos] = useState<MenuPosition>({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { ingestHarFile } = useApiCaptureStore();

  useEffect(() => {
    const adapter = getCaptureAdapter();
    setAdapterName(adapter.name);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const computeMenuPosition = useCallback(() => {
    if (!buttonRef.current || typeof window === "undefined") return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const menuWidth = 256; // w-64
    const spacing = 8;
    // Prefer right-aligned to the button; if it would overflow left viewport edge, align left.
    let right = viewportWidth - rect.right;
    if (rect.right - menuWidth < spacing) {
      right = viewportWidth - rect.left - menuWidth;
    }
    right = Math.max(spacing, right);
    const top = rect.bottom + spacing;
    setMenuPos({ top, right });
  }, []);

  const openSiteApisFallback = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("allternit:open-view", {
        detail: { viewType: "site-apis" },
      })
    );
  }, []);

  const openSiteApis = useCallback(() => {
    if (onOpenSiteApis) {
      onOpenSiteApis();
    } else {
      openSiteApisFallback();
    }
    window.dispatchEvent(
      new CustomEvent("allternit:agent-pane-tab", {
        detail: { tab: "site-apis" },
      })
    );
  }, [onOpenSiteApis, openSiteApisFallback]);

  const isLiveAdapter = adapterName !== "upload";

  const handleStartCapture = useCallback(async () => {
    setError(null);
    setPhase("starting");
    try {
      const adapter = getCaptureAdapter();
      if (adapter.name === "upload") {
        throw new Error("Live capture requires the desktop app or browser extension. Upload a HAR file instead.");
      }
      const result = await adapter.start({ domain });
      if (!result.sessionId) {
        throw new Error("Failed to start capture");
      }
      setSessionId(result.sessionId);
      setPhase("capturing");
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : "Capture start failed");
    }
  }, [domain]);

  const handleStopCapture = useCallback(async () => {
    if (!sessionId) return;
    setPhase("stopping");
    setError(null);
    try {
      const adapter = getCaptureAdapter();
      const result = await adapter.stop(sessionId);
      if (!result.har) {
        throw new Error("Failed to stop capture");
      }
      await ingestHarFile(result.har, adapterSource(adapter));
      setPhase("derived");
      setTimeout(() => {
        openSiteApis();
        setPhase("idle");
        setSessionId(null);
      }, 900);
    } catch (err) {
      setPhase("capturing");
      setError(err instanceof Error ? err.message : "Capture stop failed");
    }
  }, [sessionId, ingestHarFile, openSiteApis]);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/json" && !file.name.endsWith(".har")) {
        setError("Expected a HAR JSON file.");
        return;
      }
      setPhase("stopping");
      setError(null);
      try {
        const text = await file.text();
        await ingestHarFile(text, "upload");
        openSiteApis();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to ingest HAR");
      } finally {
        setPhase("idle");
      }
    },
    [ingestHarFile, openSiteApis]
  );

  const isCapturing = phase === "capturing";
  const isBusy = phase === "starting" || phase === "stopping";
  const derived = phase === "derived";

  const handleToggleMenu = useCallback(() => {
    setMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        // Compute on next frame after state update so the button is measured in its current layout.
        requestAnimationFrame(computeMenuPosition);
      }
      return next;
    });
  }, [computeMenuPosition]);

  const menu = menuOpen ? (
    <div
      ref={menuRef}
      data-testid="browser-api-capture-menu"
      className="fixed w-64 bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-lg shadow-lg z-[100] py-1 text-[14px]"
      style={{ top: menuPos.top, right: menuPos.right }}
    >
      <div className="px-3 py-2 border-b border-solid border-[var(--border-subtle)]">
        <div className="text-[13px] font-semibold text-[var(--text-primary)]">Site API Capture</div>
        <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
          {domain ? `Target: ${domain}` : "Record API calls from the active tab"}
        </div>
      </div>

      <div className="mx-3 mt-2 px-2 py-1 rounded-md bg-[var(--bg-tertiary)] text-[11px] text-[var(--text-secondary)] flex items-center gap-2">
        <span className="capitalize">{adapterName}</span>
        <span className="text-[var(--text-tertiary)]">capture source active</span>
      </div>

      {!isLiveAdapter && (
        <div className="mx-3 mt-2 p-2 rounded-md bg-[var(--status-warning)]/10 border border-solid border-[var(--status-warning)]/20 text-[11px] text-[var(--text-secondary)] flex items-start gap-2">
          <Warning size={14} className="shrink-0 mt-0.5 text-[var(--status-warning)]" />
          <span>
            Live capture requires the desktop app or browser extension. Upload a HAR file instead.
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setMenuOpen(false);
          void handleStartCapture();
        }}
        disabled={isBusy || !isLiveAdapter}
        className="flex items-center gap-2 w-full px-3 py-2 border-none bg-transparent cursor-pointer text-[var(--text-secondary)] text-[13px] text-left hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
      >
        <Record size={16} weight="fill" className="text-[var(--status-error)]" />
        Start live capture
      </button>

      <button
        type="button"
        onClick={() => {
          setMenuOpen(false);
          void handleStopCapture();
        }}
        disabled={!isCapturing || isBusy}
        className="flex items-center gap-2 w-full px-3 py-2 border-none bg-transparent cursor-pointer text-[var(--text-secondary)] text-[13px] text-left hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
      >
        <Square size={16} weight="fill" className="text-[var(--accent-primary)]" />
        Stop & derive API
      </button>

      <button
        type="button"
        onClick={() => {
          setMenuOpen(false);
          fileInputRef.current?.click();
        }}
        className="flex items-center gap-2 w-full px-3 py-2 border-none bg-transparent cursor-pointer text-[var(--text-secondary)] text-[13px] text-left hover:bg-[var(--bg-hover)] transition-colors"
      >
        <UploadSimple size={16} />
        Upload HAR file
      </button>

      <button
        type="button"
        onClick={() => {
          setMenuOpen(false);
          openSiteApis();
        }}
        className="flex items-center gap-2 w-full px-3 py-2 border-none bg-transparent cursor-pointer text-[var(--text-secondary)] text-[13px] text-left hover:bg-[var(--bg-hover)] transition-colors"
      >
        <ArrowSquareOut size={16} />
        Open Teach
      </button>

      {error && (
        <div className="mx-3 mb-2 p-2 rounded-md bg-[var(--status-error)]/10 border border-solid border-[var(--status-error)]/20 text-[11px] text-[var(--status-error)] flex items-start gap-2">
          <Warning size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept=".har,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.currentTarget.value = "";
        }}
      />
      <button
        ref={buttonRef}
        type="button"
        data-testid="browser-api-capture-btn"
        title={isCapturing ? "Stop API capture" : "Capture APIs from this site"}
        onClick={() => {
          if (isCapturing) {
            void handleStopCapture();
          } else {
            handleToggleMenu();
          }
        }}
        disabled={disabled || isBusy}
        className={cn(
          "p-1.5 rounded-full border-none bg-transparent flex items-center justify-center transition-colors",
          disabled || isBusy ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-[var(--ui-border-default)]",
          isCapturing || menuOpen ? "text-[var(--accent-primary)]" : "text-[var(--text-tertiary)]"
        )}
      >
        <div className="relative flex items-center justify-center">
          {isBusy ? (
            <Spinner size={16} className="animate-spin" />
          ) : isCapturing ? (
            <span className="relative flex items-center justify-center">
              <Record size={16} weight="fill" className="text-[var(--status-error)]" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--status-error)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--status-error)]" />
              </span>
            </span>
          ) : derived ? (
            <CheckCircle size={16} weight="fill" className="text-[var(--status-success)]" />
          ) : (
            <Plugs size={16} />
          )}
        </div>
      </button>

      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : menu}
    </div>
  );
}
