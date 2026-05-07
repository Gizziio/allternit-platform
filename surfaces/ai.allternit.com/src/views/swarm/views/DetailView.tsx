/**
 * Detail View - Deep agent inspection
 */

import React from 'react';
import {
  Brain,
  Robot,
  Cpu,
  ClipboardText,
  ArrowLeft,
  Terminal,
  ArrowsClockwise,
  Stop,
  CursorClick,
} from '@phosphor-icons/react';
import { TEXT, BACKGROUND, BORDER, STATUS } from '@/design/allternit.tokens';
import { SwarmAgent } from '../types';

interface DetailViewProps {
  agents: SwarmAgent[];
  selectedAgent: SwarmAgent | null;
  modeColors: { accent: string };
  onAgentSelect: (agentId: string) => void;
  onBack: () => void;
  onViewLogs?: (agentId: string) => void;
  onRestart?: (agentId: string) => void;
  onStop?: (agentId: string) => void;
}

const AGENT_ICON_MAP: Record<string, React.ElementType> = {
  brain: Brain,
  robot: Robot,
  microchip: Cpu,
  'clipboard-check': ClipboardText,
};

function AgentIcon({ icon, color, size = 14 }: { icon: string; color: string; size?: number }) {
  const Icon = AGENT_ICON_MAP[icon] ?? Robot;
  return <Icon size={size} color={color} weight="duotone" />;
}

const roleLabels: Record<string, string> = {
  orchestrator: 'Orchestrator',
  worker: 'Worker',
  specialist: 'Specialist',
  reviewer: 'Reviewer',
};

export function DetailView({
  agents,
  selectedAgent,
  modeColors,
  onAgentSelect,
  onBack,
  onViewLogs,
  onRestart,
  onStop,
}: DetailViewProps) {
  if (!selectedAgent) {
    return (
      <div className="h-full flex items-center justify-center" style={{ color: TEXT.secondary }}>
        <div className="text-center" style={{ opacity: 0.5 }}>
          <CursorClick size={40} weight="duotone" style={{ margin: '0 auto 12px' }} />
          <p className="text-sm">Select an agent to view details</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 rounded-lg text-sm"
            style={{
              background: `${modeColors.accent}20`,
              color: modeColors.accent,
              border: `1px solid ${modeColors.accent}40`,
            }}
          >
            Back to Grid
          </button>
        </div>
      </div>
    );
  }

  const isWorking = selectedAgent.status === 'working';

  return (
    <div className="h-full flex">
      {/* Left: Agent Selector */}
      <div
        className="w-64 border-r overflow-auto"
        style={{
          background: BACKGROUND.secondary,
          borderColor: BORDER.subtle,
        }}
      >
        <div className="p-4 border-b" style={{ borderColor: BORDER.subtle }}>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
            style={{ color: TEXT.secondary }}
          >
            <ArrowLeft size={14} weight="bold" />
            <span>Back to Grid</span>
          </button>
        </div>

        <div className="p-2 space-y-1">
          {agents.map((agent) => {
            const isSelected = agent.id === selectedAgent.id;
            const agentWorking = agent.status === 'working';

            return (
              <button
                key={agent.id}
                onClick={() => onAgentSelect(agent.id)}
                className="w-full p-3 rounded-xl text-left transition-all"
                style={{
                  background: isSelected ? BACKGROUND.tertiary : 'transparent',
                  border: `1px solid ${isSelected ? agent.color : 'transparent'}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${agent.color}20` }}
                  >
                    <AgentIcon icon={agent.icon} color={agent.color} size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{agent.name}</div>
                    <div className="text-xs" style={{ color: TEXT.tertiary }}>
                      {agentWorking ? `${agent.tasksActive} threads` : agent.status}
                    </div>
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full ${agentWorking ? 'animate-pulse' : ''}`}
                    style={{
                      background: agentWorking ? agent.color : TEXT.tertiary,
                      boxShadow: agentWorking ? `0 0 8px ${agent.color}` : 'none',
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Detail Panel */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* Header Card */}
          <div
            className="p-6 rounded-2xl border mb-6"
            style={{
              background: BACKGROUND.secondary,
              borderColor: selectedAgent.color,
              borderWidth: 2,
            }}
          >
            <div className="flex items-center justify-center mb-4">
              <div
                className="w-24 h-24 rounded-3xl flex items-center justify-center"
                style={{ background: `${selectedAgent.color}20` }}
              >
                <AgentIcon icon={selectedAgent.icon} color={selectedAgent.color} size={40} />
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold mb-1">{selectedAgent.name}</h2>
              <p className="text-sm font-mono" style={{ color: TEXT.tertiary }}>
                {selectedAgent.id.toUpperCase()}
              </p>
            </div>
          </div>

          {/* Status Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              {
                label: 'Status',
                content: (
                  <div
                    className="flex items-center gap-2 text-lg font-semibold"
                    style={{ color: isWorking ? selectedAgent.color : TEXT.secondary }}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${isWorking ? 'animate-pulse' : ''}`}
                      style={{
                        background: isWorking ? selectedAgent.color : TEXT.tertiary,
                        boxShadow: isWorking ? `0 0 8px ${selectedAgent.color}` : 'none',
                      }}
                    />
                    <span className="uppercase">{selectedAgent.status}</span>
                  </div>
                ),
              },
              {
                label: 'Role',
                content: (
                  <div className="text-lg font-semibold" style={{ color: selectedAgent.color }}>
                    {roleLabels[selectedAgent.role]}
                  </div>
                ),
              },
              {
                label: 'Model',
                content: (
                  <div className="text-sm font-mono" style={{ color: TEXT.primary }}>
                    {selectedAgent.model}
                  </div>
                ),
              },
              {
                label: 'Uptime',
                content: (
                  <div className="text-lg font-mono font-semibold" style={{ color: TEXT.primary }}>
                    {selectedAgent.uptime}
                  </div>
                ),
              },
            ].map(({ label, content }) => (
              <div
                key={label}
                className="p-4 rounded-xl border"
                style={{ background: BACKGROUND.secondary, borderColor: BORDER.subtle }}
              >
                <div className="text-xs mb-1" style={{ color: TEXT.tertiary }}>{label}</div>
                {content}
              </div>
            ))}
          </div>

          {/* Metrics */}
          <div
            className="p-4 rounded-xl border mb-6"
            style={{ background: BACKGROUND.secondary, borderColor: BORDER.subtle }}
          >
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Tokens', value: `${(selectedAgent.tokensUsed / 1000).toFixed(1)}k` },
                { label: 'Cost', value: `$${selectedAgent.costAccumulated.toFixed(2)}` },
                { label: 'Threads', value: selectedAgent.tasksActive, colored: true },
                { label: 'ms avg', value: selectedAgent.avgLatency },
              ].map(({ label, value, colored }) => (
                <div key={label} className="text-center">
                  <div
                    className="text-2xl font-mono font-bold"
                    style={{ color: colored && isWorking ? selectedAgent.color : TEXT.primary }}
                  >
                    {value}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: TEXT.tertiary }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Tasks */}
          {selectedAgent.currentTasks.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: TEXT.tertiary }}>
                Active Threads ({selectedAgent.currentTasks.length})
              </h3>
              <div className="space-y-3">
                {selectedAgent.currentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-xl border"
                    style={{ background: BACKGROUND.secondary, borderColor: BORDER.subtle }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{task.name}</span>
                      <span className="text-xs font-mono" style={{ color: selectedAgent.color }}>
                        {task.progress}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: BORDER.subtle }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${task.progress}%`, background: selectedAgent.color }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs" style={{ color: TEXT.tertiary }}>
                      <span className="font-mono">{(task.tokensUsed / 1000).toFixed(1)}k tokens</span>
                      <span className="font-mono">${task.cost.toFixed(2)}</span>
                      <span>{task.duration}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => onViewLogs?.(selectedAgent.id)}
              className="flex-1 py-3 rounded-xl text-sm font-medium transition-opacity hover:opacity-80 flex items-center justify-center gap-2"
              style={{
                background: BACKGROUND.secondary,
                color: TEXT.secondary,
                border: `1px solid ${BORDER.default}`,
              }}
            >
              <Terminal size={14} weight="duotone" />
              View Logs
            </button>
            <button
              onClick={() => onRestart?.(selectedAgent.id)}
              className="flex-1 py-3 rounded-xl text-sm font-medium transition-opacity hover:opacity-80 flex items-center justify-center gap-2"
              style={{
                background: `${modeColors.accent}20`,
                color: modeColors.accent,
                border: `1px solid ${modeColors.accent}40`,
              }}
            >
              <ArrowsClockwise size={14} weight="bold" />
              Restart
            </button>
            <button
              onClick={() => onStop?.(selectedAgent.id)}
              disabled={selectedAgent.status === 'offline'}
              className="flex-1 py-3 rounded-xl text-sm font-medium transition-opacity hover:opacity-80 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'rgba(239,68,68,0.18)',
                color: STATUS.error,
                border: `1px solid ${STATUS.error}30`,
              }}
            >
              <Stop size={14} weight="fill" />
              Stop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
