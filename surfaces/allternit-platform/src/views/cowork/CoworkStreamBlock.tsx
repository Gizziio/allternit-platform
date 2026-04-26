/**
 * CoworkStreamBlock — Renders gizzi-code native Part types as streaming work blocks.
 *
 * Works off CoworkStore.parts[sessionId][messageId] which are populated
 * via the part_updated / part_delta / part_removed SSE events.
 *
 * Part types supported:
 *   text        — streaming markdown (TextBlock)
 *   reasoning   — collapsible reasoning chain (ReasoningBlock)
 *   tool        — 4-state card: pending → running → completed | error (ToolBlock)
 *   subtask     — sub-task created by task tool (SubtaskBlock)
 *   file        — file reference (FileRefBlock)
 *   patch       — file diff summary (PatchBlock)
 *   step-start  — step divider (StepDivider)
 *   step-finish — step end marker (hidden)
 *   retry       — retry banner (RetryBanner)
 *   compaction  — context compaction notice (CompactionNotice)
 */

import React, { memo } from 'react';
import { Markdown } from '@/components/agent-elements/markdown';
import { ToolRenderer as AgentElementToolRenderer } from '@/components/agent-elements/tools/tool-renderer';
import {
  FileText,
  GitDiff,
  ListBullets,
  ArrowClockwise,
  Funnel,
} from '@phosphor-icons/react';

// ============================================================================
// Types — mirrors MessageV2.Part shapes from gizzi-code
// ============================================================================

type PartStatus = 'pending' | 'running' | 'completed' | 'error';

interface BasePart {
  id: string;
  type: string;
}

interface TextPart extends BasePart {
  type: 'text';
  text?: string;
}

interface ReasoningPart extends BasePart {
  type: 'reasoning';
  text?: string;
  summary?: string;
}

interface ToolState {
  status: PartStatus;
  input?: Record<string, unknown>;
  output?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  time?: { start?: number; end?: number };
}

interface ToolPart extends BasePart {
  type: 'tool';
  tool: string;
  state: ToolState;
}

interface SubtaskPart extends BasePart {
  type: 'subtask';
  title?: string;
  sessionID?: string;
}

interface FilePart extends BasePart {
  type: 'file';
  url?: string;
  filename?: string;
  mediaType?: string;
}

interface PatchPart extends BasePart {
  type: 'patch';
  file?: string;
  additions?: number;
  deletions?: number;
}

interface StepStartPart extends BasePart {
  type: 'step-start';
}

interface StepFinishPart extends BasePart {
  type: 'step-finish';
}

interface RetryPart extends BasePart {
  type: 'retry';
  error?: string;
}

interface CompactionPart extends BasePart {
  type: 'compaction';
  inputTokens?: number;
  outputTokens?: number;
}

type AnyPart =
  | TextPart
  | ReasoningPart
  | ToolPart
  | SubtaskPart
  | FilePart
  | PatchPart
  | StepStartPart
  | StepFinishPart
  | RetryPart
  | CompactionPart;

// ============================================================================
// TextBlock — streaming markdown
// ============================================================================

const TextBlock = memo(function TextBlock({ part }: { part: TextPart }) {
  if (!part.text) return null;
  return (
    <div className="text-sm text-white/80 leading-relaxed">
      <Markdown content={part.text} className="[&_p]:text-[15px] [&_p]:leading-7 [&_p]:text-[var(--ui-text-primary)] [&_ul]:text-[var(--ui-text-primary)] [&_ol]:text-[var(--ui-text-primary)]" />
    </div>
  );
});

// ============================================================================
// ReasoningBlock — collapsible
// ============================================================================

const ReasoningBlock = memo(function ReasoningBlock({ part }: { part: ReasoningPart }) {
  return (
    <AgentElementToolRenderer
      part={{
        type: 'tool-Thinking',
        toolCallId: part.id,
        input: {
          thought: part.summary || part.text || 'Thinking…',
        },
        output: part.text || part.summary || '',
        state: 'output-available',
      }}
    />
  );
});

// ============================================================================
// ToolBlock — 4-state: pending / running / completed / error
// ============================================================================

const ToolBlock = memo(function ToolBlock({ part }: { part: ToolPart }) {
  return <AgentElementToolRenderer part={toAgentElementToolPart(part)} />;
});

// ============================================================================
// SubtaskBlock
// ============================================================================

const SubtaskBlock = memo(function SubtaskBlock({ part }: { part: SubtaskPart }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/5 text-sm text-white/60">
      <ListBullets className="w-4 h-4 text-blue-400/60 shrink-0" />
      <span>{part.title || 'Subtask'}</span>
    </div>
  );
});

// ============================================================================
// FileRefBlock
// ============================================================================

const FileRefBlock = memo(function FileRefBlock({ part }: { part: FilePart }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/5 text-sm text-white/60">
      <FileText className="w-4 h-4 text-purple-400/60 shrink-0" />
      <span className="font-mono text-xs truncate">{part.filename || part.url || 'File'}</span>
    </div>
  );
});

// ============================================================================
// PatchBlock
// ============================================================================

const PatchBlock = memo(function PatchBlock({ part }: { part: PatchPart }) {
  const adds = part.additions ?? 0;
  const dels = part.deletions ?? 0;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/5 text-sm">
      <GitDiff className="w-4 h-4 text-yellow-400/60 shrink-0" />
      <span className="text-white/60 font-mono text-xs truncate">{part.file || 'patch'}</span>
      {(adds > 0 || dels > 0) && (
        <span className="ml-auto text-xs">
          {adds > 0 && <span className="text-green-400">+{adds}</span>}
          {dels > 0 && <span className="text-red-400 ml-1">-{dels}</span>}
        </span>
      )}
    </div>
  );
});

// ============================================================================
// StepDivider
// ============================================================================

const StepDivider = memo(function StepDivider() {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex-1 h-px bg-white/5" />
      <span className="text-[10px] text-white/20 uppercase tracking-widest">Step</span>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );
});

// ============================================================================
// RetryBanner
// ============================================================================

const RetryBanner = memo(function RetryBanner({ part }: { part: RetryPart }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/5 border border-yellow-500/10 text-xs text-yellow-400/70">
      <ArrowClockwise className="w-3.5 h-3.5 shrink-0" />
      <span>{part.error || 'Retrying…'}</span>
    </div>
  );
});

// ============================================================================
// CompactionNotice
// ============================================================================

const CompactionNotice = memo(function CompactionNotice({ part }: { part: CompactionPart }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-white/30">
      <Funnel className="w-3.5 h-3.5 shrink-0" />
      <span>
        Context compacted
        {part.inputTokens != null && ` · ${part.inputTokens.toLocaleString()} → ${(part.outputTokens ?? 0).toLocaleString()} tokens`}
      </span>
    </div>
  );
});

// ============================================================================
// Dispatcher
// ============================================================================

export const CoworkStreamBlock = memo(function CoworkStreamBlock({
  part,
}: {
  part: Record<string, unknown>;
}) {
  const p = part as unknown as AnyPart;

  switch (p.type) {
    case 'text':
      return <TextBlock part={p as TextPart} />;
    case 'reasoning':
      return <ReasoningBlock part={p as ReasoningPart} />;
    case 'tool':
      return <ToolBlock part={p as ToolPart} />;
    case 'subtask':
      return <SubtaskBlock part={p as SubtaskPart} />;
    case 'file':
      return <FileRefBlock part={p as FilePart} />;
    case 'patch':
      return <PatchBlock part={p as PatchPart} />;
    case 'step-start':
      return <StepDivider />;
    case 'step-finish':
      return null;
    case 'retry':
      return <RetryBanner part={p as RetryPart} />;
    case 'compaction':
      return <CompactionNotice part={p as CompactionPart} />;
    default:
      return null;
  }
});

// ============================================================================
// MessagePartList — renders all parts for a single message
// ============================================================================

export const MessagePartList = memo(function MessagePartList({
  parts,
}: {
  parts: Record<string, unknown>[];
}) {
  if (!parts.length) return null;

  return (
    <div className="space-y-1.5">
      {parts.map((part, i) => (
        <CoworkStreamBlock key={(part.id as string) ?? i} part={part} />
      ))}
    </div>
  );
});

function toAgentElementToolPart(part: ToolPart) {
  return {
    type: mapToolType(part.tool),
    toolCallId: part.id,
    input: part.state.input ?? {},
    output: normalizeToolOutput(part.state.output),
    state: mapToolState(part.state.status),
  };
}

function mapToolType(tool: string): string {
  switch (tool.toLowerCase()) {
    case 'bash':
    case 'shell':
    case 'command':
      return 'tool-Bash';
    case 'grep':
      return 'tool-Grep';
    case 'glob':
      return 'tool-Glob';
    case 'search':
    case 'websearch':
    case 'web-search':
      return 'tool-WebSearch';
    case 'edit':
      return 'tool-Edit';
    case 'write':
      return 'tool-Write';
    case 'read':
      return 'tool-Read';
    case 'plan':
    case 'planwrite':
      return 'tool-PlanWrite';
    case 'todo':
    case 'todowrite':
      return 'tool-TodoWrite';
    case 'question':
      return 'tool-Question';
    case 'agent':
    case 'task':
    case 'subagent':
      return 'tool-Agent';
    case 'thinking':
      return 'tool-Thinking';
    default:
      return `tool-${tool}`;
  }
}

function mapToolState(status: PartStatus): string {
  switch (status) {
    case 'completed':
      return 'output-available';
    case 'error':
      return 'output-error';
    case 'pending':
    case 'running':
    default:
      return 'input-streaming';
  }
}

function normalizeToolOutput(output?: string) {
  if (!output) return undefined;
  try {
    return JSON.parse(output);
  } catch {
    return output;
  }
}
