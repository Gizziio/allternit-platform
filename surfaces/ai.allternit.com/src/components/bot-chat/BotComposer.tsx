"use client";

/**
 * One-handed composer (Phase 1B).
 *
 * Pure props, zero fetching. Sibling-of-scroll: the parent positions this
 * bar; the component renders the bar, its overlays, and nothing else.
 *
 * - Vertically growing textarea (1–5 lines); Enter/Return sends, Shift+Enter
 *   inserts a newline (desktop).
 * - Predictive action chips when idle (no draft, not busy): tap sends.
 * - `/` as the first character opens the routines HUD; `prompt` commands
 *   expand into the full natural-language draft (no auto-send), `navigate`
 *   commands delegate to the parent.
 * - `+` rotates into × and opens a bottom-anchored action sheet (never a
 *   centered modal). Danger rows render red — 1C puts Interrupt here.
 * - Dictation via webkitSpeechRecognition/SpeechRecognition, guarded
 *   everywhere; partial transcripts replace against the frozen draft base.
 *   Absent API → disabled mic with a tooltip, no error theater.
 *
 * @module bot-chat/BotComposer
 */

import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { Microphone, PaperPlaneRight, Plus, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { vibrateSend } from "./haptics";

// ---------------------------------------------------------------------------
// SpeechRecognition — non-standard API, minimal local declaration.
// ---------------------------------------------------------------------------

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function speechRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | SpeechRecognitionCtor
    | undefined;
}

// ---------------------------------------------------------------------------
// Prop types
// ---------------------------------------------------------------------------

export interface BotComposerSuggestion {
  id: string;
  label: string;
  /** Full natural-language prompt; falls back to `label`. */
  prompt?: string;
}

export interface BotComposerCommand {
  id: string;
  title: string;
  description: string;
  accentColor?: string;
  action: "navigate" | "prompt";
  /** Full prompt expanded into the input for `action: "prompt"`. */
  prompt?: string;
}

export interface BotComposerAction {
  id: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface BotComposerProps {
  onSend: (text: string) => void;
  onNavigate?: (commandId: string) => void;
  suggestions?: BotComposerSuggestion[];
  commands?: BotComposerCommand[];
  actions?: BotComposerAction[];
  /** Status line above the bar, e.g. "Sending…" or an error string. */
  status?: string;
  placeholder?: string;
  busy?: boolean;
  className?: string;
}

const MAX_LINES = 5;

const SHEET_CSS = `
@keyframes bot-chat-sheet-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

function joinText(base: string, addition: string): string {
  const a = base.trim();
  const b = addition.trim();
  if (!a) return b;
  if (!b) return a;
  return `${a} ${b}`;
}

// ---------------------------------------------------------------------------
// PredictiveActionChips
// ---------------------------------------------------------------------------

export interface PredictiveActionChipsProps {
  suggestions: BotComposerSuggestion[];
  onPick: (suggestion: BotComposerSuggestion) => void;
}

export function PredictiveActionChips({ suggestions, onPick }: PredictiveActionChipsProps) {
  if (suggestions.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {suggestions.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onPick(s)}
          className="min-h-[44px] shrink-0 rounded-full border border-white/10 bg-[var(--bg-elevated)]/50 px-4 text-xs font-semibold text-[var(--text-secondary,#a1a1aa)]"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SlashCommandHud
// ---------------------------------------------------------------------------

export interface SlashCommandHudProps {
  query: string;
  commands: BotComposerCommand[];
  onSelect: (command: BotComposerCommand) => void;
  onClose: () => void;
}

export function SlashCommandHud({ query, commands, onSelect, onClose }: SlashCommandHudProps) {
  const q = query.trim().toLowerCase();
  const filtered = commands.filter((c) => c.title.toLowerCase().includes(q));

  return (
    <div className="mb-2 max-h-[40vh] overflow-y-auto rounded-2xl border border-white/10 bg-[var(--bg-elevated,#1c1c1f)] p-2 shadow-xl">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          Routines
        </span>
        <button
          type="button"
          aria-label="Close routines"
          onClick={onClose}
          className="flex size-[44px] items-center justify-center text-[var(--text-tertiary)]"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      {filtered.length === 0 ? (
        <div className="px-2 py-3 text-xs text-[var(--text-tertiary)]">
          No routines match.
        </div>
      ) : (
        filtered.map((command) => (
          <button
            key={command.id}
            type="button"
            onClick={() => onSelect(command)}
            className="flex w-full items-start gap-2.5 rounded-xl p-3 text-left hover:bg-white/5"
          >
            <span
              className="mt-1 size-2 shrink-0 rounded-full"
              style={{ backgroundColor: command.accentColor ?? "var(--accent-primary)" }}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--text-primary,#e5e5e5)]">
                {command.title}
              </span>
              <span className="mt-0.5 block truncate text-xs text-[var(--text-tertiary)]">
                {command.description}
              </span>
            </span>
          </button>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BotComposer
// ---------------------------------------------------------------------------

export function BotComposer({
  onSend,
  onNavigate,
  suggestions,
  commands,
  actions,
  status,
  placeholder = "Message",
  busy = false,
  className,
}: BotComposerProps) {
  const [draft, setDraft] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [srAvailable] = useState(() => speechRecognitionCtor() !== undefined);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  /** Draft text frozen when dictation started — partials replace against it. */
  const frozenBaseRef = useRef("");
  const srCtor = useRef(speechRecognitionCtor());

  const hudOpen = draft.startsWith("/") && (commands?.length ?? 0) > 0;

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const max = lineHeight * MAX_LINES;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  };

  // Re-measure on every draft change (also covers the post-send clear).
  useEffect(resizeTextarea);

  const stopDictation = (mode: "stop" | "abort") => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      try {
        if (mode === "abort") rec.abort();
        else rec.stop();
      } catch {
        // Already stopped.
      }
    }
    setListening(false);
  };

  // Abort a live recognition if the composer unmounts mid-dictation.
  useEffect(() => () => stopDictation("abort"), []);

  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    stopDictation("abort");
    vibrateSend();
    onSend(text);
    setDraft("");
    setSheetOpen(false);
  };

  const startDictation = () => {
    const Ctor = srCtor.current;
    if (!Ctor || listening) return;
    try {
      const rec = new Ctor();
      rec.lang = "en-US";
      rec.continuous = false;
      rec.interimResults = true;
      frozenBaseRef.current = draft;
      rec.onresult = (event) => {
        let interim = "";
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result.isFinal) finalText += result[0].transcript;
          else interim += result[0].transcript;
        }
        if (finalText) {
          frozenBaseRef.current = joinText(frozenBaseRef.current, finalText);
        }
        // Replace, never stack: frozen base + latest partial only.
        setDraft(joinText(frozenBaseRef.current, interim));
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const toggleDictation = () => {
    if (listening) stopDictation("stop");
    else startDictation();
  };

  const pickSuggestion = (suggestion: BotComposerSuggestion) => {
    vibrateSend();
    onSend(suggestion.prompt ?? suggestion.label);
  };

  const selectCommand = (command: BotComposerCommand) => {
    if (command.action === "prompt") {
      setDraft(command.prompt ?? "");
      textareaRef.current?.focus();
    } else {
      onNavigate?.(command.id);
      setDraft("");
    }
  };

  const canSend = draft.trim().length > 0 && !busy;

  return (
    <div className={cn("relative flex flex-col gap-1.5", className)}>
      <style>{SHEET_CSS}</style>

      {status && (
        <div role="status" className="px-1 text-xs text-[var(--text-tertiary)]">
          {status}
        </div>
      )}

      {hudOpen && (
        <SlashCommandHud
          query={draft.slice(1)}
          commands={commands ?? []}
          onSelect={selectCommand}
          onClose={() => setDraft("")}
        />
      )}

      {draft === "" && !busy && suggestions && (
        <PredictiveActionChips suggestions={suggestions} onPick={pickSuggestion} />
      )}

      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            aria-hidden="true"
            onClick={() => setSheetOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Actions"
            className="absolute inset-x-0 bottom-full z-50 mb-2 max-h-[50vh] overflow-y-auto rounded-2xl border border-white/10 bg-[var(--bg-elevated,#1c1c1f)] p-2 shadow-xl motion-safe:animate-[bot-chat-sheet-up_0.18s_ease-out]"
          >
            {(actions ?? []).map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={action.disabled}
                onClick={() => {
                  setSheetOpen(false);
                  action.onSelect();
                }}
                className={cn(
                  "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/5",
                  action.disabled && "pointer-events-none opacity-40",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full",
                    action.danger
                      ? "bg-red-500/10 text-red-400"
                      : "bg-white/5 text-[var(--text-secondary,#a1a1aa)]",
                  )}
                >
                  {action.icon}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm font-semibold",
                      action.danger
                        ? "text-red-400"
                        : "text-[var(--text-primary,#e5e5e5)]",
                    )}
                  >
                    {action.title}
                  </span>
                  <span className="block truncate text-xs text-[var(--text-tertiary)]">
                    {action.subtitle}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex items-end gap-1.5 rounded-2xl border border-white/10 bg-[var(--bg-elevated)]/60 p-1.5 backdrop-blur">
        {(actions?.length ?? 0) > 0 && (
          <button
            type="button"
            aria-label={sheetOpen ? "Close actions" : "Open actions"}
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen((v) => !v)}
            className="flex size-[44px] shrink-0 items-center justify-center rounded-full text-[var(--text-secondary,#a1a1aa)]"
          >
            <Plus
              className={cn("size-5 transition-transform duration-150", sheetOpen && "rotate-45")}
              aria-hidden="true"
            />
          </button>
        )}

        <textarea
          ref={textareaRef}
          value={draft}
          rows={1}
          data-max-rows={MAX_LINES}
          placeholder={listening ? "Listening…" : placeholder}
          aria-label="Message input"
          className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-[var(--text-primary,#e5e5e5)] outline-none placeholder:text-[var(--text-tertiary)]"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            } else if (e.key === "Escape") {
              if (sheetOpen) setSheetOpen(false);
              else if (hudOpen) setDraft("");
            }
          }}
        />

        <button
          type="button"
          onClick={toggleDictation}
          disabled={!srAvailable}
          title={srAvailable ? "Dictate" : "Dictation isn't available in this browser"}
          aria-label="Dictate"
          aria-pressed={listening}
          className={cn(
            "flex size-[44px] shrink-0 items-center justify-center rounded-full text-[var(--text-secondary,#a1a1aa)]",
            listening && "text-red-400 motion-safe:animate-pulse",
            !srAvailable && "opacity-40",
          )}
        >
          <Microphone className="size-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          aria-label="Send"
          className={cn(
            "flex size-[44px] shrink-0 items-center justify-center rounded-full transition-colors duration-150",
            canSend
              ? "bg-[var(--accent-primary)] text-white"
              : "bg-transparent text-[var(--text-tertiary)] opacity-50",
          )}
        >
          <PaperPlaneRight className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
