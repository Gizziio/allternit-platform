import React from 'react';
import { motion } from 'framer-motion';
import { Target, Clock, TrendUp, Stack, Lightning, Radio, ArrowCounterClockwise, GitBranch } from '@phosphor-icons/react';
import type { 
  ExecutionMode, 
  RoutingStrategy 
} from '../types/SwarmOrchestrator.types';
import { EXECUTION_MODE_CONFIG } from '../SwarmOrchestrator.constants';
import { TEXT } from '@/design/allternit.tokens';

const ROUTING_STRATEGY_CONFIG: Record<RoutingStrategy, {
  label: string;
  description: string;
  icon: any;
}> = {
  broadcast: { label: 'Broadcast', description: 'Send to all', icon: Radio },
  roundRobin: { label: 'Round Robin', description: 'Rotate evenly', icon: ArrowCounterClockwise },
  capabilityBased: { label: 'Capability Based', description: 'Match capabilities', icon: Target },
  loadBalanced: { label: 'Load Balanced', description: 'Based on load', icon: TrendUp },
  priorityBased: { label: 'Priority Based', description: 'Highest priority first', icon: Lightning },
  weightedRandom: { label: 'Weighted Random', description: 'Random with weights', icon: GitBranch },
};

interface PropertiesPanelProps {
  nodeCount: number;
  edgeCount: number;
  swarmConfig: {
    executionMode: ExecutionMode;
    routingStrategy: RoutingStrategy;
  };
  modeColors: any;
}

export function PropertiesPanel({
  nodeCount,
  edgeCount,
  swarmConfig,
  modeColors,
}: PropertiesPanelProps) {
  const executionModeConfig = EXECUTION_MODE_CONFIG[swarmConfig.executionMode] || EXECUTION_MODE_CONFIG.adaptive;
  const routingConfig = ROUTING_STRATEGY_CONFIG[swarmConfig.routingStrategy] || ROUTING_STRATEGY_CONFIG.broadcast;

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className="w-56 border-l border-solid p-4 overflow-y-auto"
      style={{ borderColor: modeColors.border, background: 'var(--surface-hover)' }}
    >
      <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: TEXT.primary }}>Swarm Info</h3>

      <div className="space-y-3">
        <InfoCard label="Agents" value={nodeCount.toString()} modeColors={modeColors} />
        <InfoCard label="Connections" value={edgeCount.toString()} modeColors={modeColors} />
        <InfoCard label="Execution" value={executionModeConfig.label} subvalue={executionModeConfig.description} modeColors={modeColors} />
        <InfoCard label="Routing" value={routingConfig.label} subvalue={routingConfig.description} modeColors={modeColors} />
        <InfoCard label="Est. Latency" value={`~${Math.max(500, nodeCount * 200)}ms`} modeColors={modeColors} />
      </div>

      <div className="mt-6 p-3 rounded-xl text-xs bg-amber-500/5 border border-solid border-amber-500/20 text-amber-200/80">
        <div className="flex items-center gap-2 mb-1.5">
          <Target size={14} className="text-amber-400" />
          <span className="font-bold uppercase tracking-tighter">Pro Tip</span>
        </div>
        Connect agents by dragging from the bottom handle to the top handle of another agent.
      </div>
    </motion.div>
  );
}

function InfoCard({ label, value, subvalue, modeColors }: { label: string; value: string; subvalue?: string; modeColors: any }) {
  return (
    <div className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-solid border-[var(--ui-border-default)]">
      <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1" style={{ color: TEXT.tertiary }}>{label}</div>
      <div className="text-lg font-black" style={{ color: modeColors.accent }}>{value}</div>
      {subvalue && <div className="text-[10px] mt-1 line-clamp-2 opacity-70" style={{ color: TEXT.tertiary }}>{subvalue}</div>}
    </div>
  );
}
