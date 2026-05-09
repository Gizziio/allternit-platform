/**
 * Unified Message Renderer
 * 
 * Renders AI Elements based on stream content type.
 * Used across ALL modes: Chat, Cowork, Agent, Runner, Code
 * 
 * Core principle: Elements appear based on DATA, not mode.
 * All modes share the same rendering surface.
 */

import React from 'react';
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
  AudioPlayer,
  AudioPlayerElement,
  AudioPlayerControlBar,
  AudioPlayerPlayButton,
  AudioPlayerSeekBackwardButton,
  AudioPlayerSeekForwardButton,
  AudioPlayerTimeDisplay,
  AudioPlayerTimeRange,
  AudioPlayerDurationDisplay,
  AudioPlayerMuteButton,
} from './audio-player';
import {
  InlineCitation,
  InlineCitationText,
  InlineCitationCard,
  InlineCitationCardTrigger,
  InlineCitationCardBody,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselItem,
  InlineCitationCarouselHeader,
  InlineCitationCarouselPrev,
  InlineCitationCarouselNext,
  InlineCitationCarouselIndex,
  InlineCitationSource,
} from './inline-citation';
import {
  Warning,
  Globe,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import { Reasoning, ReasoningTrigger, ReasoningContent } from './reasoning';
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from './chain-of-thought';
import { Plan, PlanHeader, PlanTitle, PlanContent, PlanTrigger } from './plan';
import {
  Queue,
  QueueList,
  QueueItem,
  QueueItemIndicator,
  QueueItemContent,
} from './queue';
import { Task, TaskTrigger, TaskContent, TaskItem } from './task';
import { Checkpoint, CheckpointIcon, CheckpointDescription } from './checkpoint';
import {
  Commit,
  CommitHeader,
  CommitHash,
  CommitMessage,
  CommitInfo,
  CommitActions,
  CommitCopyButton,
} from './commit';
import {
  TestResults,
  TestResultsHeader,
  TestResultsSummary,
  TestResultsContent,
  Test,
} from './test-results';
import { FileTree, FileTreeFolder, FileTreeFile } from './file-tree';
import {
  EnvironmentVariables,
  EnvironmentVariablesHeader,
  EnvironmentVariablesTitle,
  EnvironmentVariablesToggle,
  EnvironmentVariablesContent,
  EnvironmentVariable,
} from './environment-variables';
import { Snippet, SnippetInput, SnippetCopyButton } from './snippet';
import {
  StackTrace,
  StackTraceHeader,
  StackTraceError,
  StackTraceErrorType,
  StackTraceErrorMessage,
  StackTraceActions,
  StackTraceCopyButton,
  StackTraceExpandButton,
  StackTraceContent,
  StackTraceFrames,
} from './stack-trace';
import {
  PackageInfo,
  PackageInfoHeader,
  PackageInfoName,
  PackageInfoVersion,
  PackageInfoContent,
  PackageInfoDependencies,
  PackageInfoDependency,
} from './package-info';
import { JSXPreview, JSXPreviewContent, JSXPreviewError } from './jsx-preview';
import { EmailDraft } from './email-tool';
import { SMSDraft } from './sms-tool';
import { RecipeDraft } from './recipe-tool';
import { ImageSearchTool } from './image-search-tool';
import { AppRecommendations } from './app-recommendations';
import { LeveeWizard } from './levee-wizard';
import { ModelComparison } from './model-comparison';
import { MockChat } from './mock-chat';
import { SchemaDisplay } from './schema-display';

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
          sourceParts={sourceParts}
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
  sourceParts?: Array<Extract<ExtendedUIPart, { type: 'source-document' }>>;
}

function PartRenderer({ part, isLast, isStreaming, onSelectArtifact, selectedArtifactTitle, viewMode = 'normal', sourceParts }: PartRendererProps) {
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
    case 'reasoning': {
      const isReasoningStreaming = isStreaming && isLast;
      const structuredSteps = coerceThoughtSteps(
        (part as typeof part & { trace?: { steps?: unknown } }).trace?.steps,
      );
      const steps = structuredSteps.length > 0 ? structuredSteps : parseThoughtSteps(part.text);

      if (viewMode === 'verbose' && steps.length > 0) {
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
        <Reasoning isStreaming={isReasoningStreaming} className="my-2">
          <ReasoningTrigger />
          <ReasoningContent text={part.text || ''} isStreaming={isReasoningStreaming} />
        </Reasoning>
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
        <TestResults summary={{ ...part.summary, skipped: 0 }}>
          <TestResultsHeader>
            <TestResultsSummary />
          </TestResultsHeader>
          <TestResultsContent>
            {part.tests.map((test, i) => (
              <Test key={i} name={test.name} status={test.status} duration={test.durationMs} />
            ))}
          </TestResultsContent>
        </TestResults>
      );

    // ==================== PLAN ====================
    case 'plan':
      return (
        <Plan defaultOpen isStreaming={isStreaming && isLast}>
          <PlanHeader>
            <PlanTitle>{part.title}</PlanTitle>
            <PlanTrigger />
          </PlanHeader>
          <PlanContent>
            <div className="space-y-1">
              {part.steps.map((step) => (
                <div key={step.id} className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                  step.status === 'complete' && "text-muted-foreground",
                  step.status === 'in-progress' && "text-foreground font-medium",
                  step.status === 'error' && "text-destructive",
                  step.status === 'pending' && "text-muted-foreground/50",
                )}>
                  <span className={cn(
                    "size-2 rounded-full shrink-0",
                    step.status === 'complete' && "bg-green-500",
                    step.status === 'in-progress' && "bg-primary animate-pulse",
                    step.status === 'error' && "bg-destructive",
                    step.status === 'pending' && "bg-muted-foreground/30",
                  )} />
                  {step.description}
                </div>
              ))}
            </div>
          </PlanContent>
        </Plan>
      );

    // ==================== CHECKPOINT ====================
    case 'checkpoint':
      return (
        <Checkpoint>
          <CheckpointIcon />
          <CheckpointDescription>{part.description}</CheckpointDescription>
        </Checkpoint>
      );

    // ==================== AUDIO ====================
    case 'audio':
      return (
        <AudioPlayer className="w-full rounded-xl border border-white/8 bg-white/[0.03] px-2 py-1">
          <AudioPlayerElement src={part.audioUrl} />
          <AudioPlayerControlBar>
            <AudioPlayerPlayButton />
            <AudioPlayerSeekBackwardButton seekOffset={10} />
            <AudioPlayerTimeDisplay />
            <AudioPlayerTimeRange />
            <AudioPlayerDurationDisplay />
            <AudioPlayerSeekForwardButton seekOffset={10} />
            <AudioPlayerMuteButton />
          </AudioPlayerControlBar>
        </AudioPlayer>
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
    case 'citation': {
      const source = sourceParts?.find((s) => s.sourceId === part.sourceId);
      const sourceUrl = source && 'url' in source && typeof source.url === 'string' ? source.url : undefined;

      return (
        <InlineCitation className="block my-1">
          <InlineCitationText className="text-sm leading-6 text-foreground/84 whitespace-pre-wrap break-words">
            {part.text}
          </InlineCitationText>
          <InlineCitationCard>
            <InlineCitationCardTrigger sources={sourceUrl ? [sourceUrl] : []} />
            <InlineCitationCardBody>
              <InlineCitationCarousel>
                <InlineCitationCarouselHeader>
                  <InlineCitationCarouselPrev />
                  <InlineCitationCarouselIndex />
                  <InlineCitationCarouselNext />
                </InlineCitationCarouselHeader>
                <InlineCitationCarouselContent>
                  <InlineCitationCarouselItem>
                    <InlineCitationSource
                      title={source?.title}
                      url={sourceUrl}
                    />
                  </InlineCitationCarouselItem>
                </InlineCitationCarouselContent>
              </InlineCitationCarousel>
            </InlineCitationCardBody>
          </InlineCitationCard>
        </InlineCitation>
      );
    }

    // ==================== QUEUE ====================
    case 'queue':
      return (
        <Queue>
          <QueueList>
            {part.items.map((item) => (
              <QueueItem key={item.id}>
                <div className="flex items-center gap-2">
                  <QueueItemIndicator completed={item.status === 'complete'} />
                  <QueueItemContent completed={item.status === 'complete'}>
                    {item.label}
                  </QueueItemContent>
                </div>
              </QueueItem>
            ))}
          </QueueList>
        </Queue>
      );

    // ==================== TASK ====================
    case 'task':
      return (
        <Task defaultOpen={part.status === 'running'}>
          <TaskTrigger
            title={`${part.title}${part.status === 'running' ? ' — running' : part.status === 'complete' ? ' — done' : part.status === 'error' ? ' — error' : ''}`}
          />
          {part.description && (
            <TaskContent>
              <TaskItem>{part.description}</TaskItem>
            </TaskContent>
          )}
        </Task>
      );

    // ==================== COMMIT ====================
    case 'commit':
      return (
        <Commit>
          <CommitHeader>
            <CommitInfo>
              <CommitHash>{part.hash.slice(0, 7)}</CommitHash>
              <CommitMessage>{part.message}</CommitMessage>
            </CommitInfo>
            <CommitActions>
              <CommitCopyButton hash={part.hash} />
            </CommitActions>
          </CommitHeader>
        </Commit>
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
        <FileTree>
          {renderFileTreeNodes([part.root])}
        </FileTree>
      );

    // ==================== SANDBOX ====================
    case 'sandbox': {
      // Detect JSX — starts with an uppercase component or fragment after optional whitespace
      const looksLikeJSX = part.html ? /^\s*<[A-Z<]/.test(part.html) : false;
      if (looksLikeJSX) {
        return (
          <div className="border rounded-lg overflow-hidden">
            {part.title && (
              <div className="px-4 py-2 bg-muted border-b flex items-center gap-2">
                <span className="text-xs font-medium">{part.title}</span>
              </div>
            )}
            <div className="p-4">
              <JSXPreview jsx={part.html!} isStreaming={isStreaming && isLast}>
                <JSXPreviewContent />
                <JSXPreviewError />
              </JSXPreview>
            </div>
          </div>
        );
      }
      return (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-muted border-b flex items-center gap-2">
            <span className="text-xs font-medium">{part.title || 'Preview'}</span>
          </div>
          <div className="bg-white">
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
    }

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
          <span style={{ fontSize: "12px", fontFamily: 'var(--font-mono)', color: "rgba(236,236,236,0.55)" }}>
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

    // ==================== ENVIRONMENT VARIABLES ====================
    case 'environment-variables':
      return (
        <EnvironmentVariables>
          <EnvironmentVariablesHeader>
            <EnvironmentVariablesTitle />
            <EnvironmentVariablesToggle />
          </EnvironmentVariablesHeader>
          <EnvironmentVariablesContent>
            {Object.entries(part.variables).map(([name, value]) => (
              <EnvironmentVariable key={name} name={name} value={value} />
            ))}
          </EnvironmentVariablesContent>
        </EnvironmentVariables>
      );

    // ==================== SNIPPET ====================
    case 'snippet':
      return (
        <Snippet code={part.code} className="my-1">
          <SnippetInput />
          <SnippetCopyButton />
        </Snippet>
      );

    // ==================== STACK TRACE ====================
    case 'stack-trace': {
      const traceLines: string[] = [
        part.errorType ? `${part.errorType}: ${part.message}` : part.message,
      ];
      if (part.frames) {
        for (const f of part.frames) {
          if (f.function) {
            traceLines.push(`    at ${f.function} (${f.file}:${f.line}:${f.column})`);
          } else {
            traceLines.push(`    at ${f.file}:${f.line}:${f.column}`);
          }
        }
      }
      return (
        <StackTrace trace={traceLines.join('\n')}>
          <StackTraceHeader>
            <StackTraceError>
              {part.errorType && <StackTraceErrorType />}
              <StackTraceErrorMessage />
            </StackTraceError>
            <StackTraceActions>
              <StackTraceCopyButton />
              <StackTraceExpandButton />
            </StackTraceActions>
          </StackTraceHeader>
          <StackTraceContent>
            <StackTraceFrames />
          </StackTraceContent>
        </StackTrace>
      );
    }

    // ==================== PACKAGE INFO ====================
    case 'package-info': {
      const deps = part.dependencies ? Object.entries(part.dependencies) : [];
      return (
        <PackageInfo name={part.name} currentVersion={part.version}>
          <PackageInfoHeader>
            <PackageInfoName />
          </PackageInfoHeader>
          {part.version && <PackageInfoVersion />}
          {deps.length > 0 && (
            <PackageInfoContent>
              <PackageInfoDependencies>
                {deps.map(([dname, dver]) => (
                  <PackageInfoDependency key={dname} name={dname} version={dver} />
                ))}
              </PackageInfoDependencies>
            </PackageInfoContent>
          )}
        </PackageInfo>
      );
    }

    // ==================== SCHEMA ====================
    case 'schema': {
      // Use SchemaDisplay library compound when schema data is an HTTP API schema shape
      const s = part.schema as Record<string, unknown> | null;
      const isHttpApiSchema =
        s != null &&
        typeof s === 'object' &&
        typeof s.method === 'string' &&
        typeof s.path === 'string';

      if (isHttpApiSchema) {
        return (
          <SchemaDisplay
            method={s!.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'}
            path={s!.path as string}
            description={typeof s!.description === 'string' ? s!.description : undefined}
            parameters={Array.isArray(s!.parameters) ? s!.parameters as any : undefined}
            requestBody={Array.isArray(s!.requestBody) ? s!.requestBody as any : undefined}
            responseBody={Array.isArray(s!.responseBody) ? s!.responseBody as any : undefined}
          />
        );
      }

      const schemaStr = JSON.stringify(part.schema, null, 2);
      return (
        <div className="rounded-lg border bg-background overflow-hidden">
          <div className="px-4 py-2 border-b bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Schema</span>
          </div>
          <pre className="p-4 text-xs font-mono overflow-auto max-h-64 text-foreground/80 leading-relaxed">
            {schemaStr}
          </pre>
        </div>
      );
    }

    // ==================== CHAIN OF THOUGHT ====================
    case 'chain-of-thought':
      return (
        <ChainOfThought>
          <ChainOfThoughtHeader />
          <ChainOfThoughtContent>
            {part.steps.map((step, i) => (
              <ChainOfThoughtStep key={i} label={step} status="complete" />
            ))}
          </ChainOfThoughtContent>
        </ChainOfThought>
      );

    // ==================== CONTEXT ====================
    case 'context':
      return (
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.04] px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-400/60">Context</span>
            {part.tokens && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {(part.tokens.input ?? 0) + (part.tokens.output ?? 0)} tokens
              </span>
            )}
          </div>
          {part.content && (
            <p className="text-sm text-foreground/75 leading-relaxed">{part.content}</p>
          )}
        </div>
      );

    // ==================== AGENT ====================
    case 'agent':
      return (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/60">Agent</span>
            <span className="font-medium text-sm text-foreground/88">{part.name}</span>
          </div>
          {part.description && (
            <p className="text-sm text-muted-foreground">{part.description}</p>
          )}
        </div>
      );

    // ==================== OPEN IN ====================
    case 'open-in':
      return (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary hover:bg-primary/15 transition-colors"
          onClick={() => window.open(part.openInId, '_blank')}
        >
          <ArrowSquareOut className="h-3.5 w-3.5" />
          {part.text}
        </button>
      );

    // ==================== JSX PREVIEW ====================
    case 'jsx-preview':
      return (
        <div className="border rounded-lg overflow-hidden">
          {part.title && (
            <div className="px-4 py-2 bg-muted border-b flex items-center gap-2">
              <span className="text-xs font-medium">{part.title}</span>
            </div>
          )}
          <div className="p-4">
            <JSXPreview jsx={part.jsx} isStreaming={isStreaming && isLast}>
              <JSXPreviewContent />
              <JSXPreviewError />
            </JSXPreview>
          </div>
        </div>
      );

    // ==================== EMAIL DRAFT ====================
    case 'email-draft':
      return (
        <EmailDraft
          to={part.to}
          from={part.from}
          cc={part.cc}
          subject={part.subject}
          body={part.body}
        />
      );

    // ==================== SMS DRAFT ====================
    case 'sms-draft':
      return (
        <SMSDraft
          to={part.to}
          messages={part.messages}
        />
      );

    // ==================== RECIPE ====================
    case 'recipe':
      return (
        <RecipeDraft
          name={part.name}
          description={part.description}
          servings={part.servings}
          prepTimeMinutes={part.prepTimeMinutes}
          cookTimeMinutes={part.cookTimeMinutes}
          ingredients={part.ingredients}
          steps={part.steps}
          imageUrl={part.imageUrl}
        />
      );

    // ==================== IMAGE SEARCH ====================
    case 'image-search':
      return (
        <ImageSearchTool
          query={part.query}
          results={part.results}
        />
      );

    // ==================== APP RECOMMENDATIONS ====================
    case 'app-recommendations':
      return (
        <AppRecommendations
          title={part.title}
          apps={part.apps}
        />
      );

    // ==================== MODEL COMPARISON ====================
    case 'model-comparison':
      return (
        <ModelComparison
          title={part.title}
          models={part.models}
          features={part.features}
          variant={part.variant}
        />
      );

    // ==================== MOCK CHAT ====================
    case 'mock-chat':
      return (
        <MockChat
          style={part.style}
          messages={part.messages}
        />
      );

    // ==================== LEVEE WIZARD ====================
    case 'levee-wizard':
      return (
        <LeveeWizard
          title={part.title}
          subtitle={part.subtitle}
          steps={part.steps}
        />
      );

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
            fontFamily: 'var(--font-mono)',
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
              fontFamily: 'var(--font-mono)',
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

// Recursive renderer for file-tree nodes using library FileTree components
type FileTreeNodeShape = Extract<ExtendedUIPart, { type: 'file-tree' }>['root'];

function renderFileTreeNodes(nodes: FileTreeNodeShape[], basePath = ''): React.ReactNode {
  return nodes.map((node) => {
    const path = `${basePath}/${node.name}`;
    if (node.type === 'directory') {
      return (
        <FileTreeFolder key={path} path={path} name={node.name}>
          {node.children && renderFileTreeNodes(node.children, path)}
        </FileTreeFolder>
      );
    }
    return <FileTreeFile key={path} path={path} name={node.name} />;
  });
}

export default UnifiedMessageRenderer;
