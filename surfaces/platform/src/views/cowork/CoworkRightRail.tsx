/**
 * CoworkRightRail - Right side panel for Cowork mode
 * Screenshot-matched rail: Progress / Working Folder / Context
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useCoworkStore } from './CoworkStore';
import type { AnyCoworkEvent } from './cowork.types';
import {
  CheckCircle,
  Circle,
  CaretDown,
  CaretRight,
  FolderOpen,
  FileText,
  Globe,
  Terminal,
  HardDrive,
  Chat,
  Copy,
  Check,
} from '@phosphor-icons/react';

type StepStatus = 'complete' | 'active' | 'pending';

interface ProgressStep {
  id: string;
  label: string;
  status: StepStatus;
}

interface ComposeEventDetail {
  text: string;
  send?: boolean;
}

// Type guards for cowork events
import type { CommandEvent, FileEvent, ActionEvent, ToolCallEvent, CheckpointEvent, NarrationEvent } from './cowork.types';

function isCommandEvent(event: AnyCoworkEvent): event is CommandEvent {
  return event.type === 'cowork.command';
}

function isFileEvent(event: AnyCoworkEvent): event is FileEvent {
  return event.type === 'cowork.file';
}

function isActionEvent(event: AnyCoworkEvent): event is ActionEvent {
  return event.type === 'cowork.action';
}

function isToolCallEvent(event: AnyCoworkEvent): event is ToolCallEvent {
  return event.type === 'cowork.tool_call';
}

function isCheckpointEvent(event: AnyCoworkEvent): event is CheckpointEvent {
  return event.type === 'cowork.checkpoint';
}

function isNarrationEvent(event: AnyCoworkEvent): event is NarrationEvent {
  return event.type === 'cowork.narration';
}

function shortText(value: string, max = 56): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return '';
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3)}...`;
}

function toTitle(value: string): string {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function inferFolderFromPath(path?: string): string | null {
  if (!path) return null;
  const normalized = path.replace(/\\/g, '/').trim();
  const index = normalized.lastIndexOf('/');
  if (index <= 0) return null;
  return normalized.slice(0, index);
}

function summarizeProgressEvent(event: AnyCoworkEvent): string {
  switch (event.type) {
    case 'cowork.command': {
      if (!isCommandEvent(event)) return 'Ran terminal command';
      const command = event.commands?.[0];
      return command ? `Ran ${shortText(command, 52)}` : 'Ran terminal command';
    }
    case 'cowork.file': {
      if (!isFileEvent(event)) return 'Updated workspace files';
      const operation = toTitle(event.operation ?? 'Updated');
      const firstFile = event.files?.[0];
      const fileName = firstFile?.path ?? firstFile?.name;
      return fileName ? `${operation} ${shortText(fileName, 42)}` : `${operation} workspace files`;
    }
    case 'cowork.action': {
      if (!isActionEvent(event)) return 'Executed action';
      return shortText(event.humanReadable ?? `Executed ${event.actionType ?? 'action'}`, 56);
    }
    case 'cowork.tool_call': {
      if (!isToolCallEvent(event)) return 'Using tool';
      return `Using ${shortText(event.toolName ?? 'tool', 44)}`;
    }
    case 'cowork.tool_result':
      return 'Received tool results';
    case 'cowork.checkpoint': {
      if (!isCheckpointEvent(event)) return 'Saved checkpoint';
      return shortText(event.label ?? 'Saved checkpoint', 56);
    }
    case 'cowork.narration': {
      if (!isNarrationEvent(event)) return 'Updated analysis';
      return event.text ? shortText(event.text, 56) : 'Updated analysis';
    }
    default:
      return 'Updated session activity';
  }
}

function dispatchCompose(text: string, send = false): void {
  if (typeof window === 'undefined') return;
  const detail: ComposeEventDetail = { text, send };
  window.dispatchEvent(new CustomEvent<ComposeEventDetail>('a2r:cowork-compose', { detail }));
}

function buildProgressSteps(session: NonNullable<ReturnType<typeof useCoworkStore.getState>['session']>): ProgressStep[] {
  const workEvents = session.events.filter((event) =>
    event.type === 'cowork.command' ||
    event.type === 'cowork.file' ||
    event.type === 'cowork.action' ||
    event.type === 'cowork.tool_call' ||
    event.type === 'cowork.tool_result' ||
    event.type === 'cowork.checkpoint' ||
    event.type === 'cowork.narration',
  );

  if (workEvents.length === 0) {
    return [
      { id: 'session-started', label: 'Session started', status: 'complete' },
      { id: 'gathering-context', label: 'Gathering context for this task', status: 'active' },
      { id: 'awaiting-next-step', label: 'Awaiting next actionable step', status: 'pending' },
    ];
  }

  const recent = workEvents.slice(-2).map((event, idx) => ({
    id: `${event.id}-${idx}`,
    label: summarizeProgressEvent(event),
  }));

  const steps: ProgressStep[] = [
    { id: 'session-started', label: 'Session started', status: 'complete' },
    ...recent.map((entry) => ({
      id: entry.id,
      label: entry.label,
      status: 'pending' as StepStatus,
    })),
  ];

  const ended = session.status === 'completed' || session.status === 'error';
  return steps.map((step, index) => {
    if (index < steps.length - 1) {
      return { ...step, status: 'complete' as StepStatus };
    }
    return { ...step, status: ended ? 'complete' : 'active' };
  });
}

function collectTouchedFiles(events: AnyCoworkEvent[]): string[] {
  const seen = new Set<string>();
  for (const event of events) {
    if (!isFileEvent(event)) continue;
    for (const file of event.files) {
      const path = file.path || file.name;
      if (!path) continue;
      seen.add(path);
    }
  }
  return Array.from(seen.values());
}

interface RailCardProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const RailCard = memo(function RailCard({ title, open, onToggle, children }: RailCardProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] shadow-[0_0_0_1px_rgba(255,255,255,0.015)_inset]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-[12px] font-semibold text-white/80">{title}</span>
        {open ? <CaretDown className="w-4 h-4 text-white/50" /> : <CaretRight className="w-4 h-4 text-white/50" />}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </section>
  );
});

export const CoworkRightRail = memo(function CoworkRightRail() {
  const { session } = useCoworkStore();
  const [openCards, setOpenCards] = useState({
    progress: true,
    folder: true,
    context: true,
  });
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [enabledConnectors, setEnabledConnectors] = useState({
    webSearch: true,
    filesystem: true,
    terminal: true,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem('a2r-cowork-connectors');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<typeof enabledConnectors>;
      setEnabledConnectors((current) => ({ ...current, ...parsed }));
    } catch {
      // Ignore malformed persisted state
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('a2r-cowork-connectors', JSON.stringify(enabledConnectors));
  }, [enabledConnectors]);

  const toggleCard = useCallback((id: keyof typeof openCards) => {
    setOpenCards((current) => ({ ...current, [id]: !current[id] }));
  }, []);

  const toggleConnector = useCallback((id: keyof typeof enabledConnectors) => {
    setEnabledConnectors((current) => ({ ...current, [id]: !current[id] }));
  }, []);

  const handleCopyPath = useCallback(async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
      window.setTimeout(() => setCopiedPath((value) => (value === path ? null : value)), 1200);
    } catch {
      // Ignore clipboard failures silently
    }
  }, []);

  const steps = useMemo(() => (session ? buildProgressSteps(session) : []), [session]);
  const touchedFiles = useMemo(() => (session ? collectTouchedFiles(session.events) : []), [session]);

  const workingFolder = useMemo(() => {
    if (!session) return null;

    const latestCommandWithCwd = [...session.events]
      .reverse()
      .find((event): event is CommandEvent => 
        isCommandEvent(event) && typeof event.cwd === 'string'
      );

    if (latestCommandWithCwd) {
      return latestCommandWithCwd.cwd;
    }

    for (const filePath of touchedFiles) {
      const folder = inferFolderFromPath(filePath);
      if (folder) return folder;
    }

    return null;
  }, [session, touchedFiles]);

  const toolCalls = useMemo(
    () => (session ? session.events.filter((event) => event.type === 'cowork.tool_call') : []),
    [session],
  );
  const commandCount = useMemo(
    () => (session ? session.events.filter((event) => event.type === 'cowork.command').length : 0),
    [session],
  );
  const fileCount = useMemo(
    () => (session ? session.events.filter((event) => event.type === 'cowork.file').length : 0),
    [session],
  );

  const activeStep = useMemo(() => steps.find((step) => step.status === 'active'), [steps]);

  if (!session) return null;

  return (
    <div className="h-full overflow-y-auto p-2.5 space-y-2.5 text-[var(--text-primary,#ececec)]">
      <RailCard title="Progress" open={openCards.progress} onToggle={() => toggleCard('progress')}>
        <div className="space-y-2">
          {steps.map((step, index) => {
            const isComplete = step.status === 'complete';
            const isActive = step.status === 'active';
            return (
              <div key={step.id} className="flex items-start gap-2.5">
                <div className="mt-0.5">
                  {isComplete ? (
                    <CheckCircle className="w-4 h-4 text-blue-400" />
                  ) : isActive ? (
                    <div className="w-4 h-4 rounded-full border border-blue-400 text-[10px] leading-[14px] text-blue-300 text-center">
                      {index + 1}
                    </div>
                  ) : (
                    <Circle className="w-4 h-4 text-white/35" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'text-[12px] leading-4',
                      isComplete ? 'text-white/45 line-through' : isActive ? 'text-white/80' : 'text-white/50',
                    )}
                  >
                    {step.label}
                  </div>
                </div>
                {isActive && (
                  <button
                    type="button"
                    onClick={() => dispatchCompose(`Can you clarify this step: ${step.label}`)}
                    title="Ask a question or recommend a change"
                    className="mt-0.5 text-white/45 hover:text-white/80 transition-colors"
                  >
                    <Chat className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </RailCard>

      <RailCard title="Working Folder" open={openCards.folder} onToggle={() => toggleCard('folder')}>
        <div className="space-y-2.5">
          <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">
            <div className="flex items-start gap-2">
              <FolderOpen className="w-4 h-4 text-white/55 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] text-white/80 truncate">{workingFolder || 'Working folder pending'}</div>
                <div className="text-[10px] text-white/45 mt-0.5">View and open files created during this task.</div>
              </div>
            </div>
          </div>

          {touchedFiles.length > 0 ? (
            <div className="space-y-1.5">
              {touchedFiles.slice(0, 6).map((path) => {
                const copied = copiedPath === path;
                return (
                  <button
                    key={path}
                    type="button"
                    onClick={() => handleCopyPath(path)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md border border-white/5 bg-transparent hover:bg-white/[0.04] text-left transition-colors"
                    title={path}
                  >
                    <FileText className="w-3.5 h-3.5 text-white/45 shrink-0" />
                    <span className="flex-1 min-w-0 text-[11px] text-white/65 truncate">{path}</span>
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/35" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-white/45">No files captured for this task yet.</p>
          )}
        </div>
      </RailCard>

      <RailCard title="Context" open={openCards.context} onToggle={() => toggleCard('context')}>
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-white/45">Connectors</div>

          <button
            type="button"
            onClick={() => toggleConnector('webSearch')}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-md border border-white/5 hover:bg-white/[0.04] transition-colors"
          >
            <span className="flex items-center gap-2 text-[12px] text-white/75">
              <Globe className="w-3.5 h-3.5 text-white/55" />
              Web search
            </span>
            <span className={cn('text-[10px]', enabledConnectors.webSearch ? 'text-blue-300' : 'text-white/35')}>
              {enabledConnectors.webSearch ? 'On' : 'Off'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => toggleConnector('filesystem')}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-md border border-white/5 hover:bg-white/[0.04] transition-colors"
          >
            <span className="flex items-center gap-2 text-[12px] text-white/75">
              <HardDrive className="w-3.5 h-3.5 text-white/55" />
              Filesystem
            </span>
            <span className={cn('text-[10px]', enabledConnectors.filesystem ? 'text-blue-300' : 'text-white/35')}>
              {enabledConnectors.filesystem ? `${fileCount} events` : 'Off'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => toggleConnector('terminal')}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-md border border-white/5 hover:bg-white/[0.04] transition-colors"
          >
            <span className="flex items-center gap-2 text-[12px] text-white/75">
              <Terminal className="w-3.5 h-3.5 text-white/55" />
              Terminal
            </span>
            <span className={cn('text-[10px]', enabledConnectors.terminal ? 'text-blue-300' : 'text-white/35')}>
              {enabledConnectors.terminal ? `${commandCount} cmds` : 'Off'}
            </span>
          </button>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                const prompt = activeStep
                  ? `Continue this step and explain the next action: ${activeStep.label}`
                  : 'Recommend the next action for this cowork task.';
                dispatchCompose(prompt);
              }}
              className="w-full text-[11px] rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-white/70 hover:text-white/90 hover:bg-white/[0.06] transition-colors"
            >
              Ask a question or recommend a change
            </button>
          </div>

          {toolCalls.length > 0 && (
            <p className="text-[10px] text-white/40">Tools used: {toolCalls.length}</p>
          )}
        </div>
      </RailCard>
    </div>
  );
});

export default CoworkRightRail;
