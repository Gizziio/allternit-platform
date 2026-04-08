/**
 * BrowserToolCard — Specialized display for browser/computer-use tool calls
 *
 * Inspired by Comet's chat-stream treatment:
 *   - Web search → inline result list with titles + domains
 *   - Navigate  → browser-chrome URL bar (blocked = amber banner)
 *   - Screenshot → thumbnail with page info
 *   - Click/Type → compact action row with element description
 *   - Computer   → generic computer-use action row
 *
 * Fits into the GlassPill left-accent design language.
 */

"use client";

import React, { useState } from "react";
import {
  Globe,
  MagnifyingGlass,
  CursorClick,
  Keyboard,
  Camera,
  Monitor,
  ArrowRight,
  CaretDown,
  CaretRight,
  Warning,
  CheckCircle,
  Scroll,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import { MatrixLogo } from "@/components/ai-elements/MatrixLogo";
import { cn } from "@/lib/utils";

// ── helpers ──────────────────────────────────────────────────────────────────

function getHostname(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type BrowserToolKind =
  | "search"
  | "navigate"
  | "click"
  | "type"
  | "scroll"
  | "screenshot"
  | "computer"
  | "unknown";

export interface BrowserToolCardProps {
  toolName: string;
  state: "running" | "completed" | "error";
  input?: unknown;
  result?: unknown;
  error?: string;
}

// ── Tool-name → kind detection ────────────────────────────────────────────────

export function detectBrowserToolKind(toolName: string): BrowserToolKind {
  const n = toolName.toLowerCase();
  if (/search|brave_search|web_search|google|bing|ddg|tavily/.test(n)) return "search";
  if (/navigate|goto|open_url|visit|browse(?!r)/.test(n)) return "navigate";
  if (/click|tap/.test(n)) return "click";
  if (/type|keyboard|key_press|input/.test(n)) return "type";
  if (/scroll/.test(n)) return "scroll";
  if (/screenshot|capture|snapshot/.test(n)) return "screenshot";
  if (/computer|desktop|automation|pyauto/.test(n)) return "computer";
  return "unknown";
}

export function isBrowserTool(toolName: string): boolean {
  return detectBrowserToolKind(toolName) !== "unknown";
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Left accent bar — same width/style as GlassPill */
function AccentBar({ state }: { state: "running" | "completed" | "error" }) {
  const color =
    state === "running"   ? "rgba(212,176,140,0.55)" :
    state === "completed" ? "rgba(74,222,128,0.4)"   :
                            "rgba(248,113,113,0.5)";
  return (
    <div style={{
      position: "absolute",
      left: 0,
      top: 4,
      bottom: 4,
      width: 2,
      borderRadius: 2,
      background: color,
      transition: "background 0.3s",
    }} />
  );
}

/** Spinning/done state indicator */
function StateIndicator({ state }: { state: "running" | "completed" | "error" }) {
  if (state === "running") return <MatrixLogo state="thinking" size={10} />;
  if (state === "completed") {
    return <CheckCircle style={{ width: 12, height: 12, color: "rgba(74,222,128,0.7)", flexShrink: 0 }} />;
  }
  return null;
}

/** Search result item — mirrors the Comet URL card */
function SearchResultItem({ result, i }: { result: Record<string, unknown>; i: number }) {
  const title   = typeof result.title   === "string" ? result.title   : null;
  const url     = typeof result.url     === "string" ? result.url     : null;
  const snippet = typeof result.snippet === "string" ? result.snippet :
                  typeof result.content === "string" ? result.content : null;
  const host = getHostname(url ?? undefined);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "6px 0",
        borderTop: i > 0 ? "1px solid rgba(255,255,255,0.045)" : "none",
      }}
    >
      {/* Dot indicator */}
      <div style={{
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: "rgba(212,176,140,0.45)",
        marginTop: 6,
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div style={{
            fontSize: 12,
            fontWeight: 500,
            color: "rgba(236,236,236,0.82)",
            lineHeight: 1.5,
            marginBottom: 1,
          }}>
            {title}
          </div>
        )}
        {host && (
          <div style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.32)",
            fontFamily: "monospace",
          }}>
            {host}
          </div>
        )}
        {snippet && (
          <div style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.42)",
            lineHeight: 1.55,
            marginTop: 2,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}>
            {snippet}
          </div>
        )}
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0, marginTop: 3 }}
          onClick={(e) => e.stopPropagation()}
        >
          <ArrowSquareOut style={{ width: 10, height: 10 }} />
        </a>
      )}
    </div>
  );
}

// ── Main card renderers by kind ───────────────────────────────────────────────

function SearchCard({ state, input, result }: BrowserToolCardProps) {
  const [open, setOpen] = useState(false);
  const inp = input as Record<string, unknown> | undefined;
  const query = typeof inp?.query === "string" ? inp.query :
                typeof inp?.q     === "string" ? inp.q     :
                typeof inp?.input === "string" ? inp.input : null;

  // Normalise result into an array
  const raw   = result as Record<string, unknown> | unknown[] | null | undefined;
  const items: Record<string, unknown>[] = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : (raw as Record<string, unknown>)?.results && Array.isArray((raw as any).results)
      ? ((raw as any).results as Record<string, unknown>[])
      : [];

  const count = items.length;
  const hasResults = count > 0;
  const canOpen = state === "completed" && hasResults;

  return (
    <div
      style={{ position: "relative", padding: "6px 10px 6px 16px", cursor: canOpen ? "pointer" : "default" }}
      onClick={() => canOpen && setOpen((o) => !o)}
    >
      <AccentBar state={state} />

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <MagnifyingGlass style={{ width: 12, height: 12, color: "rgba(212,176,140,0.55)", flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(236,236,236,0.72)", flex: 1, minWidth: 0 }}>
          {query
            ? <>Web search — <em style={{ fontStyle: "normal", color: "rgba(236,236,236,0.88)" }}>"{query}"</em></>
            : "Web search"}
        </span>
        {state === "running" && <StateIndicator state="running" />}
        {state === "completed" && hasResults && (
          <span style={{ fontSize: 10, color: "rgba(74,222,128,0.55)", fontWeight: 600, letterSpacing: "0.04em" }}>
            {count} result{count !== 1 ? "s" : ""}
          </span>
        )}
        {canOpen && (
          open
            ? <CaretDown  style={{ width: 12, height: 12, color: "rgba(255,255,255,0.25)" }} />
            : <CaretRight style={{ width: 12, height: 12, color: "rgba(255,255,255,0.25)" }} />
        )}
      </div>

      {/* Expanded results */}
      {open && hasResults && (
        <div style={{ marginTop: 8, marginLeft: 19 }}>
          {items.slice(0, 5).map((item, i) => (
            <SearchResultItem key={i} result={item} i={i} />
          ))}
          {count > 5 && (
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
              +{count - 5} more results
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NavigateCard({ state, input, error }: BrowserToolCardProps) {
  const inp = input as Record<string, unknown> | undefined;
  const url = typeof inp?.url   === "string" ? inp.url   :
              typeof inp?.href  === "string" ? inp.href  :
              typeof input      === "string" ? input     : null;
  const host = getHostname(url ?? undefined);
  const isBlocked = state === "error" || (typeof error === "string" && error.length > 0);

  return (
    <div style={{ position: "relative", padding: "6px 10px 6px 16px" }}>
      <AccentBar state={isBlocked ? "error" : state} />

      {/* Browser chrome row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "5px 10px",
        borderRadius: 8,
        background: isBlocked ? "rgba(248,113,113,0.07)" : "rgba(255,255,255,0.035)",
        border: `1px solid ${isBlocked ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.06)"}`,
      }}>
        {/* Traffic lights */}
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(251,113,113,0.5)", flexShrink: 0 }} />
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(251,191,36,0.4)", flexShrink: 0 }} />
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(52,211,153,0.4)", flexShrink: 0 }} />

        <Globe style={{ width: 10, height: 10, color: "rgba(255,255,255,0.3)", flexShrink: 0, marginLeft: 4 }} />
        <span style={{
          flex: 1,
          fontSize: 11,
          color: isBlocked ? "rgba(248,113,113,0.7)" : "rgba(255,255,255,0.5)",
          fontFamily: "monospace",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {url ?? "—"}
        </span>
        {state === "running" && <StateIndicator state="running" />}
        {state === "completed" && !isBlocked && <StateIndicator state="completed" />}
      </div>

      {/* Blocked banner */}
      {isBlocked && error && (
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          marginTop: 5,
          marginLeft: 2,
          fontSize: 11,
          color: "rgba(248,113,113,0.65)",
          lineHeight: 1.5,
        }}>
          <Warning style={{ width: 11, height: 11, flexShrink: 0, marginTop: 1 }} />
          <span>{error.length > 120 ? error.slice(0, 120) + "…" : error}</span>
        </div>
      )}
    </div>
  );
}

function ClickCard({ state, input }: BrowserToolCardProps) {
  const inp = input as Record<string, unknown> | undefined;
  const selector  = typeof inp?.selector  === "string" ? inp.selector  : null;
  const element   = typeof inp?.element   === "string" ? inp.element   : null;
  const text      = typeof inp?.text      === "string" ? inp.text      : null;
  const coordinate = inp?.coordinate;
  const desc = selector ?? element ?? text
    ?? (coordinate ? `(${JSON.stringify(coordinate)})` : null)
    ?? "element";

  return (
    <div style={{ position: "relative", padding: "6px 10px 6px 16px" }}>
      <AccentBar state={state} />
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <CursorClick style={{ width: 11, height: 11, color: "rgba(212,176,140,0.45)", flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "rgba(236,236,236,0.66)" }}>
          Click{" "}
          <code style={{
            fontSize: 11,
            background: "rgba(255,255,255,0.07)",
            borderRadius: 4,
            padding: "1px 5px",
            color: "rgba(236,236,236,0.8)",
            fontFamily: "monospace",
          }}>
            {desc.length > 60 ? desc.slice(0, 60) + "…" : desc}
          </code>
        </span>
        <StateIndicator state={state} />
      </div>
    </div>
  );
}

function TypeCard({ state, input }: BrowserToolCardProps) {
  const inp = input as Record<string, unknown> | undefined;
  const text = typeof inp?.text  === "string" ? inp.text  :
               typeof inp?.value === "string" ? inp.value :
               typeof input      === "string" ? input     : null;

  return (
    <div style={{ position: "relative", padding: "6px 10px 6px 16px" }}>
      <AccentBar state={state} />
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Keyboard style={{ width: 11, height: 11, color: "rgba(212,176,140,0.45)", flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "rgba(236,236,236,0.66)" }}>
          Type{text && (
            <>{" "}<code style={{
              fontSize: 11,
              background: "rgba(255,255,255,0.07)",
              borderRadius: 4,
              padding: "1px 5px",
              color: "rgba(236,236,236,0.8)",
              fontFamily: "monospace",
            }}>
              {text.length > 60 ? text.slice(0, 60) + "…" : text}
            </code></>
          )}
        </span>
        <StateIndicator state={state} />
      </div>
    </div>
  );
}

function ScrollCard({ state, input }: BrowserToolCardProps) {
  const inp = input as Record<string, unknown> | undefined;
  const dir = typeof inp?.direction === "string" ? inp.direction : null;
  const amt = inp?.amount !== undefined ? inp.amount : null;
  const desc = [dir, amt !== null ? `${amt}px` : null].filter(Boolean).join(" ") || null;

  return (
    <div style={{ position: "relative", padding: "6px 10px 6px 16px" }}>
      <AccentBar state={state} />
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Scroll style={{ width: 11, height: 11, color: "rgba(212,176,140,0.45)", flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "rgba(236,236,236,0.66)" }}>
          Scroll{desc ? ` ${desc}` : ""}
        </span>
        <StateIndicator state={state} />
      </div>
    </div>
  );
}

function ScreenshotCard({ state, result }: BrowserToolCardProps) {
  // result might contain a base64 image or url
  const res = result as Record<string, unknown> | string | null | undefined;
  const imgUrl =
    typeof res === "string" && res.startsWith("data:image") ? res :
    typeof res === "object" && res !== null && typeof (res as any).image === "string"
      ? (res as any).image
      : null;
  const pageTitle = typeof res === "object" && res !== null ? (res as any).title ?? null : null;

  return (
    <div style={{ position: "relative", padding: "6px 10px 6px 16px" }}>
      <AccentBar state={state} />
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: imgUrl ? 8 : 0 }}>
        <Camera style={{ width: 11, height: 11, color: "rgba(212,176,140,0.45)", flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "rgba(236,236,236,0.66)" }}>
          Screenshot{pageTitle ? ` — ${pageTitle}` : ""}
        </span>
        <StateIndicator state={state} />
      </div>
      {imgUrl && (
        <div style={{
          marginLeft: 19,
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)",
          maxWidth: 360,
        }}>
          <img
            src={imgUrl}
            alt="screenshot"
            style={{ width: "100%", display: "block", opacity: 0.88 }}
          />
        </div>
      )}
    </div>
  );
}

function ComputerCard({ toolName, state, input }: BrowserToolCardProps) {
  const inp = input as Record<string, unknown> | undefined;
  const action  = typeof inp?.action  === "string" ? inp.action  : null;
  const command = typeof inp?.command === "string" ? inp.command : null;
  const desc = action ?? command ?? toolName;

  return (
    <div style={{ position: "relative", padding: "6px 10px 6px 16px" }}>
      <AccentBar state={state} />
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Monitor style={{ width: 11, height: 11, color: "rgba(212,176,140,0.45)", flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "rgba(236,236,236,0.66)" }}>
          {desc.length > 70 ? desc.slice(0, 70) + "…" : desc}
        </span>
        <StateIndicator state={state} />
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function BrowserToolCard(props: BrowserToolCardProps) {
  const kind = detectBrowserToolKind(props.toolName);

  const card =
    kind === "search"     ? <SearchCard     {...props} /> :
    kind === "navigate"   ? <NavigateCard   {...props} /> :
    kind === "click"      ? <ClickCard      {...props} /> :
    kind === "type"       ? <TypeCard       {...props} /> :
    kind === "scroll"     ? <ScrollCard     {...props} /> :
    kind === "screenshot" ? <ScreenshotCard {...props} /> :
                            <ComputerCard   {...props} />;

  return (
    <div style={{
      marginBottom: 2,
      borderRadius: 8,
      transition: "background 0.15s",
    }}>
      {card}
    </div>
  );
}
