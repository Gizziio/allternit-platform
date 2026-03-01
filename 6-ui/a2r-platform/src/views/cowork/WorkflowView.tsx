import React from 'react';
import { PREDEFINED_WORKFLOWS, runWorkflow } from '../../integration/kernel/workflows';
import { GlassCard } from '../../design/GlassCard';
import { Play, Lightning } from '@phosphor-icons/react';

export function WorkflowView() {
  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Lightning size={24} weight="fill" color="#eab308" />
          A2R Workflows
        </h2>
        <p style={{ fontSize: 14, opacity: 0.6 }}>Execute multi-step governed agent actions.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {PREDEFINED_WORKFLOWS.map(workflow => (
          <GlassCard key={workflow.id} style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{workflow.name}</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>{workflow.description}</div>
            </div>
            <button 
              onClick={() => runWorkflow(workflow.id)}
              style={{
                background: 'var(--accent-chat)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'opacity 0.2s'
              }}
            >
              <Play size={16} weight="fill" />
              RUN
            </button>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
