import React from 'react';
import { GlassCard } from '../../design/GlassCard';
import { Robot, Terminal, PlugsConnected, DownloadSimple } from '@phosphor-icons/react';

const SKILLS = [
  { id: 's1', name: 'React Architect', version: '1.2.0', desc: 'Expert in component composition and hooks.', type: 'Skill' },
  { id: 's2', name: 'Python Data', version: '0.9.5', desc: 'Pandas/NumPy expert for data analysis.', type: 'Skill' },
  { id: 'p1', name: 'Postgres Connector', version: '2.0.1', desc: 'MCP server for PostgreSQL database access.', type: 'Plugin' },
];

export function SkillsView() {
  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Skills & Plugins</h1>
          <p style={{ margin: '8px 0 0 0', opacity: 0.6 }}>Manage your agent's capabilities and tool connections.</p>
        </div>
        <button style={{ 
          padding: '10px 20px', borderRadius: 12, 
          background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', 
          color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8 
        }}>
          <DownloadSimple size={18} /> Install from File
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
        {SKILLS.map(skill => (
          <GlassCard key={skill.id} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ 
                width: 48, height: 48, borderRadius: 12, 
                background: 'rgba(255,255,255,0.05)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: skill.type === 'Skill' ? '#a855f7' : '#f97316'
              }}>
                {skill.type === 'Skill' ? <Robot size={24} weight="duotone" /> : <PlugsConnected size={24} weight="duotone" />}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, background: 'var(--bg-secondary)', opacity: 0.7 }}>
                v{skill.version}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{skill.name}</div>
              <div style={{ fontSize: 13, opacity: 0.6, lineHeight: 1.5 }}>{skill.desc}</div>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8 }}>
               <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                 <Terminal size={14} /> 4 Commands
               </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
