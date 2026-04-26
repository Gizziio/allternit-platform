/**
 * CoworkRightRail - Right side panel for Cowork mode
 * Screenshot-matched rail: Progress / Working Folder / Context
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useCoworkStore } from './CoworkStore';
import { useCoworkSessionStore } from './CoworkSessionStore';
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

function dispatchCompose(text: string, send = false): void {
  if (typeof window === 'undefined') return;
  const detail: ComposeEventDetail = { text, send };
  window.dispatchEvent(new CustomEvent<ComposeEventDetail>('allternit:cowork-compose', { detail }));
}

function buildProgressSteps(taskStatus?: string): ProgressStep[] {
  const status = taskStatus ?? 'pending';
  if (status === 'completed') {
    return [
      { id: 'session-started', label: 'Session started', status: 'complete' },
      { id: 'task-completed', label: 'Task completed', status: 'complete' },
    ];
  }
  if (status === 'in_progress') {
    return [
      { id: 'session-started', label: 'Session started', status: 'complete' },
      { id: 'working', label: 'Working on task', status: 'active' },
      { id: 'awaiting-next-step', label: 'Awaiting next step', status: 'pending' },
    ];
  }
  return [
    { id: 'session-started', label: 'Session started', status: 'complete' },
    { id: 'gathering-context', label: 'Gathering context', status: 'active' },
    { id: 'awaiting-next-step', label: 'Awaiting next step', status: 'pending' },
  ];
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
  const { tasks, activeTaskId } = useCoworkStore();
  const activeTask = tasks.find((t) => t.id === activeTaskId);

  const activeSession = useCoworkSessionStore((state) =>
    state.activeSessionId ? state.sessions.find((s) => s.id === state.activeSessionId) ?? null : null
  );

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
    const raw = window.localStorage.getItem('allternit-cowork-connectors');
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
    window.localStorage.setItem('allternit-cowork-connectors', JSON.stringify(enabledConnectors));
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

  const steps = useMemo(() => buildProgressSteps(activeTask?.status), [activeTask?.status]);
  const activeStep = useMemo(() => steps.find((step) => step.status === 'active'), [steps]);

  // Fallbacks for workspace telemetry (to be wired to store)
  const sessionMeta = activeSession?.metadata as Record<string, unknown> | undefined;
  const workingFolder = useMemo(() => sessionMeta?.workspacePath as string | undefined, [sessionMeta]);
  const touchedFiles = useMemo(() => (sessionMeta?.touchedFiles as string[] | undefined) ?? [], [sessionMeta]);
  const fileCount = useMemo(() => (sessionMeta?.fileCount as number | undefined) ?? 0, [sessionMeta]);
  const commandCount = useMemo(() => (sessionMeta?.commandCount as number | undefined) ?? 0, [sessionMeta]);
  const toolCalls = useMemo(() => (sessionMeta?.toolCalls as Array<unknown> | undefined) ?? [], [sessionMeta]);

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
