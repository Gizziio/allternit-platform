import React, { useState } from "react";
import { motion } from 'framer-motion';
import { 
  Pulse as Activity, 
  Users, 
  Chat, 
  Clock, 
  Stack, 
  Lightning, 
  Target, 
  TrendUp, Icon } from '@phosphor-icons/react';
import type { Node } from 'reactflow';
import type { 
  SwarmExecution, 
  AgentNodeData, 
  ExecutionStatus 
} from '../types/SwarmOrchestrator.types';
import { ROLE_CONFIG } from '../SwarmOrchestrator.constants';
import { MODE_COLORS, TEXT, createGlassStyle } from '@/design/allternit.tokens';

interface MonitoringPanelProps {
  execution: SwarmExecution | null;
  executionHistory: SwarmExecution[];
  nodes: Node<AgentNodeData>[];
  onClose: () => void;
  modeColors: (typeof MODE_COLORS)['chat'];
}

export function MonitoringPanel({
  execution,
  executionHistory,
  nodes,
  onClose,
  modeColors,
}: MonitoringPanelProps) {
  const [activeView, setActiveView] = useState<'current' | 'history'>('current');

  if (!execution && executionHistory.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="absolute inset-0 bg-[#0D0B09] z-10 flex flex-col items-center justify-center"
      >
        <button type="button"
          onClick={onClose}
          className="absolute top-4 right-4 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: modeColors.soft, color: modeColors.accent }}
        >
          Back to Design
        </button>
        
        <div className="size-20  rounded-2xl flex items-center justify-center mb-6" style={{ background: modeColors.soft, border: `1px solid ${modeColors.border}` }}>
          <Activity size={36} style={{ color: modeColors.accent }} />
        </div>
        <h3 className="text-xl font-semibold" style={{ color: TEXT.primary }}>No Active Execution</h3>
        <p className="text-sm mt-2" style={{ color: TEXT.secondary }}>Start execution to monitor swarm activity</p>
      </motion.div>
    );
  }

  const currentExecution = execution || executionHistory[0];

  const getStatusColor = (status: ExecutionStatus) => {
    switch (status) {
      case 'running':
      case 'starting': return 'var(--status-success)';
      case 'paused': return 'var(--status-warning)';
      case 'completed': return '#69A8C8';
      case 'failed':
      case 'cancelled':
      case 'timeout': return 'var(--status-error)';
      default: return 'var(--ui-text-muted)';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-0 bg-[#0D0B09] z-10 overflow-auto"
    >
      <div className="max-w-6xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-semibold" style={{ color: TEXT.primary }}>Execution Monitor</h2>
            <div className="flex rounded-lg p-1" style={{ background: 'var(--bg-tertiary)' }}>
              <button type="button"
                onClick={() => setActiveView('current')}
                className="px-3 py-1.5 rounded text-sm font-medium transition-all"
                style={{
                  background: activeView === 'current' ? modeColors.soft : 'transparent',
                  color: activeView === 'current' ? modeColors.accent : TEXT.secondary,
                }}
              >
                Current
              </button>
              <button type="button"
                onClick={() => setActiveView('history')}
                className="px-3 py-1.5 rounded text-sm font-medium transition-all"
                style={{
                  background: activeView === 'history' ? modeColors.soft : 'transparent',
                  color: activeView === 'history' ? modeColors.accent : TEXT.secondary,
                }}
              >
                History
              </button>
            </div>
          </div>
          <button type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: modeColors.soft, color: modeColors.accent }}
          >
            Back to Design
          </button>
        </div>

        {activeView === 'current' && currentExecution && (
          <div className="space-y-6">
            <div className="p-6 rounded-xl" style={{ ...createGlassStyle('base'), border: `1px solid ${modeColors.border}` }}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: TEXT.primary }}>Execution Status</h3>
                  <p className="text-sm" style={{ color: TEXT.tertiary }}>ID: {currentExecution.id}</p>
                </div>
                <span className="px-4 py-2 rounded-full text-sm font-medium" style={{ background: `${getStatusColor(currentExecution.status)}20`, color: getStatusColor(currentExecution.status), border: `1px solid ${getStatusColor(currentExecution.status)}40` }}>
                  {currentExecution.status.toUpperCase()}
                </span>
              </div>

              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2" style={{ color: TEXT.secondary }}>
                  <span>Progress</span>
                  <span>{Math.round(currentExecution.progress)}%</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-hover)' }}>
                  <motion.div className="h-full rounded-full" style={{ background: modeColors.accent }} initial={{ width: 0 }} animate={{ width: `${currentExecution.progress}%` }} transition={{ duration: 0.5 }} />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <MetricCard label="Active Agents" value={currentExecution.activeAgents.length.toString()} icon={Users} modeColors={modeColors} />
                <MetricCard label="Messages" value={currentExecution.messagesExchanged.toString()} icon={Chat} modeColors={modeColors} />
                <MetricCard label="Duration" value={currentExecution.startTime ? formatDuration(Date.now() - currentExecution.startTime.getTime()) : '0s'} icon={Clock} modeColors={modeColors} />
                <MetricCard label="Current Stage" value={currentExecution.currentStage || 'idle'} icon={Stack} modeColors={modeColors} />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: TEXT.primary }}>Agent Status</h3>
              <div className="grid grid-cols-3 gap-4">
                {nodes.map((node) => {
                  const isActive = currentExecution.activeAgents.includes(node.id);
                  const roleConfig = ROLE_CONFIG[node.data.role];
                  return (
                    <div key={node.id} className="p-4 rounded-xl" style={{ ...createGlassStyle('base'), border: `1px solid ${isActive ? roleConfig.borderColor : modeColors.border}` }}>
                      <div className="flex items-center gap-3">
                        <div className="size-3  rounded-full" style={{ background: isActive ? 'var(--status-success)' : 'var(--ui-text-muted)', boxShadow: isActive ? '0 0 10px #4ade80' : 'none' }} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate" style={{ color: TEXT.primary }}>{node.data.name}</div>
                          <div className="text-xs capitalize" style={{ color: roleConfig.color }}>{node.data.role}</div>
                        </div>
                      </div>
                      {isActive && <div className="mt-3 text-sm" style={{ color: TEXT.secondary }}>Processing messages...</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function MetricCard({ label, value, icon: Icon, modeColors }: { label: string; value: string; icon: any; modeColors: any }) {
  return (
    <div className="p-4 rounded-xl text-center" style={{ background: 'var(--surface-hover)', border: `1px solid ${modeColors.border}` }}>
      <Icon size={20} className="mx-auto mb-2" style={{ color: modeColors.accent }} />
      <div className="text-2xl font-bold" style={{ color: TEXT.primary }}>{value}</div>
      <div className="text-xs" style={{ color: TEXT.tertiary }}>{label}</div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
