import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Check, 
  Lightning, 
  CaretRight, 
  ArrowsClockwise, 
  Stack, 
  Radio, 
  ArrowCounterClockwise, 
  Target, 
  TrendUp, 
  GitBranch 
} from '@phosphor-icons/react';
import type { 
  ExecutionMode, 
  RoutingConfig, 
  RoutingStrategy 
} from '../types/SwarmOrchestrator.types';
import { 
  EXECUTION_MODE_CONFIG, 
  ROLE_CONFIG 
} from '../SwarmOrchestrator.constants';
import { MODE_COLORS, TEXT, createGlassStyle } from '@/design/allternit.tokens';

const ROUTING_STRATEGY_CONFIG: Record<RoutingStrategy, {
  label: string;
  description: string;
  icon: any;
}> = {
  broadcast: { label: 'Broadcast', description: 'Send to all connected agents', icon: Radio },
  roundRobin: { label: 'Round Robin', description: 'Rotate between agents evenly', icon: ArrowCounterClockwise },
  capabilityBased: { label: 'Capability Based', description: 'Route based on capability match', icon: Target },
  loadBalanced: { label: 'Load Balanced', description: 'Distribute based on current load', icon: TrendUp },
  priorityBased: { label: 'Priority Based', description: 'Route to highest priority agent', icon: Lightning },
  weightedRandom: { label: 'Weighted Random', description: 'Random selection with priority weights', icon: GitBranch },
};

interface ConfigurationPanelProps {
  swarmName: string;
  swarmDescription: string;
  setSwarmDescription: (desc: string) => void;
  executionMode: ExecutionMode;
  setExecutionMode: (mode: ExecutionMode) => void;
  routingConfig: RoutingConfig;
  setRoutingConfig: (config: RoutingConfig) => void;
  onClose: () => void;
  canEdit: boolean;
  modeColors: (typeof MODE_COLORS)['chat'];
}

export function ConfigurationPanel({
  swarmName,
  swarmDescription,
  setSwarmDescription,
  executionMode,
  setExecutionMode,
  routingConfig,
  setRoutingConfig,
  onClose,
  canEdit,
  modeColors,
}: ConfigurationPanelProps) {
  const modeConfig: Record<ExecutionMode, any> = {
    parallel: { icon: Lightning, ...EXECUTION_MODE_CONFIG.parallel },
    sequential: { icon: CaretRight, ...EXECUTION_MODE_CONFIG.sequential },
    adaptive: { icon: ArrowsClockwise, ...EXECUTION_MODE_CONFIG.adaptive },
    pipeline: { icon: Stack, ...EXECUTION_MODE_CONFIG.pipeline },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-0 bg-[#0D0B09] z-10 overflow-auto"
    >
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold" style={{ color: TEXT.primary }}>
            Swarm Configuration: {swarmName}
          </h2>
          <button type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: modeColors.soft, color: modeColors.accent }}
          >
            Back to Design
          </button>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <section className="p-6 rounded-xl" style={{ ...createGlassStyle('base'), border: `1px solid ${modeColors.border}` }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: TEXT.primary }}>General Settings</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="swarm-desc" className="text-sm block mb-1" style={{ color: TEXT.secondary }}>Description</label>
                <textarea
                  id="swarm-desc"
                  value={swarmDescription}
                  onChange={(e) => setSwarmDescription(e.target.value)}
                  disabled={!canEdit}
                  rows={4}
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-solid border-[var(--ui-border-default)] rounded-lg text-sm outline-none resize-none focus:border-[var(--accent-primary)]"
                  style={{ color: TEXT.primary }}
                />
              </div>
            </div>
          </section>

          <section className="p-6 rounded-xl" style={{ ...createGlassStyle('base'), border: `1px solid ${modeColors.border}` }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: TEXT.primary }}>Execution Mode</h3>
            <div className="grid grid-cols-1 gap-3">
              {(Object.keys(modeConfig) as ExecutionMode[]).map((mode) => {
                const config = modeConfig[mode];
                const Icon = config.icon;
                const isActive = executionMode === mode;
                return (
                  <button type="button"
                    key={mode}
                    onClick={() => canEdit && setExecutionMode(mode)}
                    disabled={!canEdit}
                    className={`flex items-center gap-3 p-4 rounded-xl text-left transition-all border border-solid ${isActive ? 'shadow-lg' : 'border-transparent'}`}
                    style={{
                      background: isActive ? modeColors.soft : 'var(--surface-hover)',
                      borderColor: isActive ? modeColors.border : 'transparent',
                    }}
                  >
                    <div className="size-10  rounded-lg flex items-center justify-center" style={{ background: isActive ? modeColors.accent : 'rgba(255,255,255,0.05)' }}>
                      <Icon size={20} style={{ color: isActive ? '#000' : modeColors.accent }} />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm" style={{ color: isActive ? TEXT.primary : TEXT.secondary }}>{config.label}</div>
                      <div className="text-[11px] opacity-70" style={{ color: TEXT.tertiary }}>{config.description}</div>
                    </div>
                    {isActive && <Check size={18} style={{ color: modeColors.accent }} />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="p-6 rounded-xl col-span-2" style={{ ...createGlassStyle('base'), border: `1px solid ${modeColors.border}` }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: TEXT.primary }}>Routing Strategy</h3>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(ROUTING_STRATEGY_CONFIG) as RoutingStrategy[]).map((strategy) => {
                const config = ROUTING_STRATEGY_CONFIG[strategy];
                const Icon = config.icon;
                const isActive = routingConfig.strategy === strategy;
                return (
                  <button type="button"
                    key={strategy}
                    onClick={() => canEdit && setRoutingConfig({ ...routingConfig, strategy })}
                    disabled={!canEdit}
                    className={`flex flex-col gap-2 p-4 rounded-xl text-left transition-all border border-solid ${isActive ? 'shadow-lg' : 'border-transparent'}`}
                    style={{
                      background: isActive ? modeColors.soft : 'var(--surface-hover)',
                      borderColor: isActive ? modeColors.border : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={18} style={{ color: modeColors.accent }} />
                      <div className="font-bold text-sm" style={{ color: isActive ? TEXT.primary : TEXT.secondary }}>{config.label}</div>
                    </div>
                    <div className="text-[10px] opacity-60 leading-tight" style={{ color: TEXT.tertiary }}>{config.description}</div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
