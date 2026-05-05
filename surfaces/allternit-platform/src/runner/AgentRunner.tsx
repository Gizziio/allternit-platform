"use client";

import React, { useState, useRef, useEffect } from "react";
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
} from '@phosphor-icons/react';
import { GizziMascot } from "@/components/ai-elements/GizziMascot";
import { ContextWindowCard } from "@/components/ai-elements/ContextWindowCard";

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

// CSS animations for Gizzi mascot
const mascotAnimations: Record<string, React.CSSProperties> = {
  focused: { animation: 'gizzi-pulse 2s ease-in-out infinite' },
  pleased: { animation: 'gizzi-bounce 1.5s ease-in-out infinite' },
  curious: { animation: 'gizzi-sway 2s ease-in-out infinite' },
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
      return <Wrench {...iconProps} style={{ color: THEME.accent }} />;
    case 'info':
      return <Info {...iconProps} style={{ color: 'var(--status-info)' }} />;
    case 'error':
      return <Warning {...iconProps} style={{ color: 'var(--status-error)' }} />;
    case 'success':
      return <CheckCircle {...iconProps} style={{ color: 'var(--status-success)' }} />;
    default:
      return <Info {...iconProps} style={{ color: THEME.textMuted }} />;
  }
}

// Get status indicator component
function getStatusIndicator(status: TraceEntry['status']) {
  switch (status) {
    case 'running':
      return (
        <div style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: THEME.accent,
          animation: 'pulse-dot 1.5s ease-in-out infinite',
        }} />
      );
    case 'success':
      return <CheckCircle size={12} style={{ color: 'var(--status-success)' }} />;
    case 'error':
      return <Warning size={12} style={{ color: 'var(--status-error)' }} />;
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
      style={{
        marginLeft: 38,
        marginBottom: 4,
        background: entry.status === 'error' 
          ? 'var(--status-error-bg)' 
          : entry.status === 'success'
          ? 'var(--status-success-bg)'
          : 'var(--surface-hover)',
        borderRadius: '8px',
        border: `1px solid ${entry.status === 'error' 
          ? 'color-mix(in srgb, var(--status-error) 20%, transparent)' 
          : entry.status === 'success'
          ? 'var(--status-success-bg)'
          : 'var(--ui-border-muted)'}`,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header row */}
      <div
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          cursor: hasDetails ? 'pointer' : 'default',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        {/* Expand/collapse chevron (only if has details) */}
        {hasDetails ? (
          <CaretRight 
            size={14} 
            style={{
              color: THEME.textMuted,
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              flexShrink: 0,
            }}
          />
        ) : (
          <div style={{ width: 14, flexShrink: 0 }} />
        )}

        {/* Kind icon */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: 20,
          height: 20,
          borderRadius: '4px',
          background: 'var(--surface-active)',
          flexShrink: 0,
        }}>
          {getKindIcon(entry.kind)}
        </div>

        {/* Status indicator */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: 16,
          flexShrink: 0,
        }}>
          {getStatusIndicator(entry.status)}
        </div>

        {/* Title */}
        <div style={{ 
          flex: 1,
          minWidth: 0,
          color: entry.status === 'error' ? 'var(--status-error)' : THEME.textSecondary, 
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {entry.title}
        </div>

        {/* Timestamp */}
        <div style={{ 
          color: THEME.textMuted, 
          fontSize: 10,
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {relativeTime}
        </div>
      </div>

      {/* Details section (collapsible) */}
      {hasDetails && isExpanded && (
        <div
          style={{
            padding: '0 12px 10px 54px',
            animation: 'slideDown 0.2s ease',
          }}
        >
          <div
            style={{
              padding: '8px 10px',
              background: 'var(--surface-hover)',
              borderRadius: '6px',
              color: THEME.textMuted,
              fontSize: 11,
              lineHeight: 1.5,
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              borderLeft: `2px solid ${statusColor}`,
            }}
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
    <div style={{
      margin: '0 0 16px 38px',
      padding: '16px',
      background: 'var(--surface-floating)',
      borderRadius: '12px',
      border: '1px solid var(--ui-border-default)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      animation: 'slideDown 0.3s ease',
      boxShadow: '0 4px 20px var(--surface-hover)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Robot size={16} color={THEME.accent} />
          <span style={{ fontSize: 13, fontWeight: 600, color: THEME.textPrimary }}>Proposed Operator Plan</span>
        </div>
        <div style={{ 
          fontSize: 10, 
          padding: '2px 8px', 
          borderRadius: '99px', 
          background: plan.risk === 'high' ? 'var(--status-error-bg)' : 'var(--status-success-bg)',
          color: plan.risk === 'high' ? 'var(--status-error)' : 'var(--status-success)',
          fontWeight: 700,
          textTransform: 'uppercase'
        }}>
          {plan.risk} Risk
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '200px', overflowY: 'auto' }}>
        {plan.steps.map((step: any, idx: number) => (
          <div key={step.id} style={{ display: 'flex', gap: 10 }}>
            <div style={{ 
              width: 18, 
              height: 18, 
              borderRadius: '50%', 
              background: step.status === 'completed' ? 'var(--status-success)' : 'var(--ui-border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 700,
              color: step.status === 'completed' ? 'var(--ui-text-inverse)' : THEME.textMuted,
              flexShrink: 0
            }}>
              {step.status === 'completed' ? <Check size={10} strokeWidth={4} /> : idx + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: THEME.textPrimary }}>{step.title}</div>
              {step.description && <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>{step.description}</div>}
              {step.backend && (
                <div style={{ fontSize: 9, color: THEME.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  via {step.backend.replace('_', ' ')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button 
          onClick={onReject}
          style={{ 
            flex: 1, 
            padding: '8px', 
            borderRadius: '8px', 
            background: 'var(--surface-hover)', 
            border: '1px solid var(--ui-border-default)',
            color: THEME.textPrimary,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
        <button 
          onClick={onApprove}
          style={{ 
            flex: 2, 
            padding: '8px', 
            borderRadius: '8px', 
            background: THEME.accent, 
            border: 'none',
            color: 'var(--ui-text-inverse)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}
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
    context
  } = useRunnerStore();
  const [input, setInput] = useState("");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [selectedModel, setSelectedModel] = useState({ id: 'kimi/kimi-for-coding', name: 'Kimi K2.5' });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Load session on mount (once)
  useEffect(() => {
    loadSession();
  }, [loadSession]);
  
  useEffect(() => {
    setInput(draft);
  }, [draft]);
  
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
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: THEME.bg,
        borderRadius: '16px',
        border: `1px solid ${THEME.border}`,
        boxShadow: '0 25px 80px var(--shell-overlay-backdrop)',
        overflow: 'hidden',
      }}>
        {/* Header drag area */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: THEME.inputBg,
          borderBottom: `1px solid ${THEME.border}`,
          ...({'WebkitAppRegion': 'drag'} as React.CSSProperties),
        }}>
          <span style={{ color: THEME.textMuted, fontSize: 11 }}>Agent Runner</span>
          <button 
            onClick={close}
            style={{ 
              padding: '4px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: THEME.textMuted,
              ...({'WebkitAppRegion': 'no-drag'} as React.CSSProperties),
              borderRadius: '6px',
            }}
          >
            <X size={14} />
          </button>
        </div>
        
        {/* Input Container - Compact */}
        <div style={{ 
          flex: 1,
          padding: '16px', 
          background: THEME.bg,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}>
          {/* Input Box */}
          <div style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-end',
            padding: '12px 14px',
            background: THEME.inputBg,
            borderRadius: '16px',
            border: `1px solid ${agentEnabled ? AGENT_THEME.glow : THEME.inputBorder}`,
            boxShadow: agentEnabled ? `0 0 0 1px ${AGENT_THEME.soft}` : 'none',
            transition: 'all 0.2s ease',
          }}>
            {/* Gizzi Mascot / Agent Toggle */}
            <button 
              onClick={() => setAgentEnabled(!agentEnabled)}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: agentEnabled ? AGENT_THEME.soft : 'transparent',
                border: `1px solid ${agentEnabled ? AGENT_THEME.accent : THEME.inputBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.2s ease',
              }}
              title={agentEnabled ? 'Agent Mode On' : 'Agent Mode Off'}
            >
              {agentEnabled ? (
                <div style={{ marginTop: 2, ...mascotAnimations.focused }}>
                  <div className="gizzi-focused"><GizziMascot size={32} emotion="focused" /></div>
                </div>
              ) : (
                <Robot size={20} color={THEME.textMuted} />
              )}
            </button>
            
            {/* Plus / Attachment Button */}
            <button
              onClick={() => document.getElementById('file-input')?.click()}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'transparent',
                border: 'none',
                color: THEME.textSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title="Add attachment"
            >
              <Plus size={18} />
            </button>
            <input
              id="file-input"
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  const fileNames = Array.from(files).map(f => f.name).join(', ');
                  setInput(prev => prev + (prev ? '\n' : '') + `[Attached: ${fileNames}]`);
                }
              }}
            />
            
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={agentEnabled ? "Agent mode - What shall we work on?" : "What's on your mind?"}
              disabled={isLoading}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: THEME.textPrimary,
                fontSize: '15px',
                resize: 'none',
                padding: '8px 0',
                minHeight: 24,
                maxHeight: 100,
                fontFamily: 'inherit',
              }}
            />
            
            {/* Model selector */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowModelMenu(!showModelMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 10px',
                  borderRadius: '999px',
                  background: showModelMenu ? THEME.hoverBg : 'transparent',
                  border: 'none',
                  color: THEME.textSecondary,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                  flexShrink: 0,
                }}
              >
                <span>{selectedModel.name}</span>
                <CaretDown size={12} style={{ transform: showModelMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.6 }} />
              </button>
              
              {/* Model Dropdown Menu */}
              {showModelMenu && (
                <>
                  <div
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 50,
                    }}
                    onClick={() => setShowModelMenu(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '4px',
                      backgroundColor: THEME.inputBg,
                      border: `1px solid ${THEME.border}`,
                      borderRadius: '8px',
                      padding: '4px',
                      minWidth: '160px',
                      zIndex: 51,
                      boxShadow: 'var(--shadow-md)',
                    }}
                  >
                    {[
                      { id: 'kimi/kimi-for-coding', name: 'Kimi K2.5' },
                      { id: 'gpt-4o', name: 'GPT-4o' },
                      { id: 'claude-3', name: 'Claude 3.5 Sonnet' },
                    ].map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model);
                          setShowModelMenu(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: selectedModel.id === model.id ? 'var(--ui-border-muted)' : 'transparent',
                          color: THEME.textPrimary,
                          fontSize: '13px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span>{model.name}</span>
                        {selectedModel.id === model.id && <Check size={14} color={AGENT_THEME.accent} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            
            {isLoading ? (
              <button
                onClick={cancel}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--surface-active)',
                  border: `1px solid ${THEME.inputBorder}`,
                  color: THEME.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'var(--transition-fast)',
                }}
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: input.trim() ? THEME.accent : 'var(--ui-border-muted)',
                  border: 'none',
                  color: input.trim() ? 'var(--ui-text-inverse)' : THEME.textMuted,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: input.trim() ? 'pointer' : 'default',
                  flexShrink: 0,
                  transition: 'var(--transition-fast)',
                }}
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
          
          {/* Bottom toolbar - Matching ChatComposer exactly */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 10,
            padding: '0 4px',
          }}>
            {/* Agent Toggle Button - EXACTLY like ChatComposer */}
            <button
              onClick={() => setAgentEnabled(!agentEnabled)}
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 999,
                border: `1px solid ${agentEnabled ? AGENT_THEME.glow : THEME.inputBorder}`,
                background: agentEnabled ? AGENT_THEME.soft : 'transparent',
                color: agentEnabled ? AGENT_THEME.accent : THEME.textSecondary,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Robot size={14} />
              {agentEnabled ? 'Agent On' : 'Agent Off'}
            </button>
            
            <div style={{ 
              color: agentEnabled ? AGENT_THEME.accent : THEME.textMuted, 
              fontSize: 11,
            }}>
              {agentEnabled ? 'Agent will use tools' : 'Direct chat mode'}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Expanded mode - full chat view
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: THEME.bg,
      borderRadius: '16px',
      border: `1px solid ${THEME.border}`,
      boxShadow: '0 25px 80px var(--shell-overlay-backdrop)',
      overflow: 'hidden',
    }}>
      {animationStyle}
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: THEME.inputBg,
        borderBottom: `1px solid ${THEME.border}`,
        ...({'WebkitAppRegion': 'drag'} as React.CSSProperties),
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ContextWindowCard>
            <button style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="gizzi-focused"><GizziMascot size={28} emotion="focused" /></div>
              <span style={{ color: THEME.textPrimary, fontSize: 14, fontWeight: 600 }}>
                Agent Session
              </span>
            </button>
          </ContextWindowCard>
          {isLoading && (
            <span style={{ color: AGENT_THEME.accent, fontSize: 12 }}>
              <span style={{ animation: 'pulse 1s infinite' }}>● running</span>
            </span>
          )}
        </div>
        <button 
          onClick={close}
          style={{ 
            padding: '6px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: THEME.textMuted,
            ...({'WebkitAppRegion': 'no-drag'} as React.CSSProperties),
            borderRadius: '6px',
          }}
        >
          <X size={18} />
        </button>
      </div>
      
      {/* Chat Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* User Message */}
        {activeRun && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: THEME.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--ui-text-inverse)',
              flexShrink: 0,
            }}>
              U
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: THEME.textMuted, fontSize: 11, marginBottom: 4 }}>You</div>
              <div style={{
                padding: '10px 14px',
                background: THEME.inputBg,
                borderRadius: '12px',
                color: THEME.textPrimary,
                fontSize: 14,
                lineHeight: 1.5,
                wordBreak: 'break-word',
              }}>
                {activeRun.prompt}
              </div>
            </div>
          </div>
        )}
        
        {/* AI Response */}
        {(activeRun?.output || isLoading) && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: AGENT_THEME.soft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              ...mascotAnimations[isLoading ? 'focused' : 'pleased'],
            }}>
              <div className={isLoading ? "gizzi-focused" : "gizzi-pleased"}><GizziMascot size={20} emotion={isLoading ? "focused" : "pleased"} /></div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: THEME.textMuted, fontSize: 11, marginBottom: 4 }}>Assistant</div>
              <div style={{
                padding: '10px 14px',
                background: THEME.inputBg,
                borderRadius: '12px',
                color: THEME.textPrimary,
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {activeRun?.output || (
                  <span style={{ color: THEME.textMuted }}>
                    <span style={{ animation: 'pulse 1s infinite' }}>Thinking</span>
                    <span style={{ animation: 'pulse 1s infinite 0.2s' }}>.</span>
                    <span style={{ animation: 'pulse 1s infinite 0.4s' }}>.</span>
                    <span style={{ animation: 'pulse 1s infinite 0.6s' }}>.</span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 38, marginTop: 4 }}>
            <div style={{
              width: 14,
              height: 14,
              border: '2px solid var(--ui-border-default)',
              borderTopColor: THEME.accent,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <span style={{ fontSize: 11, color: THEME.textMuted, fontWeight: 500 }}>
              Operator is working...
            </span>
          </div>
        )}
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Container */}
      <div style={{ 
        padding: '12px 16px 16px', 
        background: THEME.bg,
        borderTop: `1px solid ${THEME.border}`,
      }}>
        {/* Input Box */}
        <div style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          padding: '12px 14px',
          background: THEME.inputBg,
          borderRadius: '16px',
          border: `1px solid ${agentEnabled ? AGENT_THEME.glow : THEME.inputBorder}`,
          boxShadow: agentEnabled ? `0 0 0 1px ${AGENT_THEME.soft}` : 'none',
          transition: 'all 0.2s ease',
        }}>
          {/* Gizzi Mascot */}
          <button 
            onClick={() => setAgentEnabled(!agentEnabled)}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: agentEnabled ? AGENT_THEME.soft : 'transparent',
              border: `1px solid ${agentEnabled ? AGENT_THEME.accent : THEME.inputBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.2s ease',
            }}
          >
            {agentEnabled ? (
              <div style={{ marginTop: 2, ...mascotAnimations[isLoading ? 'focused' : 'pleased'] }}>
                <div className={isLoading ? "gizzi-focused" : "gizzi-pleased"}><GizziMascot size={32} emotion={isLoading ? "focused" : "pleased"} /></div>
              </div>
            ) : (
              <Robot size={20} color={THEME.textMuted} />
            )}
          </button>
          
          {/* Plus / Attachment Button */}
          <button
            onClick={() => document.getElementById('file-input-expanded')?.click()}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'transparent',
              border: 'none',
              color: THEME.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title="Add attachment"
          >
            <Plus size={18} />
          </button>
          <input
            id="file-input-expanded"
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) {
                const fileNames = Array.from(files).map(f => f.name).join(', ');
                setInput(prev => prev + (prev ? '\n' : '') + `[Attached: ${fileNames}]`);
              }
            }}
          />
          
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={agentEnabled ? "Agent mode - Continue the conversation..." : "Reply..."}
            disabled={isLoading}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: THEME.textPrimary,
              fontSize: '15px',
              resize: 'none',
              padding: '8px 0',
              minHeight: 24,
              maxHeight: 100,
              fontFamily: 'inherit',
            }}
          />
          
          {/* Model selector */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowModelMenu(!showModelMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 10px',
                borderRadius: '999px',
                background: showModelMenu ? THEME.hoverBg : 'transparent',
                border: 'none',
                color: THEME.textSecondary,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
                flexShrink: 0,
              }}
            >
              <span>{selectedModel.name}</span>
              <CaretDown size={12} style={{ transform: showModelMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.6 }} />
            </button>
            
            {/* Model Dropdown Menu */}
            {showModelMenu && (
              <>
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 50,
                  }}
                  onClick={() => setShowModelMenu(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    backgroundColor: THEME.inputBg,
                    border: `1px solid ${THEME.border}`,
                    borderRadius: '8px',
                    padding: '4px',
                    minWidth: '160px',
                    zIndex: 51,
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  {[
                    { id: 'kimi/kimi-for-coding', name: 'Kimi K2.5' },
                    { id: 'gpt-4o', name: 'GPT-4o' },
                    { id: 'claude-3', name: 'Claude 3.5 Sonnet' },
                  ].map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model);
                        setShowModelMenu(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: selectedModel.id === model.id ? 'var(--ui-border-muted)' : 'transparent',
                        color: THEME.textPrimary,
                        fontSize: '13px',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span>{model.name}</span>
                      {selectedModel.id === model.id && <Check size={14} color={AGENT_THEME.accent} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          
          {isLoading ? (
            <button
              onClick={cancel}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--surface-active)',
                border: `1px solid ${THEME.inputBorder}`,
                color: THEME.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'var(--transition-fast)',
              }}
            >
              <Square size={12} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: input.trim() ? THEME.accent : 'var(--ui-border-muted)',
                border: 'none',
                color: input.trim() ? 'var(--ui-text-inverse)' : THEME.textMuted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() ? 'pointer' : 'default',
                flexShrink: 0,
                transition: 'var(--transition-fast)',
              }}
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
        
        {/* Bottom toolbar - Matching ChatComposer exactly */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 10,
          padding: '0 4px',
        }}>
          {/* Agent Toggle Button - EXACTLY like ChatComposer */}
          <button
            onClick={() => setAgentEnabled(!agentEnabled)}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 999,
              border: `1px solid ${agentEnabled ? AGENT_THEME.glow : THEME.inputBorder}`,
              background: agentEnabled ? AGENT_THEME.soft : 'transparent',
              color: agentEnabled ? AGENT_THEME.accent : THEME.textSecondary,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <Robot size={14} />
            {agentEnabled ? 'Agent On' : 'Agent Off'}
          </button>
          
          <div style={{ 
            color: agentEnabled ? AGENT_THEME.accent : THEME.textMuted, 
            fontSize: 11,
          }}>
            {agentEnabled ? 'Agent will use tools and execute tasks' : 'Direct chat mode'}
          </div>
        </div>
      </div>
    </div>
  );
}
