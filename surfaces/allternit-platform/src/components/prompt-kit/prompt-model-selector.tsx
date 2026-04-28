import React, { useState, useMemo } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import {
  CaretDown, Check, Rocket, MagnifyingGlass, Gear, TerminalWindow,
  Brain, CloudArrowDown, ArrowSquareOut, Warning,
} from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { OpenAIIcon, AnthropicIcon } from "../icons/ModelIcons";
import { useNav } from "../../nav/useNav";
import { useChatStore } from "../../views/chat/ChatStore";
import { Lock, LockOpen } from "@phosphor-icons/react";
import { useLocalBrainStatus } from "../../hooks/useLocalBrainStatus";

export type ModelOption = {
  id: string;
  name: string;
  provider: string;
  category: 'CLI' | 'Cloud' | 'Local' | 'Synthetic';
  icon?: React.ReactNode;
  description?: string;
  isLocalBrain?: boolean;
};

const BASE_MODELS: ModelOption[] = [
  { id: 'codex', name: 'OpenAI Codex', provider: 'Local', category: 'CLI', icon: <OpenAIIcon className="w-4 h-4" />, description: 'Local' },
  { id: 'claude-code', name: 'Claude Code', provider: 'Anthropic', category: 'CLI', icon: <AnthropicIcon className="w-4 h-4" />, description: 'ADE' },
  { id: 'aider', name: 'Aider AI', provider: 'Aider', category: 'CLI', icon: <TerminalWindow weight="fill" />, description: 'Agent' },
  { id: 'goose', name: 'Goose', provider: 'Block', category: 'CLI', icon: <Rocket weight="fill" />, description: 'Agent' },
  { id: 'cursor-cli', name: 'Cursor CLI', provider: 'Cursor', category: 'CLI', icon: <TerminalWindow weight="fill" />, description: 'ADE' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', category: 'Cloud', icon: <OpenAIIcon className="w-4 h-4" />, description: 'Cloud' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', category: 'Cloud', icon: <AnthropicIcon className="w-4 h-4" />, description: 'Cloud' },
  {
    id: 'local-brain',
    name: 'Local Brain',
    provider: 'Local',
    category: 'Local',
    icon: <Brain weight="fill" className="w-4 h-4" />,
    description: 'Offline · private',
    isLocalBrain: true,
  },
];

interface PullProgress { status: string; total?: number; completed?: number }
type DownloadState = 'idle' | 'pulling' | 'done' | 'error';

export function PromptModelSelector({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  models?: ModelOption[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);

  const { ollamaRunning, modelReady, refresh } = useLocalBrainStatus({ pollOnFocus: false });
  const sandboxMode = useChatStore(state => state.sandboxMode);
  const setSandboxMode = useChatStore(state => state.setSandboxMode);

  const ALL_MODELS = BASE_MODELS;
  const selected = ALL_MODELS.find(m => m.id === value) || ALL_MODELS[0];

  const filteredModels = useMemo(() =>
    ALL_MODELS.filter(m =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.provider.toLowerCase().includes(search.toLowerCase())
    ), [search]);

  const categories = ['CLI', 'Cloud', 'Local'] as const;

  const pullPct = pullProgress?.total && pullProgress.completed
    ? Math.round((pullProgress.completed / pullProgress.total) * 100)
    : null;

  async function startDownload() {
    setDownloadState('pulling');
    setPullProgress(null);
    setPullError(null);
    try {
      const res = await fetch('/api/local-brain', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setPullError(err.error ?? 'Download failed');
        setDownloadState('error');
        return;
      }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev: PullProgress & { error?: string } = JSON.parse(line.slice(6));
            setPullProgress(ev);
            if (ev.status === 'success' || ev.status === 'done') {
              setDownloadState('done');
              await refresh();
              onChange('local-brain');
              setTimeout(() => setOpen(false), 800);
            } else if (ev.status === 'error') {
              setDownloadState('error');
              setPullError(ev.error ?? 'Download failed');
            }
          } catch {}
        }
      }
    } catch (err) {
      setDownloadState('error');
      setPullError(String(err));
    }
  }

  function handleModelClick(model: ModelOption) {
    if (model.isLocalBrain) {
      if (modelReady) {
        onChange(model.id);
        setOpen(false);
      } else if (!ollamaRunning) {
        // Stay open — user sees the Ollama-not-running state in the list
      } else {
        startDownload();
      }
      return;
    }
    onChange(model.id);
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--rail-hover)] hover:bg-[var(--bg-secondary)] border border-[var(--border-subtle)] transition-all text-xs font-medium text-[var(--text-secondary)] group",
          className
        )}>
          <span className="text-[var(--accent-chat)]">{selected.icon}</span>
          <span>{selected.name}</span>
          <CaretDown size={12} className="opacity-50 group-hover:opacity-100" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          className="w-[280px] rounded-xl bg-[var(--glass-bg-thick)] backdrop-blur-3xl border border-[var(--border-strong)] shadow-2xl p-0 z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Search */}
          <div className="flex-none p-2 border-b border-[var(--border-subtle)] flex items-center gap-2">
            <MagnifyingGlass size={14} className="text-[var(--text-tertiary)]" />
            <input
              autoFocus
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            />
          </div>

          {/* Download in progress — replaces list */}
          {downloadState === 'pulling' ? (
            <div className="flex-1 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-[var(--accent-chat)] shrink-0" />
                <span className="text-xs font-semibold text-[var(--text-primary)]">Downloading Local Brain</span>
                {pullPct !== null && (
                  <span className="text-xs text-[var(--accent-chat)] ml-auto">{pullPct}%</span>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--accent-chat)] transition-all duration-300"
                  style={{ width: pullPct !== null ? `${pullPct}%` : '5%' }}
                />
              </div>
              <p className="text-[10px] text-[var(--text-tertiary)]">
                {pullProgress?.status ?? 'Preparing…'} · llama3.2:3b (~2 GB)
              </p>
            </div>
          ) : downloadState === 'done' ? (
            <div className="flex-1 p-4 flex items-center gap-3">
              <Check size={16} weight="bold" className="text-emerald-500 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">Local Brain ready</p>
                <p className="text-[10px] text-[var(--text-tertiary)]">Selecting it now…</p>
              </div>
            </div>
          ) : downloadState === 'error' ? (
            <div className="flex-1 p-4 flex items-start gap-3">
              <Warning size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">Download failed</p>
                <p className="text-[10px] text-[var(--text-tertiary)] mb-2">{pullError}</p>
                <button
                  onClick={() => setDownloadState('idle')}
                  className="text-[10px] font-semibold text-[var(--accent-chat)] hover:underline"
                >
                  Back to models
                </button>
              </div>
            </div>
          ) : (
            /* Normal model list */
            <ScrollArea.Root className="flex-1 overflow-hidden" style={{ height: '220px' }}>
              <ScrollArea.Viewport className="w-full h-full p-1">
                {categories.map(cat => {
                  const catModels = filteredModels.filter(m => m.category === cat);
                  if (catModels.length === 0) return null;
                  return (
                    <div key={cat} className="mb-1">
                      <div className="px-2 py-1 text-[9px] font-bold text-[var(--text-tertiary)] uppercase opacity-50 tracking-wider">
                        {cat === 'Local' ? 'Local Brain' : cat}
                      </div>
                      {catModels.map(model => {
                        const isSelected = value === model.id;
                        const isLB = model.isLocalBrain;
                        const lbReady = isLB && modelReady;
                        const lbNoOllama = isLB && !ollamaRunning;
                        const lbNeedsDownload = isLB && ollamaRunning && !modelReady;

                        return (
                          <button
                            key={model.id}
                            onClick={() => handleModelClick(model)}
                            disabled={lbNoOllama}
                            className={cn(
                              "flex w-full items-center gap-3 px-2 py-1.5 rounded-lg text-xs text-left transition-all group",
                              lbNoOllama
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-[var(--accent-chat)] hover:text-white",
                              isSelected ? "bg-[var(--rail-hover)]" : ""
                            )}
                          >
                            <div className={cn(
                              "flex items-center justify-center w-6 h-6 rounded bg-[var(--bg-secondary)] text-[var(--text-tertiary)] transition-all",
                              !lbNoOllama && "group-hover:bg-white/20 group-hover:text-white",
                              isSelected && "text-[var(--accent-chat)]",
                              lbReady && "text-emerald-500"
                            )}>
                              {model.icon}
                            </div>
                            <div className="flex-1 truncate">
                              <span className={cn("font-medium", lbReady && "text-emerald-500")}>
                                {model.name}
                              </span>
                              {isLB && (
                                <span className={cn(
                                  "ml-1.5 text-[9px] font-bold px-1 py-0.5 rounded",
                                  lbReady
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : lbNoOllama
                                      ? "bg-amber-500/10 text-amber-500"
                                      : "bg-[var(--accent-chat)]/10 text-[var(--accent-chat)]"
                                )}>
                                  {lbReady ? 'Ready' : lbNoOllama ? 'Install Ollama' : '~2 GB'}
                                </span>
                              )}
                            </div>
                            {isLB && lbNoOllama && (
                              <a
                                href="https://ollama.com/download"
                                target="_blank"
                                rel="noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-[var(--accent-chat)] hover:underline"
                              >
                                <ArrowSquareOut size={12} />
                              </a>
                            )}
                            {isLB && lbNeedsDownload && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-[var(--accent-chat)] group-hover:text-white">
                                <CloudArrowDown size={11} /> Download
                              </span>
                            )}
                            {isSelected && !isLB && (
                              <Check size={14} weight="bold" className="text-[var(--accent-chat)] group-hover:text-white" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar className="flex select-none touch-none p-0.5 bg-transparent w-1.5" orientation="vertical">
                <ScrollArea.Thumb className="flex-1 bg-[var(--border-strong)] rounded-full opacity-30" />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
          )}

          {/* Governance footer */}
          <div className="flex-none p-2 bg-[var(--bg-secondary)]/30 border-t border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase">Governance</span>
              <span className={cn("text-[10px] font-bold tracking-tight", sandboxMode === "full" ? "text-red-500 animate-pulse" : "text-emerald-500")}>
                {sandboxMode === "full" ? "FULL WRITE ACCESS" : "READ ONLY (PROTECTED)"}
              </span>
            </div>
            <button
              onClick={() => setSandboxMode(sandboxMode === "full" ? "read-only" : "full")}
              className={cn(
                "px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all shadow-sm border",
                sandboxMode === "full"
                  ? "bg-red-500/20 text-red-500 border-red-500/30 hover:bg-red-500/30"
                  : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
              )}
            >
              {sandboxMode === "full" ? <LockOpen size={14} weight="bold" /> : <Lock size={14} weight="bold" />}
              <span className="text-[9px] font-bold">TOGGLE</span>
            </button>
          </div>

          {/* Manage link */}
          <div className="flex-none p-1.5 bg-[var(--bg-secondary)]/50 border-t border-[var(--border-subtle)]">
            <button
              onClick={() => { useNav.getState().dispatch({ type: 'OPEN_VIEW', viewType: 'models-manage' }); setOpen(false); }}
              className="w-full flex items-center justify-center gap-2 py-1.5 rounded-md hover:bg-[var(--rail-hover)] text-[10px] font-bold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all"
            >
              <Gear size={12} weight="fill" />
              MANAGE
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
