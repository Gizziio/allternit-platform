/**
 * Thinking Process Visualization - AgentGPT-inspired
 *
 * Shows the agent's thought process during task execution.
 * Displays reasoning, decisions, and intermediate steps.
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Lightbulb,
  Target,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  Search,
  Code2,
  FileText,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Download,
  Copy,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type ThoughtType =
  | 'analysis'
  | 'planning'
  | 'decision'
  | 'reflection'
  | 'research'
  | 'coding'
  | 'writing'
  | 'communication';

export interface Thought {
  id: string;
  type: ThoughtType;
  content: string;
  timestamp: string;
  taskId?: string;
  duration?: number; // ms
  confidence?: number; // 0-1
  metadata?: {
    keywords?: string[];
    sources?: string[];
    codeSnippet?: string;
  };
}

export interface ThinkingProcessViewerProps {
  thoughts: Thought[];
  isThinking?: boolean;
  currentTask?: string;
  onThoughtClick?: (thought: Thought) => void;
  onExport?: (thoughts: Thought[]) => void;
}

// ============================================================================
// Thought Item Component
// ============================================================================

function ThoughtItem({
  thought,
  isLatest,
  onClick,
}: {
  thought: Thought;
  isLatest?: boolean;
  onClick?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const typeConfig: Record<ThoughtType, { icon: any; color: string; label: string; bg: string }> = {
    analysis: { icon: Brain, color: '#60a5fa', label: 'Analysis', bg: 'rgba(96, 165, 250, 0.15)' },
    planning: { icon: Target, color: '#a78bfa', label: 'Planning', bg: 'rgba(167, 139, 250, 0.15)' },
    decision: { icon: Zap, color: '#fb923c', label: 'Decision', bg: 'rgba(251, 146, 60, 0.15)' },
    reflection: { icon: Lightbulb, color: '#22c55e', label: 'Insight', bg: 'rgba(34, 197, 94, 0.15)' },
    research: { icon: Search, color: '#3b82f6', label: 'Research', bg: 'rgba(59, 130, 246, 0.15)' },
    coding: { icon: Code2, color: '#4ade80', label: 'Coding', bg: 'rgba(74, 222, 128, 0.15)' },
    writing: { icon: FileText, color: '#f472b6', label: 'Writing', bg: 'rgba(244, 114, 182, 0.15)' },
    communication: { icon: MessageSquare, color: '#2dd4bf', label: 'Communication', bg: 'rgba(45, 212, 191, 0.15)' },
  };

  const config = typeConfig[thought.type];
  const TypeIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`relative pl-6 pb-6 border-l-2 ${
        isLatest ? 'border-blue-400' : 'border-white/10'
      }`}
    >
      {/* Timeline Dot */}
      <div
        className="absolute left-0 top-0 -translate-x-1/2 w-4 h-4 rounded-full border-2 flex items-center justify-center"
        style={{
          background: config.bg,
          borderColor: config.color,
          boxShadow: isLatest ? `0 0 20px ${config.color}66` : 'none',
        }}
      >
        {isLatest && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-2 h-2 rounded-full"
            style={{ background: config.color }}
          />
        )}
      </div>

      {/* Thought Card */}
      <div
        className={`rounded-lg border transition-all ${
          isLatest
            ? 'bg-blue-500/10 border-blue-500/30'
            : 'bg-white/5 border-white/5 hover:border-white/10'
        }`}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 p-3 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div
            className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
            style={{ background: config.bg }}
          >
            <TypeIcon size={16} style={{ color: config.color }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: config.color }}>
                {config.label}
              </span>
              <span className="text-xs text-white/40">
                {new Date(thought.timestamp).toLocaleTimeString()}
              </span>
              {thought.duration && (
                <span className="text-xs text-white/30">
                  • {thought.duration}ms
                </span>
              )}
            </div>
            <p className="text-sm text-white/80 line-clamp-2">
              {thought.content}
            </p>
          </div>

          <button className="p-1 hover:bg-white/5 rounded transition-colors">
            {isExpanded ? (
              <ChevronUp size={14} className="text-white/40" />
            ) : (
              <ChevronDown size={14} className="text-white/40" />
            )}
          </button>
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/5 px-3 pb-3"
            >
              <div className="pt-3 text-sm text-white/70 whitespace-pre-wrap">
                {thought.content}
              </div>

              {/* Metadata */}
              {thought.metadata && (
                <div className="mt-3 space-y-2">
                  {thought.metadata.keywords && thought.metadata.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {thought.metadata.keywords.map((keyword, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/40"
                        >
                          #{keyword}
                        </span>
                      ))}
                    </div>
                  )}
                  {thought.metadata.codeSnippet && (
                    <div className="mt-2 p-3 rounded bg-black/30 border border-white/5 overflow-x-auto">
                      <pre className="text-xs font-mono text-green-400/80">
                        {thought.metadata.codeSnippet}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Confidence */}
              {thought.confidence !== undefined && (
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="text-white/40">Confidence:</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${thought.confidence * 100}%` }}
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${config.color} 0%, ${config.color}88 100%)`,
                      }}
                    />
                  </div>
                  <span className="text-white/60">
                    {Math.round(thought.confidence * 100)}%
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Thinking Process Viewer
// ============================================================================

export function ThinkingProcessViewer({
  thoughts,
  isThinking = false,
  currentTask,
  onThoughtClick,
  onExport,
}: ThinkingProcessViewerProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest thought
  useEffect(() => {
    if (autoScroll && containerRef.current && thoughts.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [thoughts, autoScroll]);

  const handleExport = () => {
    if (onExport) {
      onExport(thoughts);
    } else {
      // Default export as JSON
      const blob = new Blob([JSON.stringify(thoughts, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thinking-process-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleCopy = () => {
    const text = thoughts.map((t) => `[${t.type}] ${t.content}`).join('\n\n');
    navigator.clipboard.writeText(text);
  };

  // Group thoughts by type for stats
  const thoughtStats = thoughts.reduce(
    (acc, thought) => {
      acc[thought.type] = (acc[thought.type] || 0) + 1;
      return acc;
    },
    {} as Record<ThoughtType, number>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center border border-yellow-500/30">
              <Brain size={20} className="text-yellow-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white/90">Thinking Process</h3>
              <p className="text-xs text-white/40">
                {isThinking ? 'Agent is thinking...' : `${thoughts.length} thoughts recorded`}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="p-2 hover:bg-white/5 rounded transition-colors text-white/40 hover:text-white/70"
              title="Copy thoughts"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={handleExport}
              className="p-2 hover:bg-white/5 rounded transition-colors text-white/40 hover:text-white/70"
              title="Export thoughts"
            >
              <Download size={14} />
            </button>
          </div>
        </div>

        {/* Current Task */}
        {currentTask && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Target size={12} className="text-blue-400" />
            <span className="text-xs text-blue-300">{currentTask}</span>
          </div>
        )}

        {/* Stats */}
        {thoughts.length > 0 && (
          <div className="flex items-center gap-4 mt-3 text-xs">
            {Object.entries(thoughtStats).map(([type, count]) => (
              <div key={type} className="flex items-center gap-1">
                <span className="text-white/40 capitalize">{type}:</span>
                <span className="text-white/70 font-medium">{count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Auto-scroll Toggle */}
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`mt-3 text-xs ${
            autoScroll ? 'text-blue-400' : 'text-white/40'
          } hover:text-blue-300 transition-colors`}
        >
          Auto-scroll: {autoScroll ? 'On' : 'Off'}
        </button>
      </div>

      {/* Thoughts Timeline */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
        {thoughts.length === 0 ? (
          isThinking ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-4">
                <Brain size={32} className="text-yellow-400 animate-pulse" />
              </div>
              <p className="text-sm font-medium text-white/60 mb-1">
                Agent is thinking...
              </p>
              <p className="text-xs text-white/40">
                Analyzing the problem and creating a plan
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <Brain size={32} className="text-white/20" />
              </div>
              <p className="text-sm font-medium text-white/50 mb-1">
                No thoughts yet
              </p>
              <p className="text-xs text-white/40">
                Start a task to see the thinking process
              </p>
            </div>
          )
        ) : (
          <div className="space-y-0">
            {thoughts.map((thought, index) => (
              <ThoughtItem
                key={thought.id}
                thought={thought}
                isLatest={index === thoughts.length - 1}
                onClick={() => onThoughtClick?.(thought)}
              />
            ))}

            {/* Thinking Indicator */}
            {isThinking && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-xs text-yellow-400 mt-4 pl-6"
              >
                <Clock size={12} className="animate-pulse" />
                <span>Agent is thinking...</span>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ThinkingProcessViewer;
