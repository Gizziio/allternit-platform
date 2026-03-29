/**
 * Swarm Checkpoint Viewer - LangGraph-inspired
 *
 * Production-ready checkpoint management for swarm execution.
 * Allows saving, restoring, and browsing execution checkpoints.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FloppyDisk,
  ArrowCounterClockwise,
  Clock,
  Database,
  CaretRight,
  CaretDown,
  Trash,
  DownloadSimple,
  UploadSimple,
  CheckCircle,
  Warning,
  Play,
  Pause,
  StopCircle,
} from '@phosphor-icons/react';
import type { ExecutionTraceEvent } from '@/lib/agents';

// ============================================================================
// Types
// ============================================================================

export interface CheckpointData {
  id: string;
  name: string;
  timestamp: string;
  runId: string;
  stepId?: string;
  stepName?: string;
  state: Record<string, unknown>;
  metadata: {
    reason: 'auto' | 'manual' | 'pre_action' | 'post_action' | 'error';
    tokensUsed?: number;
    costCents?: number;
    duration?: number;
  };
}

export interface CheckpointViewerProps {
  checkpoints: CheckpointData[];
  executionTrace: ExecutionTraceEvent[];
  onSaveCheckpoint?: (name: string) => void;
  onRestoreCheckpoint?: (checkpointId: string) => void;
  onDeleteCheckpoint?: (checkpointId: string) => void;
  onExportCheckpoint?: (checkpointId: string) => void;
  isRunning?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
}

// ============================================================================
// Checkpoint Timeline Item
// ============================================================================

function CheckpointTimelineItem({
  checkpoint,
  isExpanded,
  onToggle,
  onRestore,
  onDelete,
  onExport,
}: {
  checkpoint: CheckpointData;
  isExpanded: boolean;
  onToggle: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const reasonColors: Record<string, { bg: string; color: string; label: string }> = {
    auto: { bg: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa', label: 'Auto' },
    manual: { bg: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', label: 'Manual' },
    pre_action: { bg: 'rgba(251, 146, 60, 0.15)', color: '#fb923c', label: 'Pre-Action' },
    post_action: { bg: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa', label: 'Post-Action' },
    error: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Error' },
  };

  const reasonConfig = reasonColors[checkpoint.metadata.reason] || reasonColors.auto;

  return (
    <motion.div
      layout
      className="rounded-lg border border-white/5 overflow-hidden"
      style={{
        background: isExpanded ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
        borderColor: isExpanded ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={onToggle}
      >
        <button className="p-1 hover:bg-white/5 rounded transition-colors">
          {isExpanded ? (
            <CaretDown size={14} className="text-white/40" />
          ) : (
            <CaretRight size={14} className="text-white/40" />
          )}
        </button>

        {/* Status Icon */}
        <div
          className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: reasonConfig.bg }}
        >
          {checkpoint.metadata.reason === 'error' ? (
            <Warning size={16} style={{ color: reasonConfig.color }} />
          ) : (
            <Database size={16} style={{ color: reasonConfig.color }} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-white/90 truncate">
              {checkpoint.name}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
              style={{
                background: reasonConfig.bg,
                color: reasonConfig.color,
              }}
            >
              {reasonConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {new Date(checkpoint.timestamp).toLocaleString()}
            </span>
            {checkpoint.stepName && (
              <span>• {checkpoint.stepName}</span>
            )}
            {checkpoint.metadata.duration && (
              <span>• {checkpoint.metadata.duration}ms</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onRestore(); }}
            className="p-1.5 hover:bg-white/5 rounded transition-colors text-white/40 hover:text-white/70"
            title="Restore checkpoint"
          >
            <ArrowCounterClockwise size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onExport(); }}
            className="p-1.5 hover:bg-white/5 rounded transition-colors text-white/40 hover:text-white/70"
            title="Export checkpoint"
          >
            <DownloadSimple size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 hover:bg-white/5 rounded transition-colors text-white/40 hover:text-red-400"
            title="Delete checkpoint"
          >
            <Trash size={14} />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5"
          >
            <div className="p-3 space-y-3">
              {/* State Preview */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">
                  State Summary
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(checkpoint.state).slice(0, 6).map(([key, value]) => (
                    <div
                      key={key}
                      className="text-xs p-2 rounded bg-white/5 border border-white/5"
                    >
                      <span className="text-white/60">{key}:</span>{' '}
                      <span className="text-white/90 font-mono">
                        {typeof value === 'string' ? `"${value}"` : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metadata */}
              <div className="flex flex-wrap gap-3 text-xs text-white/40">
                {checkpoint.metadata.tokensUsed && (
                  <span>Tokens: {checkpoint.metadata.tokensUsed.toLocaleString()}</span>
                )}
                {checkpoint.metadata.costCents && (
                  <span>Cost: ${checkpoint.metadata.costCents / 100}</span>
                )}
                {checkpoint.runId && (
                  <span>Run: {checkpoint.runId.slice(0, 8)}...</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// Execution Trace Viewer
// ============================================================================

function ExecutionTraceViewer({
  trace,
  isRunning,
}: {
  trace: ExecutionTraceEvent[];
  isRunning?: boolean;
}) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const eventTypeConfig: Record<string, { icon: any; color: string; label: string }> = {
    'step-start': { icon: Play, color: '#60a5fa', label: 'Step Start' },
    'step-complete': { icon: CheckCircle, color: '#4ade80', label: 'Complete' },
    'step-error': { icon: Warning, color: '#ef4444', label: 'Error' },
    'tool-call': { icon: Database, color: '#fb923c', label: 'Tool Call' },
    'tool-result': { icon: CheckCircle, color: '#4ade80', label: 'Result' },
    'llm-call': { icon: Database, color: '#a78bfa', label: 'LLM Call' },
    'llm-response': { icon: CheckCircle, color: '#a78bfa', label: 'Response' },
    'subagent-spawn': { icon: Play, color: '#2dd4bf', label: 'Spawn Agent' },
    'subagent-complete': { icon: CheckCircle, color: '#2dd4bf', label: 'Agent Done' },
    'checkpoint': { icon: FloppyDisk, color: '#f472b6', label: 'Checkpoint' },
    'decision': { icon: Clock, color: '#fb923c', label: 'Decision' },
  };

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  // Group trace by step
  const steps = trace.reduce((acc, event) => {
    const stepId = event.stepId || 'no-step';
    if (!acc[stepId]) {
      acc[stepId] = [];
    }
    acc[stepId].push(event);
    return acc;
  }, {} as Record<string, ExecutionTraceEvent[]>);

  return (
    <div className="space-y-2">
      {Object.entries(steps).map(([stepId, events]) => {
        const isExpanded = expandedSteps.has(stepId);
        const firstEvent = events[0];
        const config = eventTypeConfig[firstEvent.type] || eventTypeConfig['step-start'];
        const Icon = config.icon;

        return (
          <motion.div
            key={stepId}
            layout
            className="rounded-lg border border-white/5 overflow-hidden"
            style={{
              background: isExpanded ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
            }}
          >
            <div
              className="flex items-center gap-3 p-3 cursor-pointer"
              onClick={() => toggleStep(stepId)}
            >
              <button className="p-1 hover:bg-white/5 rounded transition-colors">
                {isExpanded ? (
                  <CaretDown size={14} className="text-white/40" />
                ) : (
                  <CaretRight size={14} className="text-white/40" />
                )}
              </button>

              <div
                className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                style={{ background: `${config.color}22` }}
              >
                <Icon size={16} style={{ color: config.color }} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white/90">
                  Step {stepId.slice(0, 8)}...
                </div>
                <div className="text-xs text-white/40">
                  {events.length} events • {new Date(firstEvent.timestamp).toLocaleTimeString()}
                  {firstEvent.duration && ` • ${firstEvent.duration}ms`}
                </div>
              </div>

              {isRunning && stepId === 'current' && (
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  Running
                </div>
              )}
            </div>

            {isExpanded && (
              <div className="border-t border-white/5 p-3 space-y-2">
                {events.map((event, idx) => {
                  const eventConfig = eventTypeConfig[event.type] || eventTypeConfig['step-start'];
                  const EventIcon = eventConfig.icon;

                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-3 text-xs p-2 rounded bg-white/5"
                    >
                      <EventIcon size={12} style={{ color: eventConfig.color }} />
                      <span className="text-white/60">{eventConfig.label}</span>
                      <span className="text-white/40">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                      {event.duration && (
                        <span className="text-white/40">{event.duration}ms</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        );
      })}

      {trace.length === 0 && (
        <div className="text-center py-8 text-white/40 text-sm">
          No execution events yet. Start the swarm to see the trace.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Checkpoint Viewer Component
// ============================================================================

export function CheckpointViewer({
  checkpoints,
  executionTrace,
  onSaveCheckpoint,
  onRestoreCheckpoint,
  onDeleteCheckpoint,
  onExportCheckpoint,
  isRunning = false,
  onPause,
  onResume,
  onStop,
}: CheckpointViewerProps) {
  const [expandedCheckpoint, setExpandedCheckpoint] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [checkpointName, setCheckpointName] = useState('');

  const handleSave = () => {
    if (checkpointName.trim() && onSaveCheckpoint) {
      onSaveCheckpoint(checkpointName.trim());
      setCheckpointName('');
      setShowSaveDialog(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white/90">Checkpoints & Trace</h3>
            <p className="text-xs text-white/40 mt-0.5">
              {checkpoints.length} checkpoints • {executionTrace.length} events
            </p>
          </div>

          {/* Execution Controls */}
          <div className="flex items-center gap-2">
            {isRunning ? (
              <>
                <button
                  onClick={onPause}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/70"
                  title="Pause execution"
                >
                  <Pause size={16} />
                </button>
                <button
                  onClick={onStop}
                  className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400"
                  title="Stop execution"
                >
                  <StopCircle size={16} />
                </button>
              </>
            ) : (
              <button
                onClick={onResume}
                className="p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 transition-colors text-green-400"
                title="Resume execution"
              >
                <Play size={16} />
              </button>
            )}

            <button
              onClick={() => setShowSaveDialog(true)}
              disabled={!isRunning}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white/70"
            >
              <FloppyDisk size={14} />
              <span className="text-xs font-medium">Save Checkpoint</span>
            </button>
          </div>
        </div>

        {/* Save Dialog */}
        {showSaveDialog && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
            <input
              type="text"
              value={checkpointName}
              onChange={(e) => setCheckpointName(e.target.value)}
              placeholder="Checkpoint name..."
              className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-white/90 placeholder-white/30 outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setShowSaveDialog(false);
              }}
            />
            <button
              onClick={handleSave}
              className="px-3 py-1.5 rounded bg-green-500/20 hover:bg-green-500/30 transition-colors text-green-400 text-xs font-medium"
            >
              Save
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 transition-colors text-white/40 text-xs"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Checkpoints Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white/40">
            Saved Checkpoints
          </h4>
          {checkpoints.length > 0 ? (
            <div className="space-y-2">
              {checkpoints.map((checkpoint) => (
                <CheckpointTimelineItem
                  key={checkpoint.id}
                  checkpoint={checkpoint}
                  isExpanded={expandedCheckpoint === checkpoint.id}
                  onToggle={() => setExpandedCheckpoint(expandedCheckpoint === checkpoint.id ? null : checkpoint.id)}
                  onRestore={() => onRestoreCheckpoint?.(checkpoint.id)}
                  onDelete={() => onDeleteCheckpoint?.(checkpoint.id)}
                  onExport={() => onExportCheckpoint?.(checkpoint.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-white/40 text-sm">
              No checkpoints saved yet. Click "Save Checkpoint" during execution.
            </div>
          )}
        </div>

        {/* Execution Trace Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white/40">
            Execution Trace
          </h4>
          <ExecutionTraceViewer trace={executionTrace} isRunning={isRunning} />
        </div>
      </div>
    </div>
  );
}

export default CheckpointViewer;
