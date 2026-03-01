import React, { useState, useMemo } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { CaretDown, Check, Rocket, MagnifyingGlass, Gear, TerminalWindow, Brain, Cpu, Sparkle } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { OpenAIIcon, AnthropicIcon, GoogleIcon, MetaIcon, OllamaIcon } from "../icons/ModelIcons";
import { useNav } from "../../nav/useNav";
import { useChatStore } from "../../views/chat/ChatStore";
import { Shield, ShieldSlash, Lock, LockOpen } from "@phosphor-icons/react";

export type ModelOption = {
  id: string;
  name: string;
  provider: string;
  category: 'CLI' | 'Cloud' | 'Local' | 'Synthetic';
  icon?: React.ReactNode;
  description?: string;
};

const ALL_MODELS: ModelOption[] = [
  { id: 'codex', name: 'OpenAI Codex', provider: 'Local', category: 'CLI', icon: <OpenAIIcon className="w-4 h-4" />, description: 'Local' },
  { id: 'claude-code', name: 'Claude Code', provider: 'Anthropic', category: 'CLI', icon: <AnthropicIcon className="w-4 h-4" />, description: 'ADE' },
  { id: 'aider', name: 'Aider AI', provider: 'Aider', category: 'CLI', icon: <TerminalWindow weight="fill" />, description: 'Agent' },
  { id: 'goose', name: 'Goose', provider: 'Block', category: 'CLI', icon: <Rocket weight="fill" />, description: 'Agent' },
  { id: 'cursor-cli', name: 'Cursor CLI', provider: 'Cursor', category: 'CLI', icon: <TerminalWindow weight="fill" />, description: 'ADE' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', category: 'Cloud', icon: <OpenAIIcon className="w-4 h-4" />, description: 'Cloud' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', category: 'Cloud', icon: <AnthropicIcon className="w-4 h-4" />, description: 'Cloud' },
  { id: 'ollama', name: 'Ollama', provider: 'Local', category: 'Local', icon: <OllamaIcon className="w-4 h-4" />, description: 'Local' },
];

export function PromptModelSelector({ 
    value, 
    onChange,
    className
}: { 
    value: string; 
    onChange: (id: string) => void;
    models?: ModelOption[];
    className?: string;
}) {
  const [search, setSearch] = useState('');
  const selected = ALL_MODELS.find(m => m.id === value) || ALL_MODELS[0];
  const sandboxMode = useChatStore(state => state.sandboxMode);
  const setSandboxMode = useChatStore(state => state.setSandboxMode);

  const filteredModels = useMemo(() => {
    return ALL_MODELS.filter(m => 
      m.name.toLowerCase().includes(search.toLowerCase()) || 
      m.provider.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const categories = ['CLI', 'Cloud', 'Local'] as const;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--rail-hover)] hover:bg-[var(--bg-secondary)] border border-[var(--border-subtle)] transition-all text-xs font-medium text-[var(--text-secondary)] group", className)}>
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
          className="w-[260px] rounded-xl bg-[var(--glass-bg-thick)] backdrop-blur-3xl border border-[var(--border-strong)] shadow-2xl p-0 z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
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

          <ScrollArea.Root className="flex-1 overflow-hidden" style={{ height: '200px' }}>
            <ScrollArea.Viewport className="w-full h-full p-1">
              {categories.map(cat => {
                const catModels = filteredModels.filter(m => m.category === cat);
                if (catModels.length === 0) return null;

                return (
                  <div key={cat} className="mb-1">
                    <div className="px-2 py-1 text-[9px] font-bold text-[var(--text-tertiary)] uppercase opacity-50 tracking-wider">
                      {cat}
                    </div>
                    {catModels.map(model => (
                      <Popover.Close asChild key={model.id}>
                        <button
                          onClick={() => onChange(model.id)}
                          className={cn(
                            "flex w-full items-center gap-3 px-2 py-1.5 rounded-lg text-xs text-left transition-all hover:bg-[var(--accent-chat)] hover:text-white group",
                            value === model.id ? "bg-[var(--rail-hover)]" : ""
                          )}
                        >
                          <div className={cn(
                              "flex items-center justify-center w-6 h-6 rounded bg-[var(--bg-secondary)] text-[var(--text-tertiary)] group-hover:bg-white/20 group-hover:text-white transition-all",
                              value === model.id && "text-[var(--accent-chat)]"
                          )}>
                            {model.icon}
                          </div>
                          <div className="flex-1 truncate font-medium transition-colors">
                            {model.name}
                          </div>
                          {value === model.id && <Check size={14} weight="bold" className="text-[var(--accent-chat)] group-hover:text-white" />}
                        </button>
                      </Popover.Close>
                    ))}
                  </div>
                );
              })}
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar className="flex select-none touch-none p-0.5 bg-transparent w-1.5" orientation="vertical">
              <ScrollArea.Thumb className="flex-1 bg-[var(--border-strong)] rounded-full opacity-30" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>

          
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
<div className="flex-none p-1.5 bg-[var(--bg-secondary)]/50 border-t border-[var(--border-subtle)]">
            <button 
              onClick={() => useNav.getState().dispatch({ type: 'OPEN_VIEW', viewType: 'models-manage' })}
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
