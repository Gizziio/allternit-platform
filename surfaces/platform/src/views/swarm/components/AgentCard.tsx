/**
 * AgentCard - Individual agent card for Grid view
 * 
 * Based on demo-v3/v4/v5.html design specification
 */

import React from 'react';
import { Brain, Robot, Cpu, ClipboardText } from '@phosphor-icons/react';
import { SwarmAgent } from '../types';
import { BACKGROUND, SAND, STATUS, TEXT } from '@/design/a2r.tokens';

const ACCENT = '#c17817';
const BG_SURFACE = '#121110';
const BG_HOVER = '#1a1917';
const BORDER_COLOR = '#272522';
const TEXT_MUTED = '#8b8680';
const TEXT_SUBTLE = '#5c5854';
const TEXT_COLOR = '#e8e6e3';
const GREEN = STATUS.success;

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

interface AgentCardProps {
  agent: SwarmAgent;
  modeColors: {
    accent: string;
  };
  onClick: () => void;
  className?: string;
}

export function AgentCard({ 
  agent, 
  modeColors, 
  onClick, 
  className,
}: AgentCardProps) {
  const isWorking = agent.status === 'working';
  const activeTasks = agent.currentTasks.filter(t => t.status === 'active');

  const roleLabels: Record<string, string> = {
    orchestrator: 'ORCH',
    worker: 'WORK',
    specialist: 'SPEC',
    reviewer: 'REV',
  };

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border cursor-pointer transition-all hover:border-white/20 ${className}`}
      style={{
        background: BG_SURFACE,
        borderColor: isWorking ? agent.color : BORDER_COLOR,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded flex items-center justify-center"
            style={{ background: isWorking ? `${agent.color}20` : BG_HOVER }}
          >
            <AgentIcon icon={agent.icon} color={agent.color} size={14} />
          </div>
          <div>
            <h3 className="font-medium text-sm" style={{ color: TEXT_COLOR }}>{agent.name}</h3>
            <div className="text-xs mono" style={{ color: TEXT_SUBTLE }}>
              {roleLabels[agent.role]}-{agent.id.split('-')[1]?.toUpperCase() || '01'}
            </div>
          </div>
        </div>
        <span 
          className="w-1.5 h-1.5 rounded-full"
          style={{ 
            background: isWorking ? GREEN : TEXT_SUBTLE,
            boxShadow: isWorking ? `0 0 6px ${GREEN}` : 'none',
          }}
        />
      </div>

      {/* Active Tasks */}
      {activeTasks.length > 0 && (
        <div className="space-y-2 mb-3">
          {activeTasks.slice(0, 1).map((task) => (
            <div key={task.id}>
              <div className="flex justify-between text-xs mb-1" style={{ color: TEXT_MUTED }}>
                <span>{task.name}</span>
                <span>{task.progress}%</span>
              </div>
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ background: BORDER_COLOR }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ 
                    width: `${task.progress}%`,
                    background: agent.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Metrics */}
      <div
        className="flex items-center justify-between text-xs pt-2 border-t"
        style={{ borderColor: BORDER_COLOR, color: TEXT_SUBTLE }}
      >
        <span className="font-mono">${agent.costAccumulated.toFixed(2)}</span>
        <span>{agent.tasksActive} tasks</span>
      </div>
    </div>
  );
}
