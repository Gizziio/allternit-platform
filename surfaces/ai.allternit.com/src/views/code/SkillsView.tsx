import React, { useEffect, useState } from 'react';
import { GlassCard } from '../../design/glass/GlassCard';
import { Robot, Terminal, PlugsConnected, DownloadSimple } from '@phosphor-icons/react';

interface TeamSkill {
  id: string;
  name: string;
  description?: string;
  source_repo?: string;
  version?: string;
  installed_at?: string;
}

export function SkillsView(): React.ReactNode {
  const [skills, setSkills] = useState<TeamSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/team-skills')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { skills?: TeamSkill[] }) => {
        if (cancelled) return;
        setSkills(data.skills ?? []);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const isPlugin = (skill: TeamSkill) =>
    (skill.source_repo ?? '').includes('mcp') || (skill.name ?? '').toLowerCase().includes('connector');

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Skills & Plugins</h1>
          <p style={{ margin: '8px 0 0 0', opacity: 0.6 }}>Manage your agent's capabilities and tool connections.</p>
        </div>
        <button type="button" style={{ 
          padding: '10px 20px', borderRadius: 12, 
          background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', 
          color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8 
        }}>
          <DownloadSimple size={18} /> Install from File
        </button>
      </div>

      {loading && <p style={{ opacity: 0.6 }}>Loading skills…</p>}
      {error && <p style={{ color: 'var(--status-error)' }}>Error: {error}</p>}

      {!loading && !error && skills.length === 0 && (
        <p style={{ opacity: 0.6 }}>No skills installed yet.</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
        {skills.map(skill => (
          <GlassCard key={skill.id} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ 
                width: 48, height: 48, borderRadius: 12, 
                background: 'var(--surface-hover)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isPlugin(skill) ? 'var(--status-warning)' : '#a855f7'
              }}>
                {isPlugin(skill) ? <PlugsConnected size={24} weight="duotone" /> : <Robot size={24} weight="duotone" />}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, padding: '4px 8px', borderRadius: 6, background: 'var(--bg-secondary)', opacity: 0.7 }}>
                v{skill.version || '0.0.1'}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{skill.name}</div>
              <div style={{ fontSize: 13, opacity: 0.6, lineHeight: 1.5 }}>{skill.description || 'No description.'}</div>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8 }}>
               <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                 <Terminal size={14} /> 4 Commands
               </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
