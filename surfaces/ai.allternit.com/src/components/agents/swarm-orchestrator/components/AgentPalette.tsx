import React from 'react';
import { 
  MagnifyingGlass, 
  Plus, 
  Users, 
  Target, 
  Eye, 
  Lock, 
  Cpu, 
  Network 
} from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import type { Agent } from '@/lib/agents/agent.types';
import type { AgentRole } from '../types/SwarmOrchestrator.types';
import { MODE_COLORS, TEXT } from '@/design/allternit.tokens';

interface AgentPaletteProps {
  agents: Agent[];
  onAddAgent: (agent: Agent, role: AgentRole) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  modeColors: (typeof MODE_COLORS)['chat'];
}

export function AgentPalette({
  agents,
  onAddAgent,
  searchQuery,
  setSearchQuery,
  modeColors,
}: AgentPaletteProps) {
  return (
    <motion.aside
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -300, opacity: 0 }}
      className="w-72 border-r border-solid flex flex-col"
      style={{ background: 'var(--surface-panel)', borderColor: modeColors.border }}
    >
      <div className="p-4 border-b border-solid" style={{ borderColor: modeColors.border }}>
        <div className="relative">
          <MagnifyingGlass
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: TEXT.tertiary }}
          />
          <input aria-label="Search agents..." type="text"
            placeholder="Search agents..."
            className="w-full pl-10 pr-4 py-2 bg-[var(--surface-sunken)] border border-solid border-[var(--ui-border-default)] rounded-xl text-sm focus:outline-none focus:ring-1"
            style={{ color: TEXT.primary }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3 px-1" style={{ color: TEXT.tertiary }}>
            Available Agents
          </h3>
          <div className="space-y-2">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="group p-3 rounded-xl border border-solid border-[var(--ui-border-default)] bg-[var(--surface-sunken)] hover:bg-white/5 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-sm" style={{ color: TEXT.primary }}>{agent.name}</div>
                  <div className="flex items-center gap-1">
                    <button type="button"
                      onClick={() => onAddAgent(agent, 'worker')}
                      className="p-1 rounded-md hover:bg-white/10 transition-colors text-[var(--accent-primary)]"
                      title="Add as Worker"
                    >
                      <Plus size={14} weight="bold" />
                    </button>
                  </div>
                </div>
                <div className="text-xs line-clamp-2 mb-2" style={{ color: TEXT.secondary }}>
                  {agent.description}
                </div>
                <div className="flex flex-wrap gap-1">
                  {agent.capabilities?.slice(0, 2).map((cap) => (
                    <span key={cap} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-[var(--ui-text-muted)]">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3 px-1" style={{ color: TEXT.tertiary }}>
            Roles & Components
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <RoleItem icon={Network} label="Coordinator" agentRole="coordinator" />
            <RoleItem icon={Cpu} label="Worker" agentRole="worker" />
            <RoleItem icon={Target} label="Specialist" agentRole="specialist" />
            <RoleItem icon={Eye} label="Reviewer" agentRole="reviewer" />
            <RoleItem icon={Lock} label="Gatekeeper" agentRole="gatekeeper" />
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

function RoleItem({ icon: Icon, label, agentRole }: { icon: any; label: string; agentRole: AgentRole }) {
  return (
    <div className="p-3 rounded-xl border border-solid border-[var(--ui-border-default)] bg-[var(--surface-sunken)] flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing hover:bg-white/5 transition-all">
      <Icon size={20} className="text-[var(--accent-primary)]" />
      <span className="text-[10px] font-medium text-[var(--ui-text-secondary)]">{label}</span>
    </div>
  );
}
