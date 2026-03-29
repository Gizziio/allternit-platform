/**
 * CoworkStreamBlock — Renders gizzi-code native Part types as streaming work blocks.
 *
 * Works off NativeAgentStore.parts[sessionId][messageId] which are populated
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

import React, { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Brain,
  CaretDown,
  CaretRight,
  CheckCircle,
  CircleNotch,
  Code,
  FileText,
  GitDiff,
  ListBullets,
  Terminal,
  Warning,
  X,
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
    <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
      {part.text}
    </div>
  );
});

// ============================================================================
// ReasoningBlock — collapsible
// ============================================================================

const ReasoningBlock = memo(function ReasoningBlock({ part }: { part: ReasoningPart }) {
  const [open, setOpen] = useState(false);
  const preview = part.summary || part.text?.slice(0, 80) || 'Thinking…';

  return (
    <div className="border border-white/5 rounded-lg bg-black/20 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/40 hover:text-white/60 transition-colors"
      >
        <Brain className="w-3.5 h-3.5 text-purple-400/60 shrink-0" />
        <span className="flex-1 text-left truncate">{preview}</span>
        {open ? (
          <CaretDown className="w-3 h-3 shrink-0" />
        ) : (
          <CaretRight className="w-3 h-3 shrink-0" />
        )}
      </button>
      {open && part.text && (
        <div className="px-3 pb-3 text-xs text-white/40 leading-relaxed border-t border-white/5 pt-2 whitespace-pre-wrap">
          {part.text}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// ToolBlock — 4-state: pending / running / completed / error
// ============================================================================

const TOOL_ICONS: Record<string, React.FC<{ className?: string }>> = {
  bash: Terminal,
  glob: ListBullets,
  grep: ListBullets,
  read: FileText,
  write: FileText,
  edit: FileText,
  default: Code,
};

function statusColor(status: PartStatus) {
  switch (status) {
    case 'pending': return 'text-white/30 bg-white/5';
    case 'running': return 'text-blue-400 bg-blue-500/10';
    case 'completed': return 'text-green-400 bg-green-500/10';
    case 'error': return 'text-red-400 bg-red-500/10';
  }
}

function StatusIcon({ status }: { status: PartStatus }) {
  switch (status) {
    case 'pending': return <CircleNotch className="w-3.5 h-3.5 text-white/20" />;
    case 'running': return <CircleNotch className="w-3.5 h-3.5 text-blue-400 animate-spin" />;
    case 'completed': return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
    case 'error': return <X className="w-3.5 h-3.5 text-red-400" />;
  }
}

const ToolBlock = memo(function ToolBlock({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(false);
  const { state, tool } = part;
  const IconComp = TOOL_ICONS[tool] ?? TOOL_ICONS.default;
  const title = state.title || tool;
  const colorClass = statusColor(state.status);

  return (
    <div className="border border-white/5 rounded-lg bg-[#1a1a1a] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className={cn('w-7 h-7 rounded-md flex items-center justify-center shrink-0', colorClass)}>
          <IconComp className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <span className="text-sm text-white/70 font-medium">{title}</span>
          {state.status === 'running' && (
            <span className="ml-2 text-xs text-blue-400/60">Running…</span>
          )}
        </div>
        <StatusIcon status={state.status} />
        {open ? (
          <CaretDown className="w-3.5 h-3.5 text-white/20 ml-1" />
        ) : (
          <CaretRight className="w-3.5 h-3.5 text-white/20 ml-1" />
        )}
      </button>

      {open && (
        <div className="border-t border-white/5 px-3 py-2 space-y-2">
          {state.input && (
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Input</p>
              <pre className="text-xs text-white/50 bg-black/30 rounded p-2 overflow-x-auto">
                {JSON.stringify(state.input, null, 2)}
              </pre>
            </div>
          )}
          {state.output && (
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Output</p>
              <pre className="text-xs text-white/50 bg-black/30 rounded p-2 overflow-x-auto max-h-48">
                {state.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
  const p = part as AnyPart;

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
