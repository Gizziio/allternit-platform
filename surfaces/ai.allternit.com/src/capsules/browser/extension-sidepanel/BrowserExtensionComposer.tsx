"use client";

import React, { useRef, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CheckCircle, CircleDashed, ListChecks, PaperPlaneRight, SpinnerGap, Square } from "@phosphor-icons/react";
import { MatrixLogo } from "@/components/ai-elements/MatrixLogo";
import { cn } from "@/lib/utils";
import type { ExtensionSidepanelComposerProps } from "./ExtensionSidepanelShell.types";
import {
  RADIUS,
  MODE_COLORS,
  TYPOGRAPHY,
  ANIMATION,
} from "@/design/allternit.tokens";
import { MentionAutocomplete, getMention, MENTION_OPTIONS } from "./MentionAutocomplete";
import { QuickActionOverlay } from "./QuickActionOverlay";
import { useBrowserCapture } from "./useBrowserCapture";
import { useBrowserAgentStore } from "../browserAgent.store";
import type { PageAgentActivity, PageAgentHistoricalEvent } from "../browserAgent.store";

const browser = MODE_COLORS.browser;

// ============================================================================
// ACI todo top deck — tray tucked behind the composer card, mirroring the
// chat/cowork top-deck pattern (z-0 tray + negative margin, card sits on top).
// The agent's step goals from the ACI store are listed as todos.
// ============================================================================

interface AciTodo {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

function activityTodoContent(activity: PageAgentActivity): string | null {
  switch (activity.type) {
    case 'thinking':
      return 'Thinking…';
    case 'executing':
      return `Running ${activity.tool}`;
    case 'retrying':
      return `Retrying (${activity.attempt}/${activity.maxAttempts})`;
    default:
      return null; // 'executed' / 'error' are already surfaced in the history feed
  }
}

function buildAciTodos(
  history: PageAgentHistoricalEvent[],
  activity: PageAgentActivity | null,
): AciTodo[] {
  const todos: AciTodo[] = [];
  history.forEach((event, index) => {
    if (event.type !== 'step') return;
    todos.push({
      id: `step-${event.stepIndex ?? index}`,
      content: event.reflection?.next_goal || event.action?.name || `Step ${(event.stepIndex ?? index) + 1}`,
      status: 'completed',
    });
  });
  if (activity) {
    const content = activityTodoContent(activity);
    if (content) todos.push({ id: 'current-activity', content, status: 'in_progress' });
  }
  return todos.slice(-6);
}

function AciTodoTopDeck({ todos }: { todos: AciTodo[] }) {
  const done = todos.filter((t) => t.status === 'completed').length;
  return (
    <div className="relative z-0 w-full max-h-[132px] -mb-3 box-border overflow-y-auto bg-white/5 backdrop-blur-md border-t border-r border-l border-white/10 rounded-t-2xl px-4 pt-2.5 pb-5 flex flex-col gap-1.5 animate-deck-rise">
      <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-foreground">
        <ListChecks size={12} className="text-accent" />
        <span>Todos</span>
        <span className="ml-auto font-bold normal-case tracking-normal">{done}/{todos.length}</span>
      </div>
      {todos.map((todo) => (
        <div key={todo.id} className="flex items-center gap-2 min-w-0">
          {todo.status === 'completed' ? (
            <CheckCircle size={13} weight="fill" className="shrink-0" style={{ color: 'var(--status-success)' }} />
          ) : todo.status === 'in_progress' ? (
            <SpinnerGap size={13} className="shrink-0 animate-spin text-accent" />
          ) : (
            <CircleDashed size={13} className="shrink-0 text-muted-foreground" />
          )}
          <span className={`truncate text-xs text-foreground ${todo.status === 'completed' ? 'line-through opacity-70' : ''}`}>
            {todo.content}
          </span>
        </div>
      ))}
    </div>
  );
}

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

  // ACI session state — feeds the todo top deck above the composer card
  const pageAgentHistory = useBrowserAgentStore((s) => s.pageAgentHistory);
  const pageAgentActivity = useBrowserAgentStore((s) => s.pageAgentActivity);
  const aciTodos = useMemo(
    () => buildAciTodos(pageAgentHistory, pageAgentActivity),
    [pageAgentHistory, pageAgentActivity],
  );

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
    const mention = getMention(newValue, cursor);
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
    const mention = getMention(value, cursorPosition);
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
        padding: 0,
        background: "transparent",
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

      {aciTodos.length > 0 && <AciTodoTopDeck todos={aciTodos} />}

      <div
        className="relative z-10 flex items-end w-full rounded-2xl border border-composer-glass-border bg-composer-glass-bg backdrop-blur-xl backdrop-saturate-150 shadow-xl px-3 py-[9px]"
        style={{
          gap: 10,
          transition: ANIMATION.fast,
        }}
        onFocus={(e) => {
          const target = e.currentTarget;
          target.style.borderColor = browser.border;
          target.style.boxShadow = `0 0 0 3px ${browser.soft}`;
        }}
        onBlur={(e) => {
          const target = e.currentTarget;
          target.style.borderColor = "";
          target.style.boxShadow = "";
        }}
        tabIndex={-1}
      >
        <div aria-hidden="true" style={{ alignSelf: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MatrixLogo state="idle" size={16} />
        </div>
        <textarea
          className="focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
          aria-label={placeholder}
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
            fontSize: TYPOGRAPHY.size.sm,
            lineHeight: TYPOGRAPHY.lineHeight.normal,
            color: "var(--shell-item-fg)",
            fontFamily: TYPOGRAPHY.fontFamily.sans,
            minHeight: 22,
            maxHeight: 120,
            padding: 0,
          }}
        />
        <button
          type="button"
          onClick={() => (isRunning ? onStop() : canSubmit ? onSubmit(value) : undefined)}
          className={cn(
            "shrink-0 flex items-center justify-center rounded-full border-none transition-all w-8 h-8",
            isRunning
              ? "bg-red-500 text-white hover:bg-red-600 cursor-pointer scale-100"
              : canSubmit
              ? "bg-white text-black hover:bg-gray-100 cursor-pointer shadow-sm scale-100"
              : "bg-transparent text-[var(--ui-text-muted)] cursor-default scale-95"
          )}
          disabled={!canSubmit && !isRunning}
          aria-label={isRunning ? "Stop" : "Send"}
        >
          {isRunning ? (
            <Square size={14} weight="fill" />
          ) : (
            <PaperPlaneRight size={16} weight="bold" />
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
            <button type="button" onClick={clearResult} style={{ padding: 2, border: "none", background: "transparent", cursor: "pointer", color: "var(--ui-text-muted)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          {lastResult.success && lastResult.meta && (
            <div style={{ fontSize: TYPOGRAPHY.size.xs, color: "var(--ui-text-secondary)" }}>
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
          <span style={{ fontSize: TYPOGRAPHY.size.xs, color: "var(--ui-text-secondary)" }}>Capturing page…</span>
        </div>
      )}
      <div
        style={{
          fontSize: 12,
          color: "var(--ui-text-muted)",
          marginTop: 6,
          marginLeft: 4,
        }}
      >
        Tip: Paste a URL for capture options, or type @ for commands
      </div>
    </div>
  );
}
