/**
 * Code Mode - Agent Orchestration (Swarms & Teams)
 * 
 * Focuses on high-tier agentic innovations:
 * - Multi-agent orchestration
 * - Swarm coordination
 * - Sub-agent management
 * - High-tier agentic schemes
 * 
 * Uses A2R code mode accent colors (soft mint green)
 * 
 * @module CodeModeADE
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Cpu,
  Zap,
  Layers,
  Activity,
  Plus,
  Settings,
  Shield,
  Code2,
  GitMerge,
  Terminal,
  Bot,
  Box,
} from 'lucide-react';

import {
  MODE_COLORS,
  TEXT,
} from '@/design/allternit.tokens';

import { AgentSessionLayout } from './AgentSessionLayout';
import type { CodeModeADEProps } from './types';

export function CodeModeADE({
  targetAgentId,
  onClose,
}: CodeModeADEProps) {
  const mode = 'code';
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.code;
  
  const [activeTab, setActiveTab] = useState<'orchestration' | 'swarms' | 'output'>('orchestration');
  const [isOrchestrating, setIsOrchestrating] = useState(false);

  return (
    <AgentSessionLayout
      mode={mode}
      title="Agent Orchestration"
      agentName={targetAgentId || "Prime Orchestrator"}
      status={isOrchestrating ? 'running' : 'idle'}
      onClose={onClose}
      computerView={
        <OrchestrationComputer 
          mode={mode} 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
        />
      }
      headerActions={
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
          style={{ 
            background: modeColors.soft,
            color: modeColors.accent,
            border: `1px solid ${modeColors.border}`
          }}
          onClick={() => setIsOrchestrating(!isOrchestrating)}
        >
          {isOrchestrating ? <Activity size={14} className="animate-pulse" /> : <Zap size={14} />}
          {isOrchestrating ? 'Orchestrating Swarm...' : 'Ignite Swarm'}
        </button>
      }
    >
      {/* Left Pane: Orchestration Chat */}
      <div 
        className="flex flex-col h-full relative"
        style={{ background: '#0D0B09' }}
      >
        {/* Code Mode Wash Background */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{ 
            background: `radial-gradient(120% 88% at 50% 0%, ${modeColors.fog} 0%, transparent 58%)` 
          }}
        />

        {/* Orchestration Controls */}
        <div className="p-6 space-y-6 relative z-1 overflow-y-auto">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold" style={{ color: TEXT.primary }}>Agentic Systems Control</h2>
            <p className="text-sm" style={{ color: TEXT.secondary }}>
              Coordinating multi-agent teams and recursive sub-agent architectures.
            </p>
          </div>

          {/* System Health */}
          <div className="grid grid-cols-2 gap-3">
             <SystemStat label="Active Agents" value="12" icon={Users} mode={mode} />
             <SystemStat label="Swarm Latency" value="24ms" icon={Zap} mode={mode} />
             <SystemStat label="Memory Load" value="1.4GB" icon={Box} mode={mode} />
             <SystemStat label="Success Rate" value="99.8%" icon={Shield} mode={mode} />
          </div>

          {/* Orchestration Log Placeholder */}
          <div className="flex flex-col gap-4">
            <div className="text-xs font-medium uppercase tracking-widest opacity-40 mb-2">Orchestration Feed</div>
            <div className="p-4 rounded-xl bg-black/40 border border-white/5 font-mono text-[11px] text-white/50 space-y-1">
               <p><span style={{ color: modeColors.accent }}>[SWARM-7]</span> Initializing Code Review Swarm...</p>
               <p><span style={{ color: modeColors.accent }}>[TEAM-B]</span> Sub-agent spawned: <span className="text-blue-400">RefactorExpert</span></p>
               <p><span style={{ color: modeColors.accent }}>[SWARM-7]</span> Analyzing delta hashes in 14 files...</p>
            </div>
          </div>
        </div>

        {/* Consistent Input Bar Area */}
        <div className="mt-auto p-6 border-t border-white/5 bg-black/40">
           <div className="h-12 rounded-xl border border-white/10 bg-white/5 flex items-center px-4 text-white/20 text-sm">
             Direct the orchestration or issue swarm commands...
           </div>
        </div>
      </div>
    </AgentSessionLayout>
  );
}

function OrchestrationComputer({ 
  mode, 
  activeTab, 
  onTabChange 
}: { 
  mode: 'code'; 
  activeTab: string; 
  onTabChange: (tab: any) => void;
}) {
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.code;
  
  return (
    <div className="flex flex-col h-full bg-black/40">
      {/* Tabs */}
      <div className="flex items-center px-4 border-b border-white/5 bg-black/20">
        <TabButton label="Orchestration" active={activeTab === 'orchestration'} onClick={() => onTabChange('orchestration')} mode={mode} />
        <TabButton label="Swarm Visualizer" active={activeTab === 'swarms'} onClick={() => onTabChange('swarms')} mode={mode} />
        <TabButton label="Output" active={activeTab === 'output'} onClick={() => onTabChange('output')} mode={mode} />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'orchestration' && <OrchestrationView mode={mode} />}
        {activeTab === 'swarms' && <SwarmView mode={mode} />}
        {activeTab === 'output' && <OutputView mode={mode} />}
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick, mode }: { label: string; active: boolean; onClick: () => void; mode: 'code' }) {
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.code;
  return (
    <button
      onClick={onClick}
      className="px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all relative"
      style={{ color: active ? modeColors.accent : TEXT.tertiary }}
    >
      {label}
      {active && (
        <motion.div 
          layoutId="code-tab-indicator"
          className="absolute bottom-0 left-0 right-0 h-0.5" 
          style={{ background: modeColors.accent }} 
        />
      )}
    </button>
  );
}

function SystemStat({ label, value, icon: Icon, mode }: { label: string, value: string, icon: any, mode: 'code' }) {
  return (
    <div className="p-3 rounded-lg bg-white/2 border border-white/5 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase tracking-wider">
        <Icon size={12} />
        <span>{label}</span>
      </div>
      <span className="text-sm font-bold text-white/80">{value}</span>
    </div>
  );
}

function OrchestrationView({ mode }: { mode: 'code' }) {
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.code;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider">Recursive Sub-Agents</h3>
        <Plus size={14} className="text-white/40 cursor-pointer" />
      </div>
      <div className="space-y-3">
        <AgentNode name="Architect-Prime" role="Orchestrator" status="online" mode={mode} />
        <div className="ml-6 space-y-3 relative">
           <div className="absolute -left-3 top-0 bottom-6 w-px bg-white/10" />
           <AgentNode name="Refactor-Expert" role="Implementation" status="active" mode={mode} />
           <AgentNode name="Review-Guard" role="Verification" status="idle" mode={mode} />
        </div>
      </div>
    </div>
  );
}

function AgentNode({ name, role, status, mode }: { name: string, role: string, status: string, mode: 'code' }) {
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.code;
  return (
    <div className="p-3 rounded-lg border border-white/5 bg-white/2 flex items-center justify-between">
       <div className="flex items-center gap-3">
          <Bot size={16} style={{ color: status === 'active' ? modeColors.accent : TEXT.tertiary }} />
          <div>
            <div className="text-xs font-bold text-white/80">{name}</div>
            <div className="text-[10px] text-white/30 uppercase">{role}</div>
          </div>
       </div>
       <div className="flex items-center gap-2">
          {status === 'active' && <Activity size={12} className="text-green-400 animate-pulse" />}
          <span className="text-[10px] uppercase tracking-tighter" style={{ color: status === 'active' ? '#4ade80' : TEXT.tertiary }}>{status}</span>
       </div>
    </div>
  );
}

function SwarmView({ mode }: { mode: 'code' }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12 text-center opacity-40">
       <Layers size={48} className="mb-4" />
       <p className="text-sm font-bold uppercase tracking-widest">Swarm Topology Visualizer</p>
       <p className="text-xs mt-1">Real-time coordinate mapping for agent swarms</p>
    </div>
  );
}

function OutputView({ mode }: { mode: 'code' }) {
  return (
    <div className="space-y-4">
       <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-4">Orchestration Output</h3>
       <div className="p-4 rounded-xl border border-white/5 bg-black/60 font-mono text-[11px] text-green-400/80 min-h-[200px]">
          {`> Swarm ignition sequence complete.
> Agents mapped to 4 available VPS threads.
> Latency calibrated at 24ms.
> Awaiting task-specific instructions...`}
       </div>
    </div>
  );
}

export default CodeModeADE;
