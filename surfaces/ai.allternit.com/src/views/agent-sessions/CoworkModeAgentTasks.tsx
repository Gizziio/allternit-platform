/**
 * Cowork Mode Agent Tasks - Workspace Execution
 * 
 * Focuses on policy-enforced workspace orchestration and task delegation.
 * Features:
 * - Scoped file authority via Tenant Packs
 * - Deterministic plan enforcement (DAG)
 * - Workspace execution monitoring
 * - Policy-bound orchestration
 * 
 * Uses Allternit cowork mode accent colors (soft violet purple)
 * 
 * @module CoworkModeAgentTasks
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Shield,
  Pulse as Activity,
  CheckCircle,
  Clock,
  Warning,
  Database,
  Lock,
} from '@phosphor-icons/react';

import {
  MODE_COLORS,
  TEXT,
} from '@/design/allternit.tokens';

import { AgentSessionLayout } from './AgentSessionLayout';
import type { CoworkModeAgentTasksProps } from './types';

export function CoworkModeAgentTasks({
  sessionId,
  projectId,
  onClose,
}: CoworkModeAgentTasksProps) {
  const mode = 'cowork';
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.cowork;
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState<'plan' | 'receipts' | 'policy'>('plan');

  return (
    <AgentSessionLayout
      mode={mode}
      title="Workspace Execution"
      agentName="Cowork Orchestrator"
      status={isExecuting ? 'running' : 'idle'}
      onClose={onClose}
      computerView={
        <WorkspaceComputer 
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
          onClick={() => setIsExecuting(!isExecuting)}
        >
          {isExecuting ? <Activity size={14} className="animate-pulse" /> : <Play size={14} />}
          {isExecuting ? 'Executing Plan...' : 'Start Execution'}
        </button>
      }
    >
      {/* Left Pane: Workspace Chat & Orchestration Control */}
      <div 
        className="flex flex-col h-full relative"
        style={{ background: '#0D0B09' }}
      >
        {/* Cowork Mode Wash Background */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{ 
            background: `radial-gradient(120% 88% at 50% 0%, ${modeColors.fog} 0%, transparent 58%)` 
          }}
        />

        {/* Workspace Controls */}
        <div className="p-6 space-y-6 relative z-1 overflow-y-auto">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold" style={{ color: TEXT.primary }}>Workspace Orchestration</h2>
            <p className="text-sm" style={{ color: TEXT.secondary }}>
              Delegating tasks with scoped file authority and policy-enforced execution.
            </p>
          </div>

          {/* Tenant Pack Context */}
          <div 
            className="p-4 rounded-xl border"
            style={{ background: 'var(--surface-hover)', borderColor: modeColors.border }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} style={{ color: modeColors.accent }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: TEXT.secondary }}>Tenant Security Policy</span>
            </div>
            <div className="space-y-2">
              <PolicyItem icon={Lock} label="Filesystem Read/Write" status="Authorized" color="#4ade80" />
              <PolicyItem icon={Database} label="Long-term Memory Access" status="Authorized" color="#4ade80" />
              <PolicyItem icon={Warning} label="Destructive Actions" status="Requires Confirmation" color="#fbbf24" />
            </div>
          </div>

          {/* Chat Interface Placeholder */}
          <div className="flex flex-col gap-4">
            <div className="text-xs font-medium uppercase tracking-widest opacity-40 mb-2">Workspace Conversation</div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/5 italic text-sm text-white/40">
              Agent: I am ready to begin the Workspace Execution. Please provide the task description or confirm the current plan in the right panel.
            </div>
          </div>
        </div>

        {/* Consistent Input Bar Area (Placeholder) */}
        <div className="mt-auto p-6 border-t border-white/5 bg-black/40">
           <div className="h-12 rounded-xl border border-white/10 bg-white/5 flex items-center px-4 text-white/20 text-sm">
             Ask your workspace agent to execute a task...
           </div>
        </div>
      </div>
    </AgentSessionLayout>
  );
}

function WorkspaceComputer({ 
  mode, 
  activeTab, 
  onTabChange 
}: { 
  mode: 'cowork'; 
  activeTab: string; 
  onTabChange: (tab: any) => void;
}) {
  
  return (
    <div className="flex flex-col h-full bg-black/40">
      {/* Tabs */}
      <div className="flex items-center px-4 border-b border-white/5 bg-black/20">
        <TabButton label="Plan (DAG)" active={activeTab === 'plan'} onClick={() => onTabChange('plan')} mode={mode} />
        <TabButton label="Receipts" active={activeTab === 'receipts'} onClick={() => onTabChange('receipts')} mode={mode} />
        <TabButton label="Policy" active={activeTab === 'policy'} onClick={() => onTabChange('policy')} mode={mode} />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'plan' && <PlanView mode={mode} />}
        {activeTab === 'receipts' && <ReceiptsView mode={mode} />}
        {activeTab === 'policy' && <PolicyView mode={mode} />}
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick, mode }: { label: string; active: boolean; onClick: () => void; mode: 'cowork' }) {
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.cowork;
  return (
    <button
      onClick={onClick}
      className="px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all relative"
      style={{ color: active ? modeColors.accent : TEXT.tertiary }}
    >
      {label}
      {active && (
        <motion.div 
          layoutId="cowork-tab-indicator"
          className="absolute bottom-0 left-0 right-0 h-0.5" 
          style={{ background: modeColors.accent }} 
        />
      )}
    </button>
  );
}

function PolicyItem({ icon: Icon, label, status, color }: { icon: any, label: string, status: string, color: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2" style={{ color: TEXT.secondary }}>
        <Icon size={12} />
        <span>{label}</span>
      </div>
      <span style={{ color }}>{status}</span>
    </div>
  );
}

function PlanView({ mode }: { mode: 'cowork' }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider">Execution Graph (DAG)</h3>
        <span className="text-[10px] text-white/40">v1.2.0-stable</span>
      </div>
      <div className="space-y-2">
        <DagNode label="Initialize Workspace" status="completed" mode={mode} />
        <DagNode label="Analysis: Source Context" status="completed" mode={mode} />
        <DagNode label="Generate Implementation Plan" status="active" mode={mode} />
        <DagNode label="Apply File Deltas" status="pending" mode={mode} />
        <DagNode label="Verify Acceptance Tests" status="pending" mode={mode} />
      </div>
    </div>
  );
}

function DagNode({ label, status, mode }: { label: string; status: 'completed' | 'active' | 'pending'; mode: 'cowork' }) {
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.cowork;
  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg border border-white/5"
      style={{ background: status === 'active' ? modeColors.soft : 'transparent' }}
    >
      {status === 'completed' && <CheckCircle size={14} className="text-green-500" />}
      {status === 'active' && <Activity size={14} className="text-violet-400 animate-pulse" />}
      {status === 'pending' && <Clock size={14} className="text-white/20" />}
      <span className={`text-sm ${status === 'pending' ? 'text-white/30' : 'text-white/70'}`}>{label}</span>
    </div>
  );
}

function ReceiptsView({ mode }: { mode: 'cowork' }) {
  return (
    <div className="space-y-4">
       <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-4">Orchestration Ledger</h3>
       <div className="p-4 rounded-xl border border-white/5 bg-white/2 space-y-4">
          <div className="text-[10px] font-mono text-white/30 border-b border-white/5 pb-2">SESSION_ID: 8x-f29-k92</div>
          <p className="text-xs text-white/50 italic text-center py-4">No receipts generated for current execution phase.</p>
       </div>
    </div>
  );
}

function PolicyView({ mode }: { mode: 'cowork' }) {
  return (
    <div className="space-y-4">
       <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-4">Law Layer Enforcement</h3>
       <div className="space-y-3">
          <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-[11px] text-red-400/80">
            <strong>CRITICAL:</strong> Destructive file deletions are globally restricted by Law Layer 1.
          </div>
          <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10 text-[11px] text-green-400/80">
            <strong>ALLOWED:</strong> Atomic file writes within tenant /outputs directory.
          </div>
       </div>
    </div>
  );
}

export default CoworkModeAgentTasks;
