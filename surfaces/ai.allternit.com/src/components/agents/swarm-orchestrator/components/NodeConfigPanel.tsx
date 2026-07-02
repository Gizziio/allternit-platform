import React from "react";
import { 
  X, 
  Trash, 
  Copy, 
  GearSix, 
  Chat, 
  Target, 
  Eye, 
  Lock, 
  Cpu, 
  Network, Icon } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import type { Node } from 'reactflow';
import type { 
  AgentNodeData, 
  SwarmAgent, 
  AgentRole 
} from '../types/SwarmOrchestrator.types';
import { ROLE_CONFIG } from '../SwarmOrchestrator.constants';
import { MODE_COLORS, TEXT } from '@/design/allternit.tokens';

interface NodeConfigPanelProps {
  node: Node<AgentNodeData>;
  onClose: () => void;
  onUpdate: (updates: Partial<SwarmAgent>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  modeColors: (typeof MODE_COLORS)['chat'];
}

export function NodeConfigPanel({
  node,
  onClose,
  onUpdate,
  onDuplicate,
  onRemove,
  modeColors,
}: NodeConfigPanelProps) {
  const data = node.data;
  const roleConfig = ROLE_CONFIG[data.role];

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className="absolute top-4 right-4 bottom-4 w-80 rounded-2xl border border-solid shadow-2xl flex flex-col z-[100] overflow-hidden"
      style={{ background: 'var(--surface-panel)', borderColor: modeColors.border }}
    >
      <div className="px-4 py-3 border-b border-solid flex items-center justify-between" style={{ borderColor: modeColors.border }}>
        <div className="flex items-center gap-2">
          <GearSix size={18} style={{ color: roleConfig.color }} />
          <span className="font-bold text-sm" style={{ color: TEXT.primary }}>Agent Configuration</span>
        </div>
        <button type="button"
          onClick={onClose}
          className="p-1 rounded-md hover:bg-white/10 transition-colors"
          style={{ color: TEXT.tertiary }}
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Basic Info */}
        <section className="space-y-4">
          <div>
            <label htmlFor="agent-name" className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: TEXT.tertiary }}>
              Display Name
            </label>
            <input
              id="agent-name"
              type="text"
              className="w-full px-3 py-2 bg-[var(--surface-sunken)] border border-solid border-[var(--ui-border-default)] rounded-xl text-sm focus:outline-none"
              style={{ color: TEXT.primary }}
              value={data.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
            />
          </div>

          <div>
            <div id="role-label" className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: TEXT.tertiary }}>
              Role
            </div>
            <div className="grid grid-cols-1 gap-2" role="group" aria-labelledby="role-label">
              {(Object.keys(ROLE_CONFIG) as AgentRole[]).map((role) => {
                const isActive = data.role === role;
                const config = ROLE_CONFIG[role];
                const Icon = config.icon;
                return (
                  <button type="button"
                    key={role}
                    onClick={() => onUpdate({ role })}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-xl border border-solid transition-all text-left
                      ${isActive ? 'shadow-sm' : 'hover:bg-white/5 opacity-60'}
                    `}
                    style={{
                      borderColor: isActive ? config.color : 'var(--ui-border-default)',
                      background: isActive ? config.bgColor : 'transparent',
                    }}
                  >
                    <Icon size={16} style={{ color: isActive ? config.color : TEXT.tertiary }} />
                    <div>
                      <div className="text-xs font-bold capitalize" style={{ color: isActive ? config.color : TEXT.secondary }}>{role}</div>
                      <div className="text-[10px] opacity-70 leading-tight" style={{ color: TEXT.tertiary }}>{config.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Configuration */}
        <section className="space-y-4 pt-4 border-t border-solid" style={{ borderColor: modeColors.border }}>
          <div>
            <label htmlFor="agent-priority" className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: TEXT.tertiary }}>
              Priority (0-10)
            </label>
            <input
              id="agent-priority"
              type="range"
              min="0"
              max="10"
              step="1"
              className="w-full accent-[var(--accent-primary)]"
              value={data.priority || 0}
              onChange={(e) => onUpdate({ priority: parseInt(e.target.value) })}
            />
            <div className="flex justify-between text-[10px] mt-1" style={{ color: TEXT.tertiary }}>
              <span>Low</span>
              <span className="font-bold" style={{ color: roleConfig.color }}>{data.priority || 0}</span>
              <span>High</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div id="enabled-label" className="text-xs font-bold uppercase tracking-wider" style={{ color: TEXT.tertiary }}>
              Agent Enabled
            </div>
            <button type="button"
              aria-labelledby="enabled-label"
              onClick={() => onUpdate({ enabled: !data.enabled })}
              className={`w-10 h-5 rounded-full transition-all relative ${data.enabled !== false ? 'bg-green-500' : 'bg-zinc-700'}`}
            >
              <div className={`absolute top-1 size-3 rounded-full bg-white transition-all ${data.enabled !== false ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </section>
      </div>

      <div className="p-4 border-t border-solid flex gap-2" style={{ borderColor: modeColors.border }}>
        <button type="button"
          onClick={onDuplicate}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border border-solid border-[var(--ui-border-default)] hover:bg-white/5 transition-all"
          style={{ color: TEXT.secondary }}
        >
          <Copy size={16} />
          Duplicate
        </button>
        <button type="button"
          onClick={onRemove}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-red-500/10 border border-solid border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
        >
          <Trash size={16} />
          Remove
        </button>
      </div>
    </motion.div>
  );
}
