"use client";

import React, { useRef, useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { ExtensionSidepanelComposerProps } from "./ExtensionSidepanelShell.types";
import {
  BACKGROUND,
  TEXT,
  BORDER,
  RADIUS,
  MODE_COLORS,
  TYPOGRAPHY,
  ANIMATION,
} from "@/design/allternit.tokens";
import { MentionAutocomplete, useMention, MENTION_OPTIONS } from "./MentionAutocomplete";
import { QuickActionOverlay } from "./QuickActionOverlay";
import { useBrowserCapture } from "./useBrowserCapture";

const browser = MODE_COLORS.browser;

export function BrowserExtensionComposer({
  isRunning,
  value,
  placeholder,
  onValueChange,
  onSubmit,
  onStop,
}: ExtensionSidepanelComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showMention, setShowMention] = useState(false);
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const [showQuickAction, setShowQuickAction] = useState(false);
  const { capture, isCapturing, lastResult, clearResult } = useBrowserCapture();

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  // Detect URL in input
  const detectURL = useCallback((text: string): string | null => {
    const urlPattern = /(https?:\/\/[^\s]+)/i;
    const match = text.match(urlPattern);
    return match ? match[1] : null;
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart || 0;

    onValueChange(newValue);
    setCursorPosition(cursor);

    // Check for @mention
    const mention = useMention(newValue, cursor);
    setShowMention(mention.isActive);

    // Check for URL
    const url = detectURL(newValue);
    if (url && url !== detectedUrl) {
      setDetectedUrl(url);
      setShowQuickAction(true);
    } else if (!url) {
      setDetectedUrl(null);
      setShowQuickAction(false);
    }
  };

  const handleMentionSelect = (option: (typeof MENTION_OPTIONS)[0]) => {
    const mention = useMention(value, cursorPosition);
    const beforeMention = value.slice(0, mention.startIndex);
    const afterMention = value.slice(cursorPosition);
    const newValue = `${beforeMention}@${option.name} ${afterMention}`;

    onValueChange(newValue);
    setShowMention(false);

    // Trigger capture for capture-related mentions
    const url = detectURL(newValue);
    if (url && (option.name === "capture" || option.name === "quick" || option.name === "deep")) {
      capture(url, option.name === "deep" ? "deep" : "quick");
    }

    setTimeout(() => {
      textareaRef.current?.focus();
      const newCursorPos = beforeMention.length + option.name.length + 2;
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !showMention) {
        e.preventDefault();
        if (isRunning) {
          onStop();
        } else if (value.trim()) {
          onSubmit(value);
        }
      }
    },
    [isRunning, value, onSubmit, onStop, showMention]
  );

  const canSubmit = !isRunning && value.trim().length > 0;

  return (
    <div
      style={{
        padding: "12px 16px",
        borderTop: `1px solid ${BORDER.subtle}`,
        background: BACKGROUND.primary,
        position: "relative",
      }}
    >
      <AnimatePresence>
        {showQuickAction && detectedUrl && (
          <QuickActionOverlay
            url={detectedUrl}
            onQuick={() => {
              capture(detectedUrl, "quick");
              setShowQuickAction(false);
            }}
            onDeep={() => {
              capture(detectedUrl, "deep");
              setShowQuickAction(false);
            }}
            onChat={() => {
              setShowQuickAction(false);
            }}
            onClose={() => setShowQuickAction(false)}
          />
        )}
      </AnimatePresence>

      <MentionAutocomplete
        text={value}
        cursorPosition={cursorPosition}
        onSelect={handleMentionSelect}
        onClose={() => setShowMention(false)}
      />

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          background: BACKGROUND.secondary,
          border: `1px solid ${BORDER.subtle}`,
          borderRadius: RADIUS.lg,
          padding: "10px 14px",
          transition: ANIMATION.fast,
        }}
        onFocus={(e) => {
          const target = e.currentTarget;
          target.style.borderColor = browser.border;
          target.style.boxShadow = `0 0 0 3px ${browser.soft}`;
        }}
        onBlur={(e) => {
          const target = e.currentTarget;
          target.style.borderColor = BORDER.subtle;
          target.style.boxShadow = "none";
        }}
        tabIndex={-1}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: TYPOGRAPHY.size.sm,
            lineHeight: TYPOGRAPHY.lineHeight.normal,
            color: TEXT.primary,
            fontFamily: TYPOGRAPHY.fontFamily.sans,
            minHeight: 22,
            maxHeight: 120,
            padding: 0,
          }}
        />
        <button
          onClick={() => (isRunning ? onStop() : canSubmit ? onSubmit(value) : undefined)}
          style={{
            width: 32,
            height: 32,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: RADIUS.md,
            border: "none",
            cursor: canSubmit || isRunning ? "pointer" : "default",
            background: isRunning
              ? "rgba(248,113,113,0.15)"
              : canSubmit
              ? browser.accent
              : BACKGROUND.hover,
            color: isRunning
              ? "#f87171"
              : canSubmit
              ? BACKGROUND.primary
              : TEXT.tertiary,
            transition: ANIMATION.base,
            transform: canSubmit || isRunning ? "scale(1)" : "scale(0.95)",
          }}
          disabled={!canSubmit && !isRunning}
          aria-label={isRunning ? "Stop" : "Send"}
        >
          {isRunning ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 2L11 13" />
              <path d="m22 2-7 20-4-9-9-4Z" />
            </svg>
          )}
        </button>
      </div>
      {/* Capture result */}
      {lastResult && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: RADIUS.md,
            background: lastResult.success ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
            border: `1px solid ${lastResult.success ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: TYPOGRAPHY.size.xs, fontWeight: TYPOGRAPHY.weight.semibold, color: lastResult.success ? "#4ade80" : "#f87171" }}>
              {lastResult.success ? "Capture Complete" : "Capture Failed"}
            </span>
            <button onClick={clearResult} style={{ padding: 2, border: "none", background: "transparent", cursor: "pointer", color: TEXT.tertiary }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          {lastResult.success && lastResult.meta && (
            <div style={{ fontSize: TYPOGRAPHY.size.xs, color: TEXT.secondary }}>
              {lastResult.meta.title} · {lastResult.meta.colorCount} colors · {lastResult.meta.headingCount} headings · {lastResult.meta.imageCount} images · {lastResult.meta.linkCount} links
            </div>
          )}
          {lastResult.error && (
            <div style={{ fontSize: TYPOGRAPHY.size.xs, color: "#f87171" }}>{lastResult.error}</div>
          )}
        </div>
      )}
      {isCapturing && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${browser.accent}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
          <span style={{ fontSize: TYPOGRAPHY.size.xs, color: TEXT.secondary }}>Capturing page...</span>
        </div>
      )}
      <div
        style={{
          fontSize: 10,
          color: TEXT.tertiary,
          marginTop: 6,
          marginLeft: 4,
        }}
      >
        Tip: Paste a URL for capture options, or type @ for commands
      </div>
    </div>
  );
}
