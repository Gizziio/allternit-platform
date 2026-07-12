"use client";
import React, { useMemo, useState } from 'react';
import { X, MagnifyingGlass, Robot, Presentation, Layout, Palette, DeviceMobile, Image, Video, Wrench, ArrowsClockwise, FolderOpen } from '@phosphor-icons/react';
import { useSkills, type UseSkillsOptions } from '../../lib/design/use-skills';
import { discoverLocalSkills } from '../../lib/design/local-skill-discovery';
import { registerLocalSkills } from '../../lib/design/skills-api';
import type { SkillRecord, SkillMode, SkillScenario } from '../../lib/design/skill-registry';
import { SKILL_MODE_LABELS, SKILL_SCENARIO_LABELS } from '../../lib/design/skill-registry';

interface SkillPickerProps {
  initialMode?: SkillMode;
  onSelect: (skill: SkillRecord) => void;
  onClose: () => void;
}

const MODE_OPTIONS: { id: SkillMode | 'all'; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: <Robot size={14} /> },
  { id: 'prototype', label: SKILL_MODE_LABELS.prototype, icon: <Layout size={14} /> },
  { id: 'deck', label: SKILL_MODE_LABELS.deck, icon: <Presentation size={14} /> },
  { id: 'template', label: SKILL_MODE_LABELS.template, icon: <Layout size={14} /> },
  { id: 'design-system', label: SKILL_MODE_LABELS['design-system'], icon: <Palette size={14} /> },
  { id: 'image', label: SKILL_MODE_LABELS.image, icon: <Image size={14} /> },
  { id: 'video', label: SKILL_MODE_LABELS.video, icon: <Video size={14} /> },
  { id: 'utility', label: SKILL_MODE_LABELS.utility, icon: <Wrench size={14} /> },
];

const SCENARIO_OPTIONS: { id: SkillScenario | 'all'; label: string }[] = [
  { id: 'all', label: 'All scenarios' },
  { id: 'design', label: SKILL_SCENARIO_LABELS.design },
  { id: 'marketing', label: SKILL_SCENARIO_LABELS.marketing },
  { id: 'product', label: SKILL_SCENARIO_LABELS.product },
  { id: 'engineering', label: SKILL_SCENARIO_LABELS.engineering },
  { id: 'operation', label: SKILL_SCENARIO_LABELS.operation },
];

export function SkillPicker({ initialMode, onSelect, onClose }: SkillPickerProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SkillMode | 'all'>(initialMode ?? 'all');
  const [scenario, setScenario] = useState<SkillScenario | 'all'>('all');

  const options: UseSkillsOptions = useMemo(() => {
    const opts: UseSkillsOptions = { refreshInterval: 3000 };
    if (mode !== 'all') opts.mode = mode;
    if (scenario !== 'all') opts.scenario = scenario;
    if (query.trim()) opts.query = query.trim();
    return opts;
  }, [mode, scenario, query]);

  const { skills, loading, refresh } = useSkills(options);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  async function handleImportLocal() {
    setImporting(true);
    setImportErrors([]);
    const result = await discoverLocalSkills();
    setImporting(false);
    if (result.skills.length > 0) {
      registerLocalSkills(result.skills);
      refresh();
    }
    if (result.errors.length > 0) {
      setImportErrors(result.errors);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<SkillMode, SkillRecord[]>();
    for (const skill of skills) {
      const list = map.get(skill.mode) ?? [];
      list.push(skill);
      map.set(skill.mode, list);
    }
    return map;
  }, [skills]);

  return (
    <div style={overlayStyles} onClick={onClose}>
      <div style={panelStyles} onClick={(e) => e.stopPropagation()}>
        <header style={headerStyles}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>Pick a skill</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
              Allternit Design skills bind a workflow to your design system.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={refresh} title="Refresh skills" style={iconButtonStyles}><ArrowsClockwise size={16} /></button>
            <button type="button" onClick={handleImportLocal} title="Import local skills directory" disabled={importing} style={{ ...iconButtonStyles, opacity: importing ? 0.5 : 1 }}>
              <FolderOpen size={16} />
            </button>
            <button type="button" onClick={onClose} style={iconButtonStyles}><X size={18} /></button>
          </div>
        </header>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <MagnifyingGlass size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              aria-label="Search skills"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search skills, triggers…"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 36px',
                borderRadius: 10, border: '1px solid var(--border-subtle)',
                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                fontSize: 13, outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {MODE_OPTIONS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)',
                  background: mode === m.id ? 'var(--accent-primary)' : 'var(--bg-primary)',
                  color: mode === m.id ? '#fff' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SCENARIO_OPTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScenario(s.id)}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)',
                  background: scenario === s.id ? 'var(--surface-hover)' : 'transparent',
                  color: scenario === s.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {importErrors.length > 0 && (
          <div style={{ padding: '10px 20px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid var(--border-subtle)' }}>
            {importErrors.map((err, i) => (
              <div key={i} style={{ fontSize: 12, color: '#ef4444', marginBottom: 4 }}>{err}</div>
            ))}
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px 20px' }}>
          {loading ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading skills…</div>
          ) : skills.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No skills match.</div>
          ) : (
            Array.from(grouped.entries()).map(([modeKey, list]) => (
              <div key={modeKey} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  {SKILL_MODE_LABELS[modeKey]}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {list.map((skill) => (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => onSelect(skill)}
                      style={{
                        textAlign: 'left', padding: 14, borderRadius: 12,
                        border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)',
                        cursor: 'pointer', transition: 'all 0.12s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <ModeIcon mode={skill.mode} />
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{skill.name}</span>
                        {skill.scenario && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {SKILL_SCENARIO_LABELS[skill.scenario]}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{skill.description}</p>
                      {skill.examplePrompt && (
                        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                          “{skill.examplePrompt}”
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ModeIcon({ mode }: { mode: SkillMode }) {
  const color = 'var(--text-tertiary)';
  switch (mode) {
    case 'prototype': return <Layout size={16} color={color} />;
    case 'deck': return <Presentation size={16} color={color} />;
    case 'design-system': return <Palette size={16} color={color} />;
    case 'image': return <Image size={16} color={color} />;
    case 'video': return <Video size={16} color={color} />;
    case 'audio': return <DeviceMobile size={16} color={color} />;
    case 'template': return <Layout size={16} color={color} />;
    case 'utility': return <Wrench size={16} color={color} />;
    default: return <Robot size={16} color={color} />;
  }
}

const overlayStyles: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100,
  background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 24,
};

const panelStyles: React.CSSProperties = {
  width: '100%', maxWidth: 720, maxHeight: '85vh',
  background: 'var(--surface-panel)', borderRadius: 16,
  boxShadow: '0 24px 80px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column',
  border: '1px solid var(--border-subtle)',
};

const headerStyles: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
  padding: '20px 20px 16px', borderBottom: '1px solid var(--border-subtle)',
};

const iconButtonStyles: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-subtle)',
  background: 'transparent', color: 'var(--text-secondary)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};
