'use client';

import React, { useState } from 'react';
import { Zap, Plus, MoreVertical, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import GlassSurface from '@/design/GlassSurface';

interface Automation {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
  status: 'active' | 'disabled' | 'error';
  lastRunTime: string;
  lastRunResult: 'success' | 'failed' | 'pending';
}

const mockAutomations: Automation[] = [
  {
    id: '1',
    name: 'Run test suite on push',
    trigger: 'On push to main',
    action: 'Run test suite',
    enabled: true,
    status: 'active',
    lastRunTime: '2 hours ago',
    lastRunResult: 'success',
  },
  {
    id: '2',
    name: 'Deploy to staging',
    trigger: 'On merge to staging',
    action: 'Deploy to staging environment',
    enabled: true,
    status: 'active',
    lastRunTime: '30 minutes ago',
    lastRunResult: 'success',
  },
  {
    id: '3',
    name: 'Build Docker image',
    trigger: 'On release tag',
    action: 'Build and push Docker image',
    enabled: false,
    status: 'disabled',
    lastRunTime: '5 days ago',
    lastRunResult: 'success',
  },
  {
    id: '4',
    name: 'Notify Slack on failure',
    trigger: 'On workflow failure',
    action: 'Send notification to #engineering',
    enabled: true,
    status: 'error',
    lastRunTime: '15 minutes ago',
    lastRunResult: 'failed',
  },
];

interface AutomationRowProps {
  automation: Automation;
  onToggle: (id: string) => void;
}

const AutomationRow: React.FC<AutomationRowProps> = ({ automation, onToggle }) => {
  const getStatusIcon = () => {
    if (automation.status === 'active') {
      return <CheckCircle2 size={16} color="#34c759" />;
    } else if (automation.status === 'error') {
      return <AlertCircle size={16} color="#ff3b30" />;
    } else {
      return <Clock size={16} color="var(--text-tertiary)" />;
    }
  };

  const getStatusLabel = () => {
    if (automation.status === 'active') {
      return { label: 'Active', color: '#34c759' };
    } else if (automation.status === 'error') {
      return { label: 'Error', color: '#ff3b30' };
    } else {
      return { label: 'Disabled', color: 'var(--text-tertiary)' };
    }
  };

  const getResultColor = () => {
    if (automation.lastRunResult === 'success') {
      return { bg: 'rgba(52, 199, 89, 0.15)', color: '#34c759', label: 'Success' };
    } else if (automation.lastRunResult === 'failed') {
      return { bg: 'rgba(255, 59, 48, 0.15)', color: '#ff3b30', label: 'Failed' };
    } else {
      return { bg: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)', label: 'Pending' };
    }
  };

  const status = getStatusLabel();
  const result = getResultColor();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '8px',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
      }}
    >
      {/* Toggle Switch */}
      <button
        onClick={() => onToggle(automation.id)}
        style={{
          width: '44px',
          height: '24px',
          borderRadius: '12px',
          backgroundColor: automation.enabled ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.3s ease',
          padding: '0',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.transform = 'scale(1)';
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: 'white',
            top: '2px',
            left: automation.enabled ? '22px' : '2px',
            transition: 'left 0.3s ease',
          }}
        />
      </button>

      {/* Automation Details */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
            {automation.name}
          </span>
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>{automation.trigger}</span>
          <span>→</span>
          <span>{automation.action}</span>
        </div>
      </div>

      {/* Status & Result */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
          {getStatusIcon()}
          <span style={{ color: status.color, fontWeight: '600' }}>{status.label}</span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '2px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              color: result.color,
              fontWeight: '500',
              padding: '2px 6px',
              backgroundColor: result.bg,
              borderRadius: '3px',
            }}
          >
            {result.label}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{automation.lastRunTime}</span>
        </div>
      </div>

      {/* Menu Button */}
      <button
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
          (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
        }}
      >
        <MoreVertical size={16} />
      </button>
    </div>
  );
};

export const AutomationsView: React.FC = () => {
  const [automations, setAutomations] = useState<Automation[]>(mockAutomations);

  const handleToggleAutomation = (id: string) => {
    setAutomations((prev) =>
      prev.map((automation) =>
        automation.id === id
          ? {
              ...automation,
              enabled: !automation.enabled,
              status: !automation.enabled ? 'active' : 'disabled',
            }
          : automation
      )
    );
  };

  const activeCount = automations.filter((a) => a.enabled).length;
  const totalCount = automations.length;

  // Calculate total runs today
  const totalRunsToday = 12;

  return (
    <GlassSurface>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-secondary)' }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Zap size={20} color="var(--accent-primary)" />
              <div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Automations
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  Trigger-based workflow automation
                </div>
              </div>
            </div>
            <button
              style={{
                padding: '8px 14px',
                backgroundColor: 'var(--accent-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.opacity = '0.85';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.opacity = '1';
              }}
            >
              <Plus size={14} />
              New Automation
            </button>
          </div>

          {/* Stats Bar */}
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              padding: '8px 0',
              borderTop: '1px solid var(--border-subtle)',
              marginTop: '12px',
              paddingTop: '12px',
            }}
          >
            <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
              {totalCount} automations
            </span>
            <span> • </span>
            <span style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>
              {activeCount} active
            </span>
            <span> • </span>
            <span>ran {totalRunsToday} times today</span>
          </div>
        </div>

        {/* Automation List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {automations.map((automation) => (
              <AutomationRow
                key={automation.id}
                automation={automation}
                onToggle={handleToggleAutomation}
              />
            ))}
          </div>
        </div>
      </div>
    </GlassSurface>
  );
};

export default AutomationsView;
