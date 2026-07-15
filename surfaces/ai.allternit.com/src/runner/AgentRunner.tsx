"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useRunnerStore } from "./runner.store";
import {
  Plus,
  ArrowUp,
  X,
  Robot,
  CaretDown,
  Square,
  Check,
  Wrench,
  Info,
  Warning,
  CheckCircle,
  CaretRight,
  CircleNotch,
  Play,
  Cpu,
  Calendar,
} from '@phosphor-icons/react';
import { GizziMascot } from "@/components/ai-elements/GizziMascot";
import { ContextWindowCard } from "@/components/ai-elements/ContextWindowCard";
import { cn } from "@/lib/utils";
import { getDefaultAgentModel, getLatestAgentModel } from "@/lib/agents/agent-models";

// Compact model picker: the zen-tier free default plus the platform's
// current default and Anthropic models — derived from the registry so ids
// stay valid (this previously hardcoded 'gpt-4o' and a bare 'claude-3' that
// didn't even match its own "Claude 3.5 Sonnet" label).
const QUICK_MODEL_PICKS = [
  { id: 'kimi/kimi-for-coding', name: 'Kimi K2.5' },
  { id: getDefaultAgentModel().id, name: getDefaultAgentModel().name },
  { id: getLatestAgentModel('anthropic').id, name: getLatestAgentModel('anthropic').name },
];

const THEME = {
  bg: 'var(--surface-panel)',
  inputBg: 'var(--surface-hover)',
  textPrimary: 'var(--ui-text-primary)',
  textSecondary: 'var(--ui-text-secondary)',
  textMuted: 'var(--ui-text-muted)',
  accent: 'var(--accent-primary)',
  border: 'var(--ui-border-muted)',
  hoverBg: 'var(--surface-hover)',
  inputBorder: 'var(--ui-border-default)',
};

// Agent mode theme colors (matching ChatComposer exactly)
const AGENT_THEME = {
  accent: 'var(--status-success)',
  glow: 'color-mix(in srgb, var(--status-success) 40%, transparent)',
  soft: 'var(--status-success-bg)',
};

const GIZZI_ANIMATIONS = `
@keyframes gizzi-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
@keyframes gizzi-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes gizzi-sway {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
.gizzi-focused { animation: gizzi-pulse 2s ease-in-out infinite; }
.gizzi-pleased { animation: gizzi-bounce 1.5s ease-in-out infinite; }
.gizzi-curious { animation: gizzi-sway 2s ease-in-out infinite; }
`;

// Trace entry type definition
interface TraceEntry {
  id: string;
  timestamp: number;
  kind: 'tool' | 'info' | 'error' | 'success';
  title: string;
  detail?: string;
  status: 'running' | 'success' | 'error';
}

// Format timestamp to relative time (e.g., "2s ago")
function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// Get icon component based on entry kind
function getKindIcon(kind: TraceEntry['kind']) {
  const iconProps = { size: 12, strokeWidth: 2 };
  switch (kind) {
    case 'tool':
      return <Wrench {...iconProps} className="text-[var(--accent-primary)]" />;
    case 'info':
      return <Info {...iconProps} className="text-[var(--status-info)]" />;
    case 'error':
      return <Warning {...iconProps} className="text-[var(--status-error)]" />;
    case 'success':
      return <CheckCircle {...iconProps} className="text-[var(--status-success)]" />;
    default:
      return <Info {...iconProps} className="text-[var(--ui-text-muted)]" />;
  }
}

// Get status indicator component
function getStatusIndicator(status: TraceEntry['status']) {
  switch (status) {
    case 'running':
      return (
        <div className="size-1.5 rounded-full bg-[var(--accent-primary)] animate-[pulse-dot_1.5s_ease-in-out_infinite]" />
      );
    case 'success':
      return <CheckCircle size={12} className="text-[var(--status-success)]" />;
    case 'error':
      return <Warning size={12} className="text-[var(--status-error)]" />;
    default:
      return null;
  }
}

// Individual trace entry component with collapsible support
function TraceEntryItem({ entry }: { entry: TraceEntry }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [relativeTime, setRelativeTime] = useState(() => formatRelativeTime(entry.timestamp));

  // Update relative time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setRelativeTime(formatRelativeTime(entry.timestamp));
    }, 1000);
    return () => clearInterval(interval);
  }, [entry.timestamp]);

  const hasDetails = !!entry.detail;
  const statusColor = entry.status === 'error' ? 'var(--status-error)' 
    : entry.status === 'success' ? 'var(--status-success)' 
    : THEME.accent;

  return (
    <div
      className={cn(
        "ml-9 mb-1 rounded-lg border border-solid overflow-hidden transition-all duration-200",
        entry.status === 'error' ? "bg-[var(--status-error-bg)] border-[var(--status-error)]/20" :
        entry.status === 'success' ? "bg-[var(--status-success-bg)] border-[var(--status-success-bg)]" :
        "bg-[var(--surface-hover)] border-[var(--ui-border-muted)]"
      )}
    >
      {/* Header row */}
      <div role="button" tabIndex={0}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (hasDetails) setIsExpanded(!isExpanded); } }}
        className={cn(
          "flex items-center gap-2 p-[10px_12px] transition-colors duration-150",
          hasDetails ? "cursor-pointer hover:bg-[var(--surface-hover)]" : "cursor-default"
        )}
      >
        {/* Expand/collapse chevron (only if has details) */}
        {hasDetails ? (
          <CaretRight 
            size={14} 
            className={cn(
              "text-[var(--ui-text-muted)] transition-transform duration-200 shrink-0",
              isExpanded ? "rotate-90" : "rotate-0"
            )}
          />
        ) : (
          <div className="w-3.5 shrink-0" />
        )}

        {/* Kind icon */}
        <div className="flex items-center justify-center size-5 rounded bg-[var(--surface-active)] shrink-0">
          {getKindIcon(entry.kind)}
        </div>

        {/* Status indicator */}
        <div className="flex items-center justify-center w-4 shrink-0">
          {getStatusIndicator(entry.status)}
        </div>

        {/* Title */}
        <div className={cn(
          "flex-1 min-w-0 text-[12px] font-medium truncate",
          entry.status === 'error' ? "text-[var(--status-error)]" : "text-[var(--ui-text-secondary)]"
        )}>
          {entry.title}
        </div>

        {/* Timestamp */}
        <div className="text-[var(--ui-text-muted)] text-[12px] shrink-0 tabular-nums">
          {relativeTime}
        </div>
      </div>

      {/* Details section (collapsible) */}
      {hasDetails && isExpanded && (
        <div className="pl-[54px] pr-3 pb-2.5 animate-slideDown">
          <div
            className="p-[8px_10px] bg-[var(--surface-hover)] rounded-md text-[var(--ui-text-muted)] text-[12px] leading-relaxed font-mono whitespace-pre-wrap break-words"
            style={{ borderLeft: `2px solid ${statusColor}` }}
          >
            {entry.detail}
          </div>
        </div>
      )}
    </div>
  );
}

// Plan Preview Component for Thin Client Operator
function PlanPreview({ plan, onApprove, onReject }: { 
  plan: any; 
  onApprove: () => void; 
  onReject: () => void;
}) {
  return (
    <div className="mx-0 mb-4 ml-9 p-4 bg-[var(--surface-floating)] rounded-xl border border-solid border-[var(--ui-border-default)] flex flex-col gap-3 animate-slideDown shadow-[0_4px_20px_var(--surface-hover)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Robot size={16} className="text-[var(--accent-primary)]" />
          <span className="text-[13px] font-semibold text-[var(--ui-text-primary)]">Proposed Operator Plan</span>
        </div>
        <div className={cn(
          "text-[12px] px-2 py-0.5 rounded-full font-bold uppercase",
          plan.risk === 'high' ? "bg-[var(--status-error-bg)] text-[var(--status-error)]" : "bg-[var(--status-success-bg)] text-[var(--status-success)]"
        )}>
          {plan.risk} Risk
        </div>
      </div>

      <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
        {plan.steps.map((step: any, idx: number) => (
          <div key={step.id} className="flex gap-2.5">
            <div className={cn(
              "size-[18px] rounded-full flex items-center justify-center text-[12px] font-bold shrink-0",
              step.status === 'completed' ? "bg-[var(--status-success)] text-[var(--ui-text-inverse)]" : "bg-[var(--ui-border-default)] text-[var(--ui-text-muted)]"
            )}>
              {step.status === 'completed' ? <Check size={10} strokeWidth={4} /> : idx + 1}
            </div>
            <div className="flex-1">
              <div className="text-[12px] font-medium text-[var(--ui-text-primary)]">{step.title}</div>
              {step.description && <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5">{step.description}</div>}
              {step.backend && (
                <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5 uppercase tracking-wider font-semibold">
                  via {step.backend.replace('_', ' ')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-1">
        <button type="button" 
          onClick={onReject}
          className="flex-1 p-2 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-default)] text-[var(--ui-text-primary)] text-[12px] font-semibold cursor-pointer hover:bg-[var(--surface-active)] transition-colors"
        >
          Cancel
        </button>
        <button type="button" 
          onClick={onApprove}
          className="flex-[2] p-2 rounded-lg bg-[var(--accent-primary)] border-none text-[var(--ui-text-inverse)] text-[12px] font-bold cursor-pointer flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
        >
          <Check size={14} strokeWidth={3} />
          Execute Plan
        </button>
      </div>
    </div>
  );
}

export function AgentRunner() {

  const { 
    open, 
    draft, 
    setDraft, 
    submit, 
    isLoading, 
    cancel, 
    close, 
    activeRun, 
    trace, 
    agentEnabled, 
    setAgentEnabled, 
    loadSession,
    isPlanning,
    activePlan,
    approvePlan,
    rejectPlan,
  } = useRunnerStore();
  const [input, setInput] = useState("");
  const [prevDraft, setPrevDraft] = useState(draft);
  if (draft !== prevDraft) {
    setInput(draft);
    setPrevDraft(draft);
  }
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [selectedModel, setSelectedModel] = useState({ id: 'kimi/kimi-for-coding', name: 'Kimi K2.5' });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Load session on mount (once)
  useEffect(() => {
    loadSession();
  }, [loadSession]);
  
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.max(24, Math.min(textareaRef.current.scrollHeight, 100));
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [trace, activeRun?.output]);

  // Escape key to close the window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, close]);
  
  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    setDraft(input);
    submit();
    setInput("");
  };
  
  if (!open) return null;
  
  // Style tag for Gizzi animations
  const animationStyle = <style>{GIZZI_ANIMATIONS}</style>;
  
  const hasActiveSession = activeRun || isLoading;
  const isExpanded = hasActiveSession || isPlanning;
  
  // Compact mode - just input bar
  if (!isExpanded) {
    return (
      <div className="size-full flex flex-col bg-[var(--surface-panel)] rounded-2xl border border-solid border-[var(--ui-border-muted)] shadow-[0_25px_80px_var(--shell-overlay-backdrop)] overflow-hidden">
        {/* Header drag area */}
        <div 
          className="flex items-center justify-between p-2 px-3 bg-[var(--surface-hover)] border-b border-solid border-[var(--ui-border-muted)] select-none"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <span className="text-[var(--ui-text-muted)] text-[12px]">Agent Runner</span>
          <button type="button" 
            onClick={close}
            className="p-1 bg-transparent border-none cursor-pointer text-[var(--ui-text-muted)] hover:bg-[var(--surface-active)] rounded-md transition-colors"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <X size={14} />
          </button>
        </div>
        
        {/* Input Area */}
        <div className="p-3 px-4 bg-[var(--surface-panel)]">
          <div className={cn(
            "flex gap-2.5 items-end p-3 px-3.5 bg-[var(--surface-hover)] rounded-2xl border border-solid transition-all duration-200",
            agentEnabled ? "border-[var(--status-success)]/40 shadow-[0_0_0_1px_var(--status-success-bg)]" : "border-[var(--ui-border-default)]"
          )}>
            {/* Gizzi Mascot */}
            <button type="button" 
              onClick={() => setAgentEnabled(!agentEnabled)}
              className={cn(
                "size-[38px] rounded-full flex items-center justify-center cursor-pointer shrink-0 transition-all duration-200 border border-solid",
                agentEnabled ? "bg-[var(--status-success-bg)] border-[var(--status-success)]" : "bg-transparent border-[var(--ui-border-default)]"
              )}
            >
              {agentEnabled ? (
                <div className={cn("mt-0.5", isLoading ? "gizzi-focused" : "gizzi-pleased")}>
                  <GizziMascot size={32} emotion={isLoading ? "focused" : "pleased"} />
                </div>
              ) : (
                <Robot size={20} className="text-[var(--ui-text-muted)]" />
              )}
            </button>
            
            {/* Plus / Attachment Button */}
            <button type="button"
              onClick={() => document.getElementById('file-input')?.click()}
              className="size-8 rounded-full bg-transparent border-none text-[var(--ui-text-secondary)] flex items-center justify-center cursor-pointer shrink-0 hover:bg-[var(--surface-active)]"
              title="Add attachment"
            >
              <Plus size={18} />
            </button>
            <input
              id="file-input"
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  const fileNames = Array.from(files).map(f => f.name).join(', ');
                  setInput(prev => prev + (prev ? '\n' : '') + `[Attached: ${fileNames}]`);
                }
              }}
            />
            
            <textarea aria-label="Text Area" ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={agentEnabled ? "Agent mode - How can I help?" : "Ask or tell me something…"}
              className="flex-1 bg-transparent border-none outline-none text-[var(--ui-text-primary)] text-[15px] resize-none py-2 min-h-[24px] max-h-[100px] font-inherit"
            />
            
            {/* Model selector */}
            <div className="relative">
              <button type="button" 
                onClick={() => setShowModelMenu(!showModelMenu)}
                className={cn(
                  "flex items-center gap-1 p-[6px_10px] rounded-full border-none text-[var(--ui-text-secondary)] text-[13px] cursor-pointer transition-all shrink-0",
                  showModelMenu ? "bg-[var(--surface-hover)]" : "bg-transparent hover:bg-[var(--surface-active)]"
                )}
              >
                <span>{selectedModel.name}</span>
                <CaretDown size={12} className={cn("transition-transform duration-200 opacity-60", showModelMenu ? "rotate-180" : "rotate-0")} />
              </button>
              
              {/* Model Dropdown Menu */}
              {showModelMenu && (
                <>
                  <div role="button" tabIndex={0}
                    className="fixed inset-0 z-50"
                    onClick={() => setShowModelMenu(false)}
                    onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') setShowModelMenu(false); }}
                  />
                  <div className="absolute right-0 top-full mt-1 min-w-[160px] bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] rounded-lg p-1 z-[51] shadow-md">
                    {QUICK_MODEL_PICKS.map((model) => (
                      <button type="button"
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model);
                          setShowModelMenu(false);
                        }}
                        className={cn(
                          "flex items-center justify-between w-full p-2 px-3 rounded-md border-none text-[var(--ui-text-primary)] text-[13px] cursor-pointer text-left transition-colors",
                          selectedModel.id === model.id ? "bg-[var(--ui-border-muted)]" : "bg-transparent hover:bg-[var(--surface-active)]"
                        )}
                      >
                        <span>{model.name}</span>
                        {selectedModel.id === model.id && <Check size={14} className="text-[var(--status-success)]" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            
            {isLoading ? (
              <button type="button"
                onClick={cancel}
                className="size-8 rounded-full bg-[var(--surface-active)] border border-solid border-[var(--ui-border-default)] text-[var(--accent-primary)] flex items-center justify-center cursor-pointer shrink-0 transition-all hover:bg-[var(--surface-hover)]"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button type="button"
                onClick={handleSend}
                disabled={!input.trim()}
                className={cn(
                  "size-8 rounded-full border-none flex items-center justify-center shrink-0 transition-all",
                  input.trim() ? "bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] cursor-pointer hover:opacity-90" : "bg-[var(--ui-border-muted)] text-[var(--ui-text-muted)] cursor-default"
                )}
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
          
          {/* Bottom toolbar - Matching ChatComposer exactly */}
          <div className="flex items-center justify-between mt-2.5 px-1">
            {/* Agent Toggle Button - EXACTLY like ChatComposer */}
            <button type="button"
              onClick={() => setAgentEnabled(!agentEnabled)}
              className={cn(
                "inline-flex items-center gap-1.5 p-[6px_10px] rounded-full border border-solid text-[12px] font-bold cursor-pointer transition-all duration-200",
                agentEnabled ? "bg-[var(--status-success-bg)] border-[var(--status-success)]/40 text-[var(--status-success)]" : "bg-transparent border-[var(--ui-border-default)] text-[var(--ui-text-secondary)] hover:bg-[var(--surface-hover)]"
              )}
            >
              <Robot size={14} />
              {agentEnabled ? 'Agent On' : 'Agent Off'}
            </button>
            
            <div className={cn(
              "text-[12px] transition-colors",
              agentEnabled ? "text-[var(--status-success)]" : "text-[var(--ui-text-muted)]"
            )}>
              {agentEnabled ? 'Agent will use tools' : 'Direct chat mode'}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Expanded mode - full chat view
  return (
    <div className="size-full flex flex-col bg-[var(--surface-panel)] rounded-2xl border border-solid border-[var(--ui-border-muted)] shadow-[0_25px_80px_var(--shell-overlay-backdrop)] overflow-hidden">
      {animationStyle}
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 px-4 bg-[var(--surface-hover)] border-b border-solid border-[var(--ui-border-muted)] select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <ContextWindowCard>
            <button type="button" className="bg-transparent border-none p-0 cursor-pointer flex items-center gap-2">
              <div className="gizzi-focused"><GizziMascot size={28} emotion="focused" /></div>
              <span className="text-[var(--ui-text-primary)] text-sm font-semibold">
                Agent Session
              </span>
            </button>
          </ContextWindowCard>
          {isLoading && (
            <span className="text-[var(--status-success)] text-[12px]">
              <span className="animate-pulse">● running</span>
            </span>
          )}
        </div>
        <button type="button" 
          onClick={close}
          className="p-1.5 bg-transparent border-none cursor-pointer text-[var(--ui-text-muted)] hover:bg-[var(--surface-active)] rounded-md transition-colors"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <X size={18} />
        </button>
      </div>
      
      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* User Message */}
        {activeRun && (
          <div className="flex gap-2.5">
            <div className="size-7 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-[12px] font-bold text-[var(--ui-text-inverse)] shrink-0">
              U
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[var(--ui-text-muted)] text-[12px] mb-1">You</div>
              <div className="p-[10px_14px] bg-[var(--surface-hover)] rounded-xl text-[var(--ui-text-primary)] text-sm leading-relaxed break-words">
                {activeRun.prompt}
              </div>
            </div>
          </div>
        )}
        
        {/* AI Response */}
        {(activeRun?.output || isLoading) && (
          <div className="flex gap-2.5">
            <div className={cn(
              "size-7 rounded-full bg-[var(--status-success-bg)] flex items-center justify-center shrink-0",
              isLoading ? "gizzi-focused" : "gizzi-pleased"
            )}>
              <GizziMascot size={20} emotion={isLoading ? "focused" : "pleased"} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[var(--ui-text-muted)] text-[12px] mb-1">Assistant</div>
              <div className="p-[10px_14px] bg-[var(--surface-hover)] rounded-xl text-[var(--ui-text-primary)] text-sm leading-relaxed whitespace-pre-wrap break-words">
                {activeRun?.output || (
                  <span className="text-[var(--ui-text-muted)]">
                    <span className="animate-pulse">Thinking</span>
                    <span className="animate-pulse [animation-delay:0.2s]">.</span>
                    <span className="animate-pulse [animation-delay:0.4s]">.</span>
                    <span className="animate-pulse [animation-delay:0.6s]">.</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Trace entries */}
        {trace.map((entry: TraceEntry) => (
          <TraceEntryItem key={entry.id} entry={entry as unknown as TraceEntry} />
        ))}
        
        {/* Operator Plan Approval */}
        {isPlanning && activePlan && (
          <PlanPreview 
            plan={activePlan} 
            onApprove={approvePlan} 
            onReject={rejectPlan} 
          />
        )}
        
        {isLoading && !isPlanning && (
          <div className="flex items-center gap-2 ml-9 mt-1">
            <div className="size-3.5 border-2 border-solid border-[var(--ui-border-default)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
            <span className="text-[12px] text-[var(--ui-text-muted)] font-medium">
              Operator is working…
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Container */}
      <div className="p-[12px_16px_16px] bg-[var(--surface-panel)] border-t border-solid border-[var(--ui-border-muted)]">
        {/* Input Box */}
        <div className={cn(
          "flex gap-2.5 items-end p-[12px_14px] bg-[var(--surface-hover)] rounded-2xl border border-solid transition-all duration-200",
          agentEnabled ? "border-[var(--status-success)]/40 shadow-[0_0_0_1px_var(--status-success-bg)]" : "border-[var(--ui-border-default)]"
        )}>
          {/* Gizzi Mascot */}
          <button type="button" 
            onClick={() => setAgentEnabled(!agentEnabled)}
            className={cn(
              "size-[38px] rounded-full flex items-center justify-center cursor-pointer shrink-0 transition-all duration-200 border border-solid",
              agentEnabled ? "bg-[var(--status-success-bg)] border-[var(--status-success)]" : "bg-transparent border-[var(--ui-border-default)]"
            )}
          >
            {agentEnabled ? (
              <div className={cn("mt-0.5", isLoading ? "gizzi-focused" : "gizzi-pleased")}>
                <GizziMascot size={32} emotion={isLoading ? "focused" : "pleased"} />
              </div>
            ) : (
              <Robot size={20} className="text-[var(--ui-text-muted)]" />
            )}
          </button>
          
          {/* Plus / Attachment Button */}
          <button type="button"
            onClick={() => document.getElementById('file-input-expanded')?.click()}
            className="size-8 rounded-full bg-transparent border-none text-[var(--ui-text-secondary)] flex items-center justify-center cursor-pointer shrink-0 hover:bg-[var(--surface-active)]"
            title="Add attachment"
          >
            <Plus size={18} />
          </button>
          <input
            id="file-input-expanded"
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) {
                const fileNames = Array.from(files).map(f => f.name).join(', ');
                setInput(prev => prev + (prev ? '\n' : '') + `[Attached: ${fileNames}]`);
              }
            }}
          />
          
          <textarea aria-label="Text Area" ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={agentEnabled ? "Agent mode - Continue the conversation…" : "Reply…"}
            disabled={isLoading}
            className="flex-1 bg-transparent border-none outline-none text-[var(--ui-text-primary)] text-[15px] resize-none py-2 min-h-[24px] max-h-[100px] font-inherit"
          />
          
          {/* Model selector */}
          <div className="relative">
            <button type="button" 
              onClick={() => setShowModelMenu(!showModelMenu)}
              className={cn(
                "flex items-center gap-1 p-[6px_10px] rounded-full border-none text-[var(--ui-text-secondary)] text-[13px] cursor-pointer transition-all shrink-0",
                showModelMenu ? "bg-[var(--surface-hover)]" : "bg-transparent hover:bg-[var(--surface-active)]"
              )}
            >
              <span>{selectedModel.name}</span>
              <CaretDown size={12} className={cn("transition-transform duration-200 opacity-60", showModelMenu ? "rotate-180" : "rotate-0")} />
            </button>
            
            {/* Model Dropdown Menu */}
            {showModelMenu && (
              <>
                <div role="button" tabIndex={0}
                  className="fixed inset-0 z-50"
                  onClick={() => setShowModelMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 min-w-[160px] bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] rounded-lg p-1 z-[51] shadow-md">
                  {QUICK_MODEL_PICKS.map((model) => (
                    <button type="button"
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model);
                        setShowModelMenu(false);
                      }}
                      className={cn(
                        "flex items-center justify-between w-full p-2 px-3 rounded-md border-none text-[var(--ui-text-primary)] text-[13px] cursor-pointer text-left transition-colors",
                        selectedModel.id === model.id ? "bg-[var(--ui-border-muted)]" : "bg-transparent hover:bg-[var(--surface-active)]"
                      )}
                    >
                      <span>{model.name}</span>
                      {selectedModel.id === model.id && <Check size={14} className="text-[var(--status-success)]" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          
          {isLoading ? (
            <button type="button"
              onClick={cancel}
              className="size-8 rounded-full bg-[var(--surface-active)] border border-solid border-[var(--ui-border-default)] text-[var(--accent-primary)] flex items-center justify-center cursor-pointer shrink-0 transition-all hover:bg-[var(--surface-hover)]"
            >
              <Square size={12} fill="currentColor" />
            </button>
          ) : (
            <button type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              className={cn(
                "size-8 rounded-full border-none flex items-center justify-center shrink-0 transition-all",
                input.trim() ? "bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] cursor-pointer hover:opacity-90" : "bg-[var(--ui-border-muted)] text-[var(--ui-text-muted)] cursor-default"
              )}
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
