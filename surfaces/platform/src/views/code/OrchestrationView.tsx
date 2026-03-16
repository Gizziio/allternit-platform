import React, { useEffect } from 'react';
import { useUnifiedStore } from '@/lib/agents/unified.store';
import { GlassCard } from '../../design/GlassCard';
import { Circle, Activity, Clock } from 'lucide-react';
import { Robot } from '@phosphor-icons/react';

export function OrchestrationView() {
  const { 
    agents,
    wihs,
    fetchWihs,
    fetchAgents,
    selectWih,
    setActiveMainTab,
  } = useUnifiedStore();

  // Fetch data on mount
  useEffect(() => {
    fetchWihs();
    fetchAgents();
  }, [fetchWihs, fetchAgents]);

  const handleAgentClick = (wihId: string) => {
    if (wihId) {
      selectWih(wihId);
      setActiveMainTab('work');
    }
  };

  return (
    <div style={{ 
      padding: 24, 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
      gap: 16,
      height: '100%',
      overflow: 'auto'
    }}>
      {agents.length === 0 ? (
        <div style={{ 
          gridColumn: '1 / -1',
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#666',
          padding: 60
        }}>
          <Robot size={64} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p>No active agents</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>Agents appear when they pickup WIHs</p>
        </div>
      ) : (
        agents.map(agent => (
          <div 
            key={agent.agentId}
            onClick={() => agent.currentWihId && handleAgentClick(agent.currentWihId)}
            style={{ cursor: agent.currentWihId ? 'pointer' : 'default' }}
          >
          <GlassCard style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ 
                width: 48, 
                height: 48, 
                borderRadius: '50%', 
                background: 'var(--bg-secondary)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--accent-chat)',
                border: `2px solid ${getStatusColor(agent.status)}`
              }}>
                <Robot size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{agent.name}</div>
                <div style={{ fontSize: 12, opacity: 0.6 }}>{agent.role}</div>
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6, 
                fontSize: 11, 
                fontWeight: 600,
                padding: '4px 10px',
                background: `${getStatusColor(agent.status)}20`,
                borderRadius: 4,
                color: getStatusColor(agent.status)
              }}>
                <Circle size={8} fill={getStatusColor(agent.status)} />
                {agent.status}
              </div>
            </div>

            {agent.currentWihId ? (
              <div style={{ 
                background: 'rgba(0,0,0,0.05)', 
                padding: '12px', 
                borderRadius: 8, 
                border: '1px solid var(--border-subtle)'
              }}>
                <div style={{ 
                  fontSize: 10, 
                  fontWeight: 700, 
                  opacity: 0.5, 
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5
                }}>
                  Currently Executing
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {wihs.find(w => w.wih_id === agent.currentWihId)?.title || agent.currentWihId}
                </div>
                <div style={{ 
                  fontSize: 11, 
                  color: '#888',
                  marginTop: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <Clock size={10} />
                  Active since {new Date(agent.lastActiveAt).toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <div style={{ 
                fontSize: 13, 
                opacity: 0.4, 
                fontStyle: 'italic', 
                padding: 12,
                textAlign: 'center'
              }}>
                Waiting for assignment...
              </div>
            )}
          </GlassCard>
          </div>
        ))
      )}
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'working': return '#10b981';
    case 'waiting': return '#f59e0b';
    case 'idle': return '#8e8e93';
    default: return '#8e8e93';
  }
}
