import React from 'react';
import {
  Terminal,
  Scroll,
  ClockCounterClockwise,
  Kanban,
  Robot,
  Clock,
  Target,
  TreeStructure,
  ListDashes,
  LockKey,
  GitDiff,
  Users,
  Shield,
  Warning,
} from '@phosphor-icons/react';

export type DrawerTabId = 
  | 'terminal' 
  | 'logs' 
  | 'executions' 
  | 'problems' 
  | 'queue' 
  | 'agents' 
  | 'scheduler' 
  | 'context'
  | 'changes'
  | 'receipts'
  | 'dag-graph'
  | 'trace'
  | 'swarm'      // NEW - Multi-agent orchestration
  | 'policy'     // NEW - Policy & governance
  | 'security';  // NEW - Security dashboard

interface DrawerTabsProps {
  activeTab: DrawerTabId;
  onTabChange: (id: DrawerTabId) => void;
}

export function DrawerTabs({ activeTab, onTabChange }: DrawerTabsProps) {
  return (
    <div style={{ display: 'flex', gap: 2, padding: '0 16px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', flexWrap: 'wrap' }}>
      {/* Primary Operations */}
      <Tab id="queue" label="Queue" icon={Kanban} active={activeTab === 'queue'} onClick={onTabChange} />
      <Tab id="terminal" label="Terminal" icon={Terminal} active={activeTab === 'terminal'} onClick={onTabChange} />
      <Tab id="logs" label="Logs" icon={Scroll} active={activeTab === 'logs'} onClick={onTabChange} />
      
      {/* Context & Changes */}
      <Tab id="context" label="Context" icon={Target} active={activeTab === 'context'} onClick={onTabChange} />
      <Tab id="changes" label="Changes" icon={GitDiff} active={activeTab === 'changes'} onClick={onTabChange} />
      
      {/* Agents & Orchestration */}
      <Tab id="agents" label="Agents" icon={Robot} active={activeTab === 'agents'} onClick={onTabChange} />
      <Tab id="swarm" label="Swarm" icon={Users} active={activeTab === 'swarm'} onClick={onTabChange} />
      
      {/* Governance & Security */}
      <Tab id="policy" label="Policy" icon={Shield} active={activeTab === 'policy'} onClick={onTabChange} />
      <Tab id="security" label="Security" icon={Warning} active={activeTab === 'security'} onClick={onTabChange} />
      
      {/* Executions & Evidence */}
      <Tab id="executions" label="Executions" icon={ClockCounterClockwise} active={activeTab === 'executions'} onClick={onTabChange} />
      <Tab id="receipts" label="Receipts" icon={LockKey} active={activeTab === 'receipts'} onClick={onTabChange} />
      
      {/* Scheduling & DAG */}
      <Tab id="scheduler" label="Scheduler" icon={Clock} active={activeTab === 'scheduler'} onClick={onTabChange} />
      <Tab id="dag-graph" label="DAG" icon={TreeStructure} active={activeTab === 'dag-graph'} onClick={onTabChange} />
      
      {/* Execution Trace */}
      <Tab id="trace" label="Trace" icon={ListDashes} active={activeTab === 'trace'} onClick={onTabChange} />
    </div>
  );
}

function Tab({ id, label, icon: Icon, active, onClick, disabled = false, tooltip }: any) {
  return (
    <button
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
          fontSize: 9,
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
