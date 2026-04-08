/**
 * Console View - Power-user metrics dashboard
 * 
 * Features:
 * - Three-column layout (Agents | Activity | Metrics)
 * - Monospace fonts for data
 * - Real-time updating numbers
 * - Dense information display
 * - Command center aesthetic
 */

import React from 'react';
import { Play, Check, X, ArrowsLeftRight, Warning, ChatText } from '@phosphor-icons/react';
import { TEXT, BACKGROUND, BORDER, STATUS } from '@/design/allternit.tokens';
import { SwarmAgent, SwarmMetrics, ActivityEvent } from '../types';

interface ConsoleViewProps {
  agents: SwarmAgent[];
  metrics: SwarmMetrics;
  events: ActivityEvent[];
  modeColors: {
    accent: string;
  };
  onAgentSelect: (agentId: string) => void;
}

export function ConsoleView({ 
  agents, 
  metrics, 
  events, 
  modeColors,
  onAgentSelect,
}: ConsoleViewProps) {
  const orchestrator = agents.find(a => a.role === 'orchestrator');
  const workers = agents.filter(a => a.role !== 'orchestrator');

  const getRoleAbbreviation = (role: string) => {
    switch (role) {
      case 'orchestrator': return 'ORCH';
      case 'worker': return 'WORK';
      case 'specialist': return 'SPEC';
      case 'reviewer': return 'REV';
      default: return role.toUpperCase().slice(0, 4);
    }
  };

  const getEventTypeIconEl = (type: string) => {
    switch (type) {
      case 'task_start':    return <Play size={10} color={TEXT.tertiary} weight="fill" />;
      case 'task_complete': return <Check size={10} color={TEXT.tertiary} weight="bold" />;
      case 'task_fail':     return <X size={10} color={TEXT.tertiary} weight="bold" />;
      case 'handoff':       return <ArrowsLeftRight size={10} color={TEXT.tertiary} weight="bold" />;
      case 'error':         return <Warning size={10} color={TEXT.tertiary} weight="fill" />;
      default:              return <ChatText size={10} color={TEXT.tertiary} weight="regular" />;
    }
  };

  return (
    <div className="h-full flex flex-col" style={{ background: 'rgba(13, 11, 9, 0.98)' }}>
      {/* Top Bar */}
      <div 
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ 
          background: 'rgba(255,255,255,0.02)',
          borderColor: 'rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center gap-4">
          <span 
            className="text-xs font-bold tracking-wider"
            style={{ color: modeColors.accent }}
          >
            SWARM ADE
          </span>
          <span className="text-xs" style={{ color: TEXT.tertiary }}>v2.4.1</span>
        </div>
        <div className="flex items-center gap-6 text-xs mono">
          <div className="flex items-center gap-2">
            <div 
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: modeColors.accent }}
            />
            <span style={{ color: TEXT.secondary }}>ONLINE</span>
          </div>
          <span style={{ color: modeColors.accent }}>{metrics.activeAgents} ACTIVE</span>
          <span style={{ color: STATUS.success }}>{metrics.completedThreads} COMPLETE</span>
          <span style={{ color: TEXT.secondary }}>${metrics.totalCost.toFixed(2)} COST</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Agent Status */}
        <div 
          className="w-64 border-r overflow-auto"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
        >
          <div 
            className="px-3 py-2 text-xs font-bold tracking-wider sticky top-0"
            style={{ 
              background: 'rgba(13, 11, 9, 0.98)',
              color: TEXT.tertiary,
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            AGENT STATUS
          </div>
          
          <div className="p-2 space-y-1">
            {/* Orchestrator */}
            {orchestrator && (
              <button
                onClick={() => onAgentSelect(orchestrator.id)}
                className="w-full p-2 rounded border text-left transition-colors hover:bg-white/5"
                style={{ 
                  background: 'rgba(255,255,255,0.02)',
                  borderColor: modeColors.accent,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold mono">ORCH-01</span>
                  <div 
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: modeColors.accent }}
                  />
                </div>
                <div className="text-xs mono" style={{ color: TEXT.tertiary }}>TOK: {(orchestrator.tokensUsed / 1000).toFixed(1)}k</div>
                <div className="text-xs mono" style={{ color: TEXT.tertiary }}>THR: {orchestrator.tasksActive}</div>
              </button>
            )}

            {/* Workers */}
            {workers.map((agent, idx) => (
              <button
                key={agent.id}
                onClick={() => onAgentSelect(agent.id)}
                className="w-full p-2 rounded border text-left transition-colors hover:bg-white/5"
                style={{ 
                  background: 'rgba(255,255,255,0.02)',
                  borderColor: agent.status === 'working' ? agent.color : 'rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold mono">
                    {getRoleAbbreviation(agent.role)}-0{idx + 1}
                  </span>
                  <div 
                    className={`w-1.5 h-1.5 rounded-full ${agent.status === 'working' ? 'animate-pulse' : ''}`}
                    style={{ 
                      background: agent.status === 'working' ? agent.color : TEXT.tertiary,
                    }}
                  />
                </div>
                <div className="text-xs mono" style={{ color: TEXT.tertiary }}>TOK: {(agent.tokensUsed / 1000).toFixed(1)}k</div>
                <div className="text-xs mono" style={{ color: TEXT.tertiary }}>
                  {agent.status === 'working' ? `THR: ${agent.tasksActive}` : 'IDLE'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Center: Activity Feed */}
        <div className="flex-1 overflow-auto">
          <div 
            className="px-4 py-2 text-xs font-bold tracking-wider sticky top-0"
            style={{ 
              background: 'rgba(13, 11, 9, 0.98)',
              color: TEXT.tertiary,
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            ACTIVITY FEED
          </div>
          
          <div className="p-2 space-y-0.5">
            {events.map((event) => (
              <div 
                key={event.id}
                className="flex items-center gap-3 p-2 rounded mono text-xs hover:bg-white/5 transition-colors"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <span style={{ color: TEXT.tertiary }}>{event.timestamp}</span>
                <span 
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                  style={{ 
                    background: `${getRoleColor(event.agentRole)}20`,
                    color: getRoleColor(event.agentRole),
                  }}
                >
                  {getRoleAbbreviation(event.agentRole)}
                </span>
                {getEventTypeIconEl(event.type)}
                <span style={{ color: TEXT.secondary }}>{event.message}</span>
                {event.metadata && (
                  <span className="ml-auto text-[10px]" style={{ color: TEXT.tertiary }}>
                    {event.metadata.tokens && `${(event.metadata.tokens / 1000).toFixed(1)}k tok`}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Metrics */}
        <div 
          className="w-48 border-l overflow-auto"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
        >
          <div 
            className="px-4 py-2 text-xs font-bold tracking-wider sticky top-0"
            style={{ 
              background: 'rgba(13, 11, 9, 0.98)',
              color: TEXT.tertiary,
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            METRICS
          </div>
          
          <div className="p-4 space-y-6">
            <div>
              <div className="text-xs" style={{ color: TEXT.tertiary }}>THROUGHPUT</div>
              <div className="text-2xl mono font-bold" style={{ color: modeColors.accent }}>
                {metrics.throughput.toFixed(1)} <span className="text-xs">t/s</span>
              </div>
            </div>

            <div>
              <div className="text-xs" style={{ color: TEXT.tertiary }}>LATENCY</div>
              <div className="text-2xl mono font-bold" style={{ color: TEXT.primary }}>
                {metrics.avgLatency} <span className="text-xs">ms</span>
              </div>
            </div>

            <div>
              <div className="text-xs" style={{ color: TEXT.tertiary }}>TOKENS/MIN</div>
              <div className="text-2xl mono font-bold" style={{ color: TEXT.primary }}>
                {(metrics.tokensPerMinute / 1000).toFixed(1)}k
              </div>
            </div>

            <div>
              <div className="text-xs" style={{ color: TEXT.tertiary }}>COST/HR</div>
              <div className="text-2xl mono font-bold" style={{ color: STATUS.success }}>
                ${metrics.costPerHour.toFixed(2)}
              </div>
            </div>

            <div className="pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="text-xs" style={{ color: TEXT.tertiary }}>FAILURE RATE</div>
              <div className="text-xl mono font-bold" style={{ color: TEXT.primary }}>
                0.02%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getRoleColor(role: string): string {
  switch (role) {
    case 'orchestrator': return '#c17817';
    case 'worker': return STATUS.info;
    case 'specialist': return '#a78bfa';
    case 'reviewer': return STATUS.success;
    default: return '#888888';
  }
}
