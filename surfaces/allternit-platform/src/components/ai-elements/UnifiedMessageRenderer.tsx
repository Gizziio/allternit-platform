/**
 * Unified Message Renderer
 * 
 * Renders AI Elements based on stream content type.
 * Used across ALL modes: Chat, Cowork, Agent, Runner, Code
 * 
 * Core principle: Elements appear based on DATA, not mode.
 * All modes share the same rendering surface.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ExtendedUIPart } from '@/lib/ai/rust-stream-adapter-extended';
import { parseStructuredContent } from '@/lib/ai/rust-stream-adapter-extended';
import { useBrowserStore } from '@/capsules/browser/browser.store';
import { useNav } from '@/nav/useNav';
import { ThoughtTrace, coerceThoughtSteps, parseThoughtSteps } from './thought-trace';
import { injectWebPreviewParts } from './browser-preview-utils';
import { GlassPill, TerminalPill } from './glass-pill';
import { ArtifactCard } from './artifact-panel';
import { McpAppFrame } from './McpAppFrame';
import { AllternitOpenUIRenderer } from '@/lib/openui/AllternitOpenUIRenderer';
import type { SelectedArtifact, ArtifactKind } from './artifact-panel';
import type { ViewMode } from '@/hooks/useViewMode';

// Core AI Elements
import { Markdown } from './markdown';
import { Shimmer } from './shimmer';
import { CodeBlock } from './code-block';
import {
  Warning,
  CheckCircle,
  XCircle,
  Clock,
  Check,
  X,
  Globe,
  Link,
  ArrowSquareOut,
  CaretRight,
} from '@phosphor-icons/react';

interface UnifiedMessageRendererProps {
  parts: ExtendedUIPart[];
  isStreaming?: boolean;
  className?: string;
  onSelectArtifact?: (artifact: SelectedArtifact) => void;
  selectedArtifactTitle?: string;
  /** Controls how much detail is shown. Default: 'normal' */
  viewMode?: ViewMode;
}

/**
 * Unified renderer - works in ALL modes
 * Chat, Cowork, Agent, Runner, Code - all use this
 */
export function UnifiedMessageRenderer({
  parts,
  isStreaming,
  className,
  onSelectArtifact,
  selectedArtifactTitle,
  viewMode = 'normal',
}: UnifiedMessageRendererProps) {
  // Parse text parts for embedded structure
  const parsedParts = React.useMemo(() => {
    const result: ExtendedUIPart[] = [];

    for (const part of parts) {
      if (part.type === 'text') {
        const subParts = parseStructuredContent(part.text);
        result.push(...subParts);
      } else {
        result.push(part);
      }
    }

    return injectWebPreviewParts(result);
  }, [parts]);

  if (!parsedParts || parsedParts.length === 0) {
    return isStreaming ? <Shimmer className="h-4 w-3/4" /> : null;
  }

  // Summary mode: only show text parts, skip reasoning and tool calls
  const visibleParts = React.useMemo(() => {
    if (viewMode === 'summary') {
      return parsedParts.filter(p => p.type === 'text' || p.type === 'error');
    }
    return parsedParts;
  }, [parsedParts, viewMode]);

  // Collect source-document parts for the footer strip (P4)
  const sourceParts = parsedParts.filter(p => p.type === 'source-document') as Array<Extract<ExtendedUIPart, { type: 'source-document' }>>;

  return (
    <div className={cn("space-y-4", className)}>
      {visibleParts.map((part, idx) => (
        <PartRenderer
          key={`${part.type}-${idx}`}
          part={part}
          isLast={idx === visibleParts.length - 1}
          isStreaming={isStreaming}
          onSelectArtifact={onSelectArtifact}
          selectedArtifactTitle={selectedArtifactTitle}
          viewMode={viewMode}
        />
      ))}
      {/* Sources footer — compact citation strip when web results are present */}
      {!isStreaming && sourceParts.length > 0 && viewMode !== 'summary' && (
        <SourcesFooter sources={sourceParts} />
      )}
    </div>
  );
}

function formatUrlHost(url?: string): string | null {
  if (!url) return null;

  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

function openUrlInBrowserPanel(url: string, title?: string): void {
  useNav.getState().dispatch({ type: 'OPEN_VIEW', viewType: 'browserview' });
  useBrowserStore.getState().addTab(url, title);
}

function SourceDocumentCard({ part }: { part: Extract<ExtendedUIPart, { type: 'source-document' }> }) {
  const sourceUrl = 'url' in part && typeof part.url === 'string' ? part.url : undefined;
  const host = formatUrlHost(sourceUrl);

  const content = (
    <div className="rounded-2xl border border-sky-400/15 bg-sky-500/[0.06] px-4 py-3 transition-colors hover:bg-sky-500/[0.09]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-sky-300/20 bg-sky-500/10">
          <Globe className="h-4 w-4 text-sky-200" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100/70">
            Source
          </div>
          <div className="mt-1 text-sm font-medium leading-6 text-foreground break-words">
            {part.title}
          </div>
          {sourceUrl && (
            <div className="mt-1 text-xs leading-5 text-muted-foreground break-all">
              {host ?? sourceUrl}
            </div>
          )}
        </div>
        {sourceUrl && <ArrowSquareOut className="mt-1 h-4 w-4 flex-shrink-0 text-sky-200/70" />}
      </div>
    </div>
  );

  if (!sourceUrl) {
    return <div id={`source-${part.sourceId}`}>{content}</div>;
  }

  return (
    <div id={`source-${part.sourceId}`}>
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {content}
      </a>
    </div>
  );
}

function BrowserPreviewCard({ part }: { part: Extract<ExtendedUIPart, { type: 'web-preview' }> }) {
  const host = formatUrlHost(part.url);

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#D4B08C]/20 bg-[#17110A]/45">
      <div className="flex items-center gap-2 border-b border-white/6 bg-black/20 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FB7185]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FBBF24]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#34D399]/70" />
        <span className="ml-2 min-w-0 flex-1 break-all text-[11px] text-white/52">
          {part.url}
        </span>
      </div>
      <div className="px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4B08C]/78">
              Web Preview
            </div>
            <div className="mt-1 text-sm font-medium leading-6 text-white/88 break-words">
              {part.title ?? host ?? part.url}
            </div>
            <div className="mt-1 text-xs leading-5 text-white/48 break-all">
              {host ?? part.url}
            </div>
          </div>
          <button
            type="button"
            onClick={() => openUrlInBrowserPanel(part.url, part.title ?? host ?? part.url)}
            className="inline-flex items-center gap-2 rounded-full border border-[#D4B08C]/24 bg-[#D4B08C]/10 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#F7D9BA] transition-colors hover:bg-[#D4B08C]/16"
          >
            <ArrowSquareOut className="h-3.5 w-3.5" />
            Open Browser Panel
          </button>
        </div>
        <div className="mt-4 rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
          <div className="text-[13px] leading-6 text-white/56">
            Continue the web search in the shared browser panel to inspect pages, follow links, and compare sources without losing the transcript.
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sources Footer — P4
// Compact numbered strip shown below the response when web sources are present.
// ============================================================================

function SourcesFooter({ sources }: { sources: Array<Extract<ExtendedUIPart, { type: 'source-document' }>> }) {
  if (sources.length === 0) return null;
  return (
    <div style={{
      marginTop: '12px',
      paddingTop: '10px',
      borderTop: '1px solid var(--ui-border-muted)',
    }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.22)',
        marginBottom: '8px',
      }}>
        Sources
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {sources.map((src, i) => {
          const url = 'url' in src && typeof src.url === 'string' ? src.url : undefined;
          let host = '';
          try { if (url) host = new URL(url).hostname.replace(/^www\./, ''); } catch { host = url ?? ''; }
          return (
            <div key={src.sourceId ?? i} style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.2)',
                flexShrink: 0,
                minWidth: '16px',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {i + 1}.
              </span>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '12px',
                    color: 'rgba(212,176,140,0.65)',
                    textDecoration: 'none',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                  title={url}
                >
                  {src.title ? `${src.title} — ${host}` : host}
                </a>
              ) : (
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.38)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {src.title ?? 'Source'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Tool Input Display — shows tool arguments cleanly
// ============================================================================

function ToolInputDisplay({ input }: { input: unknown }) {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginTop: "4px" }}>
      {keys.map((k) => {
        const val = obj[k];
        const display =
          typeof val === "string"
            ? val
            : typeof val === "number" || typeof val === "boolean"
            ? String(val)
            : JSON.stringify(val).slice(0, 200);
        return (
          <div key={k} style={{ display: "flex", gap: "6px", fontSize: "12px", lineHeight: "1.5" }}>
            <span style={{
              flexShrink: 0,
              fontFamily: "var(--font-mono)",
              color: "rgba(212,176,140,0.55)",
              fontWeight: 600,
              fontSize: "11px",
            }}>
              {k}
            </span>
            <span style={{
              color: "rgba(236,236,236,0.6)",
              wordBreak: "break-all",
              fontFamily: typeof val === "string" && val.includes("/") ? "monospace" : "inherit",
              fontSize: "12px",
            }}>
              {display.length > 160 ? display.slice(0, 160) + "…" : display}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Tool Result Renderer — smart formatting instead of raw JSON
// ============================================================================

function renderToolResult(result: unknown): React.ReactNode {
  if (result === null || result === undefined) {
    return <span className="text-muted-foreground italic">No result returned</span>;
  }

  // Plain string result
  if (typeof result === 'string') {
    const trimmed = result.trim();
    if (!trimmed) return <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", fontStyle: "italic" }}>Empty result</span>;
    const preview = trimmed.length > 500 ? trimmed.slice(0, 500) + '…' : trimmed;
    return (
      <div style={{
        maxHeight: "160px",
        overflowY: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontSize: "12px",
        lineHeight: "1.6",
        color: "rgba(236,236,236,0.6)",
        fontFamily: preview.includes("\n") || preview.startsWith("{") ? "monospace" : "inherit",
      }}>
        {preview}
      </div>
    );
  }

  // Array of content blocks (Anthropic tool result format: [{type:"text", text:"..."}])
  if (Array.isArray(result)) {
    const textParts = (result as any[])
      .filter((item: any) => item?.type === 'text' && typeof item.text === 'string')
      .map((item: any) => item.text as string);

    if (textParts.length > 0) {
      const combined = textParts.join('\n\n');
      const preview = combined.length > 600 ? combined.slice(0, 600) + '…' : combined;
      return (
        <div className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-[13px] leading-6">
          {preview}
        </div>
      );
    }

    // Generic array — show count + preview
    return (
      <div className="space-y-1 max-h-40 overflow-y-auto">
        <div className="text-muted-foreground text-[10px] mb-1">{result.length} items</div>
        {(result as any[]).slice(0, 4).map((item: any, i: number) => (
          <div key={i} className="rounded-xl bg-background/30 p-2 text-[11px] leading-5">
            {typeof item === 'object' ? (
              <>
                {item.title && <div className="font-medium break-words">{item.title}</div>}
                {item.url && <div className="mt-0.5 break-all text-muted-foreground">{item.url}</div>}
                {item.snippet && <div className="mt-1 break-words text-muted-foreground line-clamp-3">{item.snippet}</div>}
                {!item.title && !item.url && !item.snippet && (
                  <div className="break-words">{JSON.stringify(item).slice(0, 120)}</div>
                )}
              </>
            ) : (
              <div className="break-words">{String(item)}</div>
            )}
          </div>
        ))}
        {result.length > 4 && (
          <div className="text-muted-foreground text-[10px]">+{result.length - 4} more</div>
        )}
      </div>
    );
  }

  // Object result
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;

    // Web search results pattern
    if (obj.results && Array.isArray(obj.results)) {
      const results = obj.results as any[];
      return (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {results.slice(0, 4).map((r: any, i: number) => (
            <div key={i} className="rounded-xl bg-background/30 p-2">
              {r.title && <div className="text-[11px] font-medium leading-5 break-words">{r.title}</div>}
              {r.url && (
                <div className="mt-0.5 break-all text-[10px] text-muted-foreground">{r.url}</div>
              )}
              {(r.snippet || r.content || r.description) && (
                <div className="mt-1 break-words text-[10px] text-muted-foreground line-clamp-3">
                  {r.snippet || r.content || r.description}
                </div>
              )}
            </div>
          ))}
          {results.length > 4 && (
            <div className="text-muted-foreground text-[10px]">+{results.length - 4} more results</div>
          )}
        </div>
      );
    }

    // Error-like result
    if (obj.error || obj.message) {
      return (
        <div className="text-destructive leading-relaxed">
          {String(obj.error || obj.message)}
        </div>
      );
    }

    // Success-like result with data
    if (obj.success !== undefined || obj.data !== undefined) {
      const data = obj.data ?? obj;
      const success = obj.success;
      return (
        <div className="space-y-1">
          {success !== undefined && (
            <div className={success ? 'text-green-500' : 'text-destructive'}>
              {success ? '✓ Success' : '✗ Failed'}
            </div>
          )}
          {data && data !== obj && (
            <div className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10px]">
              {typeof data === 'string' ? data : JSON.stringify(data, null, 2).slice(0, 400)}
            </div>
          )}
        </div>
      );
    }

    // Generic object — show key-value pairs for small objects, compact JSON for large
    const keys = Object.keys(obj);
    if (keys.length <= 6) {
      return (
        <div className="space-y-0.5 text-[10px]">
          {keys.map(k => (
            <div key={k} className="flex gap-2">
              <span className="text-muted-foreground font-mono flex-shrink-0">{k}:</span>
              <span className="break-words">
                {typeof obj[k] === 'object'
                  ? JSON.stringify(obj[k]).slice(0, 60)
                  : String(obj[k]).slice(0, 80)}
              </span>
            </div>
          ))}
        </div>
      );
    }

    // Large object — compact JSON
    const json = JSON.stringify(obj, null, 2);
    return (
      <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-[10px] font-mono leading-relaxed">
        {json.length > 600 ? json.slice(0, 600) + '\n…' : json}
      </pre>
    );
  }

  // Fallback for primitives
  return <span>{String(result)}</span>;
}

// ============================================================================
// Thought Process Header — P1
// Collapsible "Thought process >" header replacing raw italic reasoning block.
// Auto-opens while streaming, auto-collapses 1s after streaming ends.
// ============================================================================

function ThoughtProcessHeader({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  const [isOpen, setIsOpen] = useState(!!isStreaming);
  const [hasAutoClosed, setHasAutoClosed] = useState(false);

  useEffect(() => {
    if (isStreaming && !isOpen) setIsOpen(true);
  }, [isStreaming, isOpen]);

  useEffect(() => {
    if (!isStreaming && isOpen && !hasAutoClosed) {
      const t = setTimeout(() => {
        setIsOpen(false);
        setHasAutoClosed(true);
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [isStreaming, isOpen, hasAutoClosed]);

  // Extract a readable summary from the first meaningful line of reasoning text
  const summary = useMemo(() => {
    if (!text) return 'Thought process';
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 15 && !l.startsWith('<') && !l.startsWith('{'));
    const first = lines[0] ?? '';
    return first.length > 80 ? first.slice(0, 80) + '…' : first || 'Thought process';
  }, [text]);

  return (
    <div style={{ margin: '4px 0 10px' }}>
      <button
        onClick={() => setIsOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0',
        }}
      >
        <CaretRight
          size={10}
          style={{
            color: 'rgba(236,236,236,0.28)',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.18s ease',
            flexShrink: 0,
          }}
        />
        <span style={{
          fontSize: '12px',
          color: 'rgba(236,236,236,0.3)',
          fontStyle: 'italic',
          letterSpacing: '0.01em',
        }}>
          {summary}
        </span>
      </button>

      {isOpen && text && (
        <div style={{
          marginTop: '6px',
          paddingLeft: '14px',
          borderLeft: '1px solid color-mix(in srgb, var(--accent-primary) 14%, transparent)',
          color: 'rgba(236,236,236,0.22)',
          fontSize: '12px',
          lineHeight: '1.6',
          fontStyle: 'italic',
          maxHeight: '180px',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {text}{isStreaming ? ' █' : ''}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Humanize tool calls — P2
// Converts raw toolName + input → readable title + result metadata string.
// ============================================================================

function humanizeToolCall(
  toolName: string,
  input: unknown,
  state: string,
  result: unknown,
): { title: string; meta: string | null } {
  const name = (toolName ?? '').toLowerCase().replace(/[_\-\s]/g, '');
  const inp = (input && typeof input === 'object') ? input as Record<string, unknown> : {};

  const query   = String(inp.query   ?? inp.search ?? inp.q          ?? '');
  const path    = String(inp.path    ?? inp.filename ?? inp.file ?? inp.name ?? '');
  const url     = String(inp.url     ?? inp.link    ?? inp.uri       ?? '');
  const command = String(inp.command ?? inp.cmd     ?? inp.code      ?? '');
  const content = String(inp.content ?? inp.text    ?? inp.new_content ?? inp.new_string ?? '');

  // Result metadata: count or char length
  let meta: string | null = null;
  if (state === 'output-available' && result !== null && result !== undefined) {
    if (Array.isArray(result)) {
      meta = `${result.length} result${result.length === 1 ? '' : 's'}`;
    } else if (typeof result === 'object') {
      const obj = result as Record<string, unknown>;
      if (Array.isArray(obj.results)) meta = `${(obj.results as unknown[]).length} results`;
      else if (typeof obj.content === 'string' && (obj.content as string).length > 50) meta = `${(obj.content as string).length} chars`;
    } else if (typeof result === 'string' && result.length > 80) {
      meta = `${result.length} chars`;
    }
  }
  // During execution: char count from input content if writing something
  if ((state === 'input-streaming' || state === 'input-available') && !meta && content.length > 0) {
    meta = `~${content.length} chars`;
  }

  const fname = path ? path.split('/').pop() ?? path : '';

  let title = toolName; // raw fallback

  if (name.includes('websearch') || name.includes('browsersearch') || name.includes('googlesearch') || name === 'search') {
    title = query ? `Searched web for "${query.slice(0, 55)}"` : 'Searched the web';
  } else if (name.includes('todowrite') || name.includes('todoupdate') || name.includes('todoread')) {
    title = state === 'output-available' ? 'Updated todo list' : 'Updating todo list';
  } else if (name.includes('bash') || name.includes('runcode') || name.includes('executecode') || name.includes('computer')) {
    title = command ? `Ran: ${command.slice(0, 50)}` : 'Ran code';
  } else if (name.includes('strreplace') || name.includes('editfile') || name === 'edit') {
    title = fname ? `Edited ${fname}` : 'Edited file';
  } else if (name.includes('writefile') || name === 'write' || name.includes('createfile')) {
    title = fname ? `Writing ${fname}` : 'Writing file';
  } else if (name.includes('readfile') || name === 'read') {
    title = fname ? `Read ${fname}` : 'Read file';
  } else if (name.includes('fetchurl') || name.includes('browseurl') || name.includes('fetchweb') || (name.includes('fetch') && url)) {
    let host = '';
    try { host = new URL(url).hostname; } catch { host = url.slice(0, 40); }
    title = host ? `Fetching ${host}` : 'Fetching page';
  } else if (name.includes('glob') || name.includes('findfiles')) {
    title = 'Finding files';
  } else if (name.includes('grep') || name.includes('searchcode')) {
    title = query ? `Searching code for "${query.slice(0, 40)}"` : 'Searching code';
  }

  return { title, meta };
}

// ============================================================================

interface PartRendererProps {
  part: ExtendedUIPart;
  isLast: boolean;
  isStreaming?: boolean;
  onSelectArtifact?: (artifact: SelectedArtifact) => void;
  selectedArtifactTitle?: string;
  viewMode?: ViewMode;
}

function PartRenderer({ part, isLast, isStreaming, onSelectArtifact, selectedArtifactTitle, viewMode = 'normal' }: PartRendererProps) {
  switch (part.type) {
    // ==================== OPENUI (Generative UI) ====================
    case 'openui': {
      if (onSelectArtifact) {
        const uiArtifact: SelectedArtifact = {
          title: part.title || "Interactive UI",
          kind: "openui",
          content: part.stream,
        };
        return (
          <ArtifactCard
            artifact={uiArtifact}
            isSelected={selectedArtifactTitle === uiArtifact.title}
            onClick={() => onSelectArtifact(uiArtifact)}
          />
        );
      }
      return (
        <div className="my-4 w-full">
          <AllternitOpenUIRenderer stream={part.stream} />
        </div>
      );
    }

    // ==================== TEXT (Main Response - Largest) ====================
    case 'text':
      return (
        <div className="text-[16px] leading-[1.75] text-foreground my-3 relative">
          {/* isStreaming && isLast → Markdown renders cursor inside the last <p> inline with text */}
          <Markdown isStreaming={isStreaming && isLast}>{part.text}</Markdown>
        </div>
      );

    // ==================== REASONING (Thought Trace - Smaller, Structured) ====================
    case 'reasoning':
      {
      // summary mode: skip entirely (already filtered out by visibleParts)
      // normal mode: always collapsed (ThoughtProcessHeader handles this)
      // verbose mode: full ThoughtTrace, starts open
      const isReasoningStreaming = isStreaming && isLast;
      const structuredSteps = coerceThoughtSteps(
        (part as typeof part & { trace?: { steps?: unknown } }).trace?.steps,
      );
      const steps = structuredSteps.length > 0 ? structuredSteps : parseThoughtSteps(part.text);

      if (viewMode === 'verbose') {
        // Full expanded ThoughtTrace or raw block
        if (steps.length > 0) {
          return (
            <div className="my-2">
              <ThoughtTrace
                steps={steps}
                isStreaming={isReasoningStreaming}
                isComplete={!isStreaming}
              />
            </div>
          );
        }
        return (
          <ThoughtProcessHeader
            text={part.text || ''}
            isStreaming={isReasoningStreaming}
          />
        );
      }

      // normal mode: compact collapsible header only (no full ThoughtTrace)
      return (
        <ThoughtProcessHeader
          text={part.text || ''}
          isStreaming={isReasoningStreaming}
        />
      );
      }

    // ==================== CODE ====================
    case 'code': {
      // If there's a filename, show as a clickable card that opens in side panel
      if (part.filename && onSelectArtifact) {
        const codeArtifact: SelectedArtifact = {
          title: part.filename,
          kind: "code",
          content: part.code,
          language: part.language,
        };
        return (
          <ArtifactCard
            artifact={codeArtifact}
            isSelected={selectedArtifactTitle === part.filename}
            onClick={() => onSelectArtifact(codeArtifact)}
          />
        );
      }
      // No filename → render inline as before
      return (
        <div className="rounded-lg overflow-hidden border my-3">
          <CodeBlock language={part.language as any} code={part.code} />
        </div>
      );
    }

    // ==================== TERMINAL ====================
    case 'terminal':
      return (
        <TerminalPill
          command={part.command}
          output={part.output}
          state={part.status === "running" ? "running" : "completed"}
          collapsible={true}
        />
      );

    // ==================== TOOLS ====================
    case 'dynamic-tool': {
      const toolState = part.state === "input-streaming" || part.state === "input-available" ? "running" :
                        part.state === "output-error" ? "error" : "completed";

      const { title: humanTitle, meta } = humanizeToolCall(
        part.toolName ?? '',
        'input' in part ? part.input : undefined,
        part.state,
        'result' in part ? (part as any).result : undefined,
      );

      // normal mode: compact non-expandable chip — no input/result details
      if (viewMode === 'normal') {
        return (
          <GlassPill
            type="tool"
            state={toolState}
            title={humanTitle}
            description={meta ?? undefined}
            collapsible={false}
            defaultCollapsed={true}
          />
        );
      }

      // verbose mode: full expandable card with input + result
      // Whether to show expandable content
      const hasOutput = (part.state === "output-available" && "result" in part) ||
                        (part.state === "output-error" && "error" in part);

      return (
        <GlassPill
          type="tool"
          state={toolState}
          title={humanTitle}
          description={meta ?? undefined}
          collapsible={hasOutput}
          defaultCollapsed={part.state === "output-available"}
        >
          {/* Tool input — show while running or when expanded on complete */}
          {"input" in part && Boolean(part.input) && (
            <ToolInputDisplay input={part.input as unknown} />
          )}
          {/* Tool result */}
          {part.state === "output-available" && "result" in part && (
            <div style={{ marginTop: "6px" }}>
              {renderToolResult(part.result)}
            </div>
          )}
          {/* Tool error */}
          {part.state === "output-error" && "error" in part && (
            <div style={{
              marginTop: "6px",
              display: "flex",
              alignItems: "flex-start",
              gap: "6px",
              fontSize: "12px",
              color: "rgba(248,113,113,0.8)",
              lineHeight: "1.5",
            }}>
              <Warning style={{ width: 12, height: 12, flexShrink: 0, marginTop: 2 }} />
              <span style={{ wordBreak: "break-word" }}>{String(part.error)}</span>
            </div>
          )}
        </GlassPill>
      );
    }

    // ==================== SOURCES (Web Search) ====================
    case 'source-document':
      return <SourceDocumentCard part={part} />;

    // ==================== ERRORS ====================
    case 'error': {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          padding: '2px 0',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'rgba(248, 113, 113, 0.85)',
          }}>
            <span style={{ fontSize: '13px', lineHeight: 1 }}>⚠</span>
            <span>{part.message || 'Something went wrong'}</span>
          </div>
          {part.stackTrace && (
            <pre style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.3)',
              background: 'var(--surface-panel)',
              padding: '8px 10px',
              borderRadius: '6px',
              overflowX: 'auto',
              marginTop: '4px',
            }}>
              {part.stackTrace}
            </pre>
          )}
        </div>
      );
    }

    // ==================== TEST RESULTS ====================
    case 'test-results':
      return (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Test Results</span>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                part.summary.failed === 0 ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"
              )}>
                {part.summary.passed}/{part.summary.total} passed
              </span>
            </div>
          </div>
          <div className="space-y-1">
            {part.tests.map((test, i) => (
              <div 
                key={i} 
                className={cn(
                  "flex items-center gap-2 p-2 rounded text-sm",
                  test.status === 'passed' && "bg-green-500/10",
                  test.status === 'failed' && "bg-red-500/10",
                  test.status === 'skipped' && "bg-muted"
                )}
              >
                {test.status === 'passed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                {test.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
                {test.status === 'skipped' && <Clock className="w-4 h-4 text-muted-foreground" />}
                <span className="flex-1">{test.name}</span>
                <span className="text-xs text-muted-foreground">{test.durationMs}ms</span>
              </div>
            ))}
          </div>
        </div>
      );

    // ==================== PLAN ====================
    case 'plan':
      return (
        <div className="border rounded-lg p-4">
          <div className="text-sm font-medium mb-3">{part.title}</div>
          <div className="space-y-2">
            {part.steps.map((step) => (
              <div 
                key={step.id} 
                className={cn(
                  "flex items-center gap-3 p-2 rounded transition-colors",
                  step.status === 'complete' && "bg-green-500/10",
                  step.status === 'in-progress' && "bg-blue-500/10",
                  step.status === 'error' && "bg-red-500/10",
                  step.status === 'pending' && "bg-muted/50"
                )}
              >
                {step.status === 'complete' && <Check className="w-4 h-4 text-green-500" />}
                {step.status === 'in-progress' && <Clock className="w-4 h-4 text-blue-500 animate-pulse" />}
                {step.status === 'error' && <X className="w-4 h-4 text-red-500" />}
                {step.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-muted-foreground" />}
                <span className={cn(
                  "text-sm",
                  step.status === 'pending' && "text-muted-foreground"
                )}>
                  {step.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      );

    // ==================== CHECKPOINT ====================
    case 'checkpoint':
      return (
        <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <CheckCircle className="w-5 h-5 text-blue-500" />
          <div className="flex-1">
            <div className="text-sm font-medium">Checkpoint</div>
            <div className="text-xs text-muted-foreground">{part.description}</div>
          </div>
        </div>
      );

    // ==================== AUDIO ====================
    case 'audio':
      return (
        <audio 
          controls 
          src={part.audioUrl}
          className="w-full"
        />
      );

    // ==================== ARTIFACT (clickable card → side panel) ====================
    case 'artifact': {
      const artifactData: SelectedArtifact = {
        title: part.title,
        kind: part.kind as ArtifactKind,
        content: part.content,
        url: part.url,
      };
      return (
        <ArtifactCard
          artifact={artifactData}
          isSelected={selectedArtifactTitle === part.title}
          onClick={() => onSelectArtifact?.(artifactData)}
        />
      );
    }

    // ==================== MCP APP ====================
    case 'mcp-app':
      return <McpAppFrame part={part} />;

    // ==================== CITATION ====================
    case 'citation':
      return (
        <a
          href={`#source-${part.sourceId}`}
          className="flex w-full max-w-full items-start gap-3 rounded-2xl border border-sky-400/16 bg-sky-500/[0.06] px-4 py-3 text-left transition-colors hover:bg-sky-500/[0.1]"
        >
          <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-sky-300/20 bg-sky-500/10">
            <Link className="h-4 w-4 text-sky-200" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100/70">Citation</span>
              <span className="rounded-full border border-sky-300/14 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-100/55">
                {part.sourceId}
              </span>
            </span>
            <span className="mt-1 block whitespace-pre-wrap break-words text-sm leading-6 text-foreground/84">
              {part.text}
            </span>
          </span>
        </a>
      );

    // ==================== QUEUE ====================
    case 'queue':
      return (
        <div className="border rounded-lg p-4">
          <div className="text-sm font-medium mb-3">Processing Queue</div>
          <div className="space-y-1">
            {part.items.map((item) => (
              <div 
                key={item.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded text-sm",
                  item.status === 'complete' && "bg-green-500/10",
                  item.status === 'processing' && "bg-blue-500/10",
                  item.status === 'error' && "bg-red-500/10",
                  item.status === 'pending' && "bg-muted"
                )}
              >
                {item.status === 'complete' && <Check className="w-4 h-4 text-green-500" />}
                {item.status === 'processing' && <Clock className="w-4 h-4 text-blue-500 animate-spin" />}
                {item.status === 'error' && <X className="w-4 h-4 text-red-500" />}
                {item.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-muted-foreground" />}
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      );

    // ==================== TASK ====================
    case 'task':
      return (
        <div className={cn(
          "flex items-center gap-3 p-3 border rounded-lg",
          part.status === 'running' && "bg-blue-500/10 border-blue-500/20",
          part.status === 'complete' && "bg-green-500/10 border-green-500/20",
          part.status === 'error' && "bg-red-500/10 border-red-500/20",
        )}>
          {part.status === 'running' && <Clock className="w-5 h-5 text-blue-500 animate-pulse" />}
          {part.status === 'complete' && <CheckCircle className="w-5 h-5 text-green-500" />}
          {part.status === 'error' && <XCircle className="w-5 h-5 text-red-500" />}
          {part.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />}
          <div className="flex-1">
            <div className="text-sm font-medium">{part.title}</div>
            {part.description && (
              <div className="text-xs text-muted-foreground">{part.description}</div>
            )}
          </div>
          {part.progress !== undefined && (
            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all"
                style={{ width: `${part.progress}%` }}
              />
            </div>
          )}
        </div>
      );

    // ==================== COMMIT ====================
    case 'commit':
      return (
        <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="px-2 py-1 bg-green-500/20 rounded text-xs font-mono text-green-600">
            {part.hash.slice(0, 7)}
          </div>
          <div className="flex-1 text-sm">{part.message}</div>
        </div>
      );

    // ==================== CONFIRMATION ====================
    case 'confirmation':
      return (
        <div className="border rounded-lg p-4 bg-amber-500/10 border-amber-500/20">
          <div className="text-sm font-medium mb-2">{part.title}</div>
          <div className="text-sm text-muted-foreground mb-4">{part.description}</div>
          <div className="flex gap-2">
            {part.actions.map(action => (
              <button
                key={action.id}
                className={cn(
                  "px-4 py-2 rounded text-sm font-medium transition-colors",
                  action.style === 'danger' && "bg-red-500 text-white hover:bg-red-600",
                  action.style === 'primary' && "bg-primary text-primary-foreground hover:bg-primary/90",
                  action.style === 'secondary' && "bg-muted hover:bg-muted/80",
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      );

    // ==================== FILE TREE ====================
    case 'file-tree':
      return (
        <div className="border rounded-lg p-4 font-mono text-sm">
          <FileTreeNode node={part.root} level={0} />
        </div>
      );

    // ==================== SANDBOX ====================
    case 'sandbox':
      return (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-muted border-b flex items-center gap-2">
            <span className="text-xs font-medium">{part.title || 'Preview'}</span>
          </div>
          <div className="p-4 bg-white">
            {part.html && (
              <iframe 
                srcDoc={part.html}
                className="w-full h-64 border-0"
                sandbox="allow-scripts"
              />
            )}
          </div>
        </div>
      );

    // ==================== WEB PREVIEW ====================
    case 'web-preview':
      return <BrowserPreviewCard part={part} />;

    // ==================== CANVAS ====================
    case 'canvas':
      return (
        <div className="border rounded-lg p-4 min-h-[200px] bg-muted/50">
          <div className="text-sm font-medium mb-2">{part.title || 'Canvas'}</div>
          <div className="text-xs text-muted-foreground">
            Canvas content would render here
          </div>
        </div>
      );

    // ==================== FILE OPERATION ====================
    case 'file-operation': {
      // Show as a clickable card if there's content/diff to view
      const hasContent = !!(part.content || part.diff);
      if (hasContent && onSelectArtifact) {
        const fileArtifact: SelectedArtifact = {
          title: part.path.split("/").pop() ?? part.path,
          kind: "code",
          content: part.diff
            ? `// ${part.operation.toUpperCase()}: ${part.path}\n\n${part.diff}`
            : part.content,
          language: part.path.includes(".") ? part.path.split(".").pop() : "text",
        };
        return (
          <FileChangeCard
            operation={part.operation}
            path={part.path}
            isSelected={selectedArtifactTitle === fileArtifact.title}
            onClick={() => onSelectArtifact(fileArtifact)}
          />
        );
      }
      // No content: just show the slim pill
      return (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 10px",
          borderRadius: "8px",
          border: `1px solid ${part.operation === 'create' ? 'rgba(74,222,128,0.25)' : part.operation === 'delete' ? 'rgba(248,113,113,0.25)' : 'rgba(97,175,239,0.25)'}`,
          background: part.operation === 'create' ? 'rgba(74,222,128,0.06)' : part.operation === 'delete' ? 'rgba(248,113,113,0.06)' : 'rgba(97,175,239,0.06)',
        }}>
          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: part.operation === 'create' ? 'rgba(74,222,128,0.8)' : part.operation === 'delete' ? 'rgba(248,113,113,0.8)' : 'rgba(97,175,239,0.8)' }}>
            {part.operation}
          </span>
          <span style={{ fontSize: "12px", fontFamily: "ui-monospace, monospace", color: "rgba(236,236,236,0.55)" }}>
            {part.path}
          </span>
        </div>
      );
    }

    // ==================== IMAGE ====================
    case 'image': {
      const imageArtifact: SelectedArtifact = {
        title: part.title ?? part.alt ?? "Image",
        kind: "image",
        url: part.url,
      };
      if (onSelectArtifact) {
        return (
          <ArtifactCard
            artifact={imageArtifact}
            isSelected={selectedArtifactTitle === imageArtifact.title}
            onClick={() => onSelectArtifact(imageArtifact)}
          />
        );
      }
      return (
        <img
          src={part.url}
          alt={part.alt ?? part.title}
          style={{ maxWidth: "100%", borderRadius: "8px" }}
        />
      );
    }

    // ==================== DEFAULT ====================
    default:
      // Try to render as text if possible
      if ('text' in part && typeof part.text === 'string') {
        return <Markdown>{part.text}</Markdown>;
      }
      return null;
  }
}

// ─── FileChangeCard ────────────────────────────────────────────────────────────
// Clickable card for file-operation parts that have content/diff to preview.

function FileChangeCard({
  operation,
  path,
  isSelected,
  onClick,
}: {
  operation: "create" | "modify" | "delete";
  path: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const opColor =
    operation === "create"
      ? "rgba(74,222,128,0.75)"
      : operation === "delete"
      ? "rgba(248,113,113,0.75)"
      : "rgba(97,175,239,0.75)";
  const opBg =
    operation === "create"
      ? "rgba(74,222,128,0.08)"
      : operation === "delete"
      ? "rgba(248,113,113,0.08)"
      : "rgba(97,175,239,0.08)";

  const filename = path.split("/").pop() ?? path;
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        maxWidth: "340px",
        padding: "8px 12px",
        borderRadius: "9px",
        border: isSelected
          ? `1.5px solid ${opColor.replace("0.75", "0.5")}`
          : `1.5px solid ${hovered ? "rgba(255,255,255,0.14)" : "var(--ui-border-muted)"}`,
        background: isSelected ? opBg : hovered ? "var(--surface-hover)" : "var(--surface-hover)",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.13s ease",
        marginTop: "4px",
      }}
    >
      {/* Op badge */}
      <span
        style={{
          fontSize: "9px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: opColor,
          background: opBg,
          border: `1px solid ${opColor.replace("0.75", "0.25")}`,
          padding: "2px 6px",
          borderRadius: "5px",
          flexShrink: 0,
        }}
      >
        {operation}
      </span>

      {/* Path */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "rgba(236,236,236,0.88)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {filename}
        </div>
        {dir && (
          <div
            style={{
              fontSize: "10px",
              color: "rgba(255,255,255,0.28)",
              marginTop: "1px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {dir}
          </div>
        )}
      </div>

      <Warning size={12} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0, display: "none" }} />
    </button>
  );
}

// Helper for file tree rendering
function FileTreeNode({ node, level }: { node: import('@/lib/ai/rust-stream-adapter-extended').FileTreeNode; level: number }) {
  return (
    <div style={{ marginLeft: level * 16 }}>
      <div className="flex items-center gap-2 py-1">
        {node.type === 'directory' ? (
          <>
            <span className="text-muted-foreground">📁</span>
            <span className="font-medium">{node.name}</span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">📄</span>
            <span>{node.name}</span>
          </>
        )}
      </div>
      {node.children?.map((child, i) => (
        <FileTreeNode key={i} node={child} level={level + 1} />
      ))}
    </div>
  );
}

export default UnifiedMessageRenderer;
