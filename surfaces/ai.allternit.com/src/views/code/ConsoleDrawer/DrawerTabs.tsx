import React from 'react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  Terminal,
  Scroll,
  ClockCounterClockwise,
  Kanban,
  Clock,
  Target,
  LockKey,
  GitDiff,
  Users,
  Shield,
  Warning,
  Gear,
  ChartBar,
  ChartLine,
  Cpu,
  Package,
  Robot,
} from '@phosphor-icons/react';

export type DrawerTabId = 
  | 'terminal' 
  | 'logs' 
  | 'executions' 
  | 'problems' 
  | 'queue' 
  | 'agents' 
  | 'automation'
  | 'scheduler' 
  | 'context'
  | 'changes'
  | 'receipts'
  | 'dag-graph'
  | 'trace'
  | 'swarm'
  | 'policy'
  | 'security'
  | 'board'      // NEW - Workspace Kanban board
  | 'gantt'      // NEW - Gantt chart
  | 'workload'   // NEW - Workload analysis
  | 'inbox'      // NEW - Assignment inbox
  | 'runtime'   // NEW - Agent Runtime dashboard
  | 'artifacts';

interface DrawerTabsProps {
  activeTab: DrawerTabId;
  onTabChange: (id: DrawerTabId) => void;
}

export function DrawerTabs({ activeTab, onTabChange }: DrawerTabsProps) {
  return (
    <div style={{ display: 'flex', gap: 2, padding: '0 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-hover)', flexWrap: 'wrap' }}>
      {/* Primary Operations */}
      <Tab id="queue" label="Queue" icon={Kanban} active={activeTab === 'queue'} onClick={onTabChange} />
      <Tab id="terminal" label="Terminal" icon={Terminal} active={activeTab === 'terminal'} onClick={onTabChange} />
      <Tab id="logs" label="Logs" icon={Scroll} active={activeTab === 'logs'} onClick={onTabChange} />
      
      {/* Context & Changes */}
      <Tab id="context" label="Context" icon={Target} active={activeTab === 'context'} onClick={onTabChange} />
      <Tab id="changes" label="Changes" icon={GitDiff} active={activeTab === 'changes'} onClick={onTabChange} />
      
      {/* Agents & Orchestration */}
      <Tab id="automation" label="Automation" icon={Gear} active={activeTab === 'automation'} onClick={onTabChange} />
      <Tab id="agents" label="Orchestrate" icon={Robot} active={activeTab === 'agents'} onClick={onTabChange} />
      <Tab id="swarm" label="Swarm" icon={Users} active={activeTab === 'swarm'} onClick={onTabChange} />
      
      {/* Governance & Security */}
      <Tab id="policy" label="Policy" icon={Shield} active={activeTab === 'policy'} onClick={onTabChange} />
      <Tab id="security" label="Security" icon={Warning} active={activeTab === 'security'} onClick={onTabChange} />
      
      {/* Executions & Evidence */}
      <Tab id="executions" label="Executions" icon={ClockCounterClockwise} active={activeTab === 'executions'} onClick={onTabChange} />
      <Tab id="artifacts" label="Artifacts" icon={Package} active={activeTab === 'artifacts'} onClick={onTabChange} />
      <Tab id="receipts" label="Receipts" icon={LockKey} active={activeTab === 'receipts'} onClick={onTabChange} />
      
      {/* Scheduling */}
      <Tab id="scheduler" label="Scheduler" icon={Clock} active={activeTab === 'scheduler'} onClick={onTabChange} />
      
      {/* Board & Planning */}
      <Tab id="board" label="Board" icon={Kanban} active={activeTab === 'board'} onClick={onTabChange} />
      <Tab id="gantt" label="Gantt" icon={ChartBar} active={activeTab === 'gantt'} onClick={onTabChange} />
      <Tab id="workload" label="Workload" icon={ChartLine} active={activeTab === 'workload'} onClick={onTabChange} />
      <Tab id="inbox" label="Peers" icon={Users} active={activeTab === 'inbox'} onClick={onTabChange} />
      <Tab id="runtime" label="Runtimes" icon={Cpu} active={activeTab === 'runtime'} onClick={onTabChange} />
      
    </div>
  );
}

interface TabProps {
  id: DrawerTabId;
  label: string;
  icon: PhosphorIcon;
  active: boolean;
  onClick: (id: DrawerTabId) => void;
  disabled?: boolean;
  tooltip?: string;
}

function Tab({ id, label, icon: Icon, active, onClick, disabled = false, tooltip }: TabProps) {
  return (
    <button type="button"
      onClick={() => !disabled && onClick(id)}
      disabled={disabled}
      title={tooltip}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent-chat)' : '2px solid transparent',
        color: active ? 'var(--text-primary)' : disabled ? 'var(--text-tertiary)' : 'var(--text-tertiary)',
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: active ? 1 : disabled ? 0.4 : 0.7,
        transition: 'all 0.2s',
        position: 'relative',
      }}
    >
      <Icon size={14} weight={active ? 'fill' : 'regular'} />
      {label}
      {disabled && (
        <span style={{
          fontSize: 12,
          marginLeft: 4,
          padding: '1px 4px',
          background: 'var(--border-subtle)',
          borderRadius: 3,
          color: 'var(--text-tertiary)',
        }}>
          Soon
        </span>
      )}
    </button>
  );
}
