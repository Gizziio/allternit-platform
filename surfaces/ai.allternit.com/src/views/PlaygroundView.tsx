"use client";

import React, { useCallback, useRef } from "react";
import { 
  Play, 
  Trash, 
  Plus, 
  Terminal, 
  Sparkle, 
  Code, 
  Database, 
  FileText, 
  Layout, 
  MonitorPlay, 
  ChevronDown, 
  ChevronRight, 
  X, 
  Maximize2 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlaygroundManager } from "./playground/main/usePlaygroundManager";
import { ArtifactPreview } from "./playground/main/ArtifactPreview";
import { ToggleSwitch } from "./playground/main/ToggleSwitch";
import { TEMPLATES } from "./playground/main/PlaygroundView.constants";
import type { Message, LeftTab, RightTab } from "./playground/main/PlaygroundView.types";
import { AGENT_MODELS } from "@/lib/agents/agent-models";

export function PlaygroundView() {
  const {
    activeTemplate,
    currentTemplate,
    systemPrompt,
    setSystemPrompt,
    messages,
    temperature,
    setTemperature,
    maxTokens,
    setMaxTokens,
    model,
    setModel,
    systemExpanded,
    setSystemExpanded,
    isStreaming,
    streamText,
    artifact,
    leftTab,
    setLeftTab,
    rightTab,
    setRightTab,
    splitPos,
    setSplitPos,
    applyTemplate,
    handleRun,
    addMessage,
    updateMessage,
    removeMessage,
  } = usePlaygroundManager();

  const isDragging = useRef(false);
  const splitRef = useRef<HTMLDivElement>(null);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (em: MouseEvent) => {
      if (!isDragging.current || !splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const pos = ((em.clientX - rect.left) / rect.width) * 100;
      setSplitPos(Math.max(20, Math.min(80, pos)));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [setSplitPos]);

  return (
    <div 
      ref={splitRef}
      className="flex h-full w-full bg-[var(--surface-canvas)] overflow-hidden relative isolate"
    >
      {/* ── Left Pane: Prompts & Config ── */}
      <div 
        className="flex flex-col border-r border-solid border-[var(--ui-border-muted)] bg-[var(--bg-secondary,#111113)] min-w-0"
        style={{ width: `${splitPos}%` }}
      >
        <div className="flex items-center gap-1 p-2 px-3 border-b border-solid border-[var(--ui-border-muted)] shrink-0">
          <TabButton active={leftTab === 'prompt'} onClick={() => setLeftTab('prompt')} icon={Terminal} label="Prompt" />
          <TabButton active={leftTab === 'templates'} onClick={() => setLeftTab('templates')} icon={Layout} label="Templates" />
          <TabButton active={leftTab === 'config'} onClick={() => setLeftTab('config')} icon={Database} label="Config" />
          
          <div className="ml-auto">
            <button type="button"
              onClick={handleRun}
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-lg border-none font-bold text-[13px] cursor-pointer transition-all duration-200 shadow-lg active:scale-95",
                isStreaming 
                  ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" 
                  : "bg-[var(--accent-primary)] text-[var(--surface-canvas)] hover:opacity-90"
              )}
            >
              {isStreaming ? (
                <>
                  <div className="size-2 bg-red-500 rounded-full animate-pulse" />
                  Stop
                </>
              ) : (
                <>
                  <Play size={14} fill="currentColor" />
                  Run
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {leftTab === 'prompt' && (
            <div className="p-5 flex flex-col gap-6 animate-in fade-in slide-in-from-left-2 duration-300">
              {/* System Prompt */}
              <div className={cn("flex flex-col rounded-xl border border-solid transition-all duration-200 overflow-hidden", systemExpanded ? "border-[var(--accent-primary)]/30 bg-black/10 shadow-inner" : "border-[var(--ui-border-muted)] bg-transparent")}>
                <button type="button" 
                  onClick={() => setSystemExpanded(!systemExpanded)}
                  className="flex items-center gap-2 p-3 bg-transparent border-none text-[12px] font-bold text-[var(--ui-text-secondary)] uppercase tracking-[0.08em] cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <Sparkle size={14} className={systemExpanded ? "text-[var(--accent-primary)]" : "text-[var(--ui-text-muted)]"} />
                  <span>System Instruction</span>
                  {systemExpanded ? <ChevronDown size={14} className="ml-auto" /> : <ChevronRight size={14} className="ml-auto" />}
                </button>
                {systemExpanded && (
                  <textarea aria-label="Text Area" value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full min-h-[140px] p-4 bg-transparent border-none text-[14px] text-[var(--ui-text-primary)] font-mono resize-none focus:outline-none leading-relaxed"
                    placeholder="Set the context and behavioral guidelines for the AI…"
                  />
                )}
              </div>

              {/* Message List */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[var(--ui-text-muted)] uppercase tracking-[0.08em]">Messages</span>
                  <button type="button" 
                    onClick={() => addMessage('user')}
                    className="p-1 px-2.5 rounded-lg border border-solid border-[var(--ui-border-muted)] bg-transparent text-[11px] font-bold text-[var(--ui-text-secondary)] cursor-pointer hover:bg-[var(--surface-hover)] transition-all"
                  >
                    + Add Message
                  </button>
                </div>
                
                {messages.map((msg, idx) => (
                  <MessageCard 
                    key={msg.id} 
                    message={msg} 
                    index={idx}
                    onUpdate={(val) => updateMessage(msg.id, val)}
                    onRemove={() => removeMessage(msg.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {leftTab === 'templates' && (
            <div className="p-5 grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
              {TEMPLATES.map(tpl => (
                <button type="button"
                  key={tpl.id}
                  onClick={() => applyTemplate(tpl.id)}
                  className={cn(
                    "flex flex-col items-start p-4 rounded-xl border border-solid text-left transition-all duration-200 group cursor-pointer",
                    activeTemplate === tpl.id
                      ? "bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/40 shadow-sm"
                      : "bg-[var(--surface-hover)] border-transparent hover:border-[var(--ui-border-muted)] hover:bg-[var(--surface-active)]"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[14px] text-[var(--ui-text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">{tpl.label}</span>
                    {activeTemplate === tpl.id && <div className="size-1.5 rounded-full bg-[var(--accent-primary)]" />}
                  </div>
                  <span className="text-[12px] text-[var(--ui-text-secondary)] leading-relaxed">{tpl.description}</span>
                </button>
              ))}
            </div>
          )}

          {leftTab === 'config' && (
            <div className="p-6 flex flex-col gap-8 animate-in fade-in slide-in-from-left-2 duration-300">
              <ConfigSection title="Model Parameters">
                <ConfigItem label="Model">
                  <select aria-label="Selection" value={model} 
                    onChange={e => setModel(e.target.value)}
                    className="w-full bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] rounded-lg p-2 text-[13px] text-[var(--ui-text-primary)] outline-none focus:border-[var(--accent-primary)] transition-colors"
                  >
                    {AGENT_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </ConfigItem>
                <ConfigItem label={`Temperature: ${temperature}`}>
                  <input aria-label="Input" type="range" min="0" max="1" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full accent-[var(--accent-primary)]" />
                </ConfigItem>
                <ConfigItem label={`Max Tokens: ${maxTokens}`}>
                  <input aria-label="Input" type="range" min="256" max="16384" step="256" value={maxTokens} onChange={e => setMaxTokens(parseInt(e.target.value))} className="w-full accent-[var(--accent-primary)]" />
                </ConfigItem>
              </ConfigSection>

              <ConfigSection title="Workbench Settings">
                <div className="flex flex-col gap-4">
                  <ToggleSwitch on={true} onChange={() => {}} label="Auto-Reload Preview" />
                  <ToggleSwitch on={true} onChange={() => {}} label="Strict CSP Sandboxing" />
                  <ToggleSwitch on={false} onChange={() => {}} label="Preserve State on Run" />
                </div>
              </ConfigSection>
            </div>
          )}
        </div>
      </div>

      {/* ── Split Handle ── */}
      <div 
        className="w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-[var(--accent-primary)]/30 active:bg-[var(--accent-primary)]/50 transition-colors z-10"
        onMouseDown={handleDividerMouseDown}
      />

      {/* ── Right Pane: Preview & Tools ── */}
      <div 
        className="flex flex-col bg-[var(--surface-canvas)] min-w-0"
        style={{ width: `${100 - splitPos}%` }}
      >
        <div className="flex items-center gap-1 p-2 px-3 border-b border-solid border-[var(--ui-border-muted)] shrink-0">
          <TabButton active={rightTab === 'preview'} onClick={() => setRightTab('preview')} icon={MonitorPlay} label="Preview" />
          <TabButton active={rightTab === 'source'} onClick={() => setRightTab('source')} icon={Code} label="Source" />
          <TabButton active={rightTab === 'console'} onClick={() => setRightTab('console')} icon={Terminal} label="Console" />
          
          {artifact && (
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] shadow-sm">
                <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ui-text-primary)]">{artifact.type}</span>
              </div>
              <button type="button" className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] transition-all">
                <Maximize2 size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden relative flex flex-col">
          {rightTab === 'preview' && (
            <div className="flex-1 flex flex-col animate-in fade-in zoom-in-95 duration-500">
              <ArtifactPreview artifact={artifact} />
            </div>
          )}

          {rightTab === 'source' && (
            <div className="flex-1 overflow-y-auto p-0 animate-in fade-in slide-in-from-right-4 duration-400">
              <pre className="m-0 p-6 text-[13px] font-mono text-[#d1c3b4] bg-[#0c0a09] min-h-full leading-relaxed selection:bg-[var(--accent-primary)]/30">
                <code>{artifact?.content || '// No source code available'}</code>
              </pre>
            </div>
          )}

          {rightTab === 'console' && (
            <div className="flex-1 flex flex-col bg-black overflow-hidden animate-in fade-in duration-300">
              <div className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed selection:bg-white/20">
                <div className="text-zinc-500 mb-2 select-none"># AI Streaming Terminal Output</div>
                {streamText ? (
                  <div className="text-zinc-300 whitespace-pre-wrap">
                    {streamText}
                    {isStreaming && <span className="inline-block w-2 h-4 bg-[var(--accent-primary)] ml-0.5 animate-pulse align-middle" />}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full opacity-40 grayscale gap-4 text-center">
                    <Terminal size={48} strokeWidth={1} />
                    <p className="text-[12px] max-w-[200px]">Waiting for model execution… logs will appear here during run.</p>
                  </div>
                )}
              </div>
              
              <div className="p-2.5 px-4 bg-zinc-900 border-t border-solid border-zinc-800 text-[11px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-between">
                <span>Allternit Runtime v2.4</span>
                <span>{isStreaming ? 'Streaming' : 'Ready'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Internal Sub-components ───

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-none text-[12px] font-bold cursor-pointer transition-all duration-150 whitespace-nowrap",
        active 
          ? "bg-[var(--surface-hover)] text-[var(--ui-text-primary)] shadow-sm" 
          : "bg-transparent text-[var(--ui-text-muted)] hover:bg-white/5 hover:text-[var(--ui-text-secondary)]"
      )}
    >
      <Icon size={14} className={active ? "text-[var(--accent-primary)]" : "text-inherit"} />
      {label}
    </button>
  );
}

function MessageCard({ message, index, onUpdate, onRemove }: { message: Message; index: number; onUpdate: (val: string) => void; onRemove: () => void }) {
  const isAssistant = message.role === 'assistant';
  return (
    <div className={cn(
      "group relative flex flex-col rounded-xl border border-solid transition-all duration-200",
      isAssistant ? "bg-[var(--surface-hover)] border-transparent" : "bg-transparent border-[var(--ui-border-muted)]"
    )}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-solid border-[var(--ui-border-muted)]/50 shrink-0">
        <span className={cn(
          "text-[10px] font-black uppercase tracking-[0.12em]",
          isAssistant ? "text-purple-400" : "text-blue-400"
        )}>
          {message.role}
        </span>
        <button type="button" 
          onClick={onRemove}
          className="size-5 flex items-center justify-center rounded-md bg-transparent border-none text-[var(--ui-text-muted)] opacity-0 group-hover:opacity-100 cursor-pointer hover:bg-red-500/10 hover:text-red-500 transition-all"
        >
          <X size={12} />
        </button>
      </div>
      <textarea aria-label="Text Area" value={message.content}
        onChange={(e) => onUpdate(e.target.value)}
        className="w-full min-h-[80px] p-3.5 bg-transparent border-none text-[14px] text-[var(--ui-text-primary)] resize-none focus:outline-none leading-relaxed font-sans"
        placeholder={isAssistant ? "AI response…" : "User message…"}
      />
    </div>
  );
}

function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-[12px] font-bold text-[var(--ui-text-muted)] uppercase tracking-[0.1em] whitespace-nowrap">{title}</span>
        <div className="flex-1 h-px bg-[var(--ui-border-muted)] opacity-30" />
      </div>
      <div className="flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}

function ConfigItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[12px] font-medium text-[var(--ui-text-secondary)]">{label}</div>
      {children}
    </div>
  );
}

export default PlaygroundView;
