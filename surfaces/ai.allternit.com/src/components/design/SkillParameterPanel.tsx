"use client";
import React from 'react';
import { Sliders } from '@phosphor-icons/react';
import type { SkillRecord, SkillParameter } from '../../lib/design/skill-registry';

interface SkillParameterPanelProps {
  skill: SkillRecord;
  values: Record<string, number>;
  onChange: (values: Record<string, number>) => void;
  onReplan?: () => void;
}

export function SkillParameterPanel({ skill, values, onChange, onReplan }: SkillParameterPanelProps) {
  if (!skill.parameters.length) return null;

  function update(name: string, value: number) {
    onChange({ ...values, [name]: value });
  }

  return (
    <div style={{
      background: 'var(--surface-panel)', border: '1px solid var(--border-subtle)',
      borderRadius: 12, padding: '12px 14px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Sliders size={16} color="var(--accent-primary)" weight="bold" />
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{skill.name} parameters</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {skill.parameters.map((param) => (
          <ParameterSlider
            key={param.name}
            param={param}
            value={values[param.name] ?? param.default}
            onChange={(v) => update(param.name, v)}
          />
        ))}
      </div>

      {onReplan && (
        <button
          type="button"
          onClick={onReplan}
          style={{
            marginTop: 14, width: '100%', padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--accent-primary)', background: 'var(--accent-primary)', color: '#fff',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Apply and re-plan
        </button>
      )}
    </div>
  );
}

function ParameterSlider({ param, value, onChange }: { param: SkillParameter; value: number; onChange: (v: number) => void }) {
  const [min, max] = param.range;
  const label = param.label ?? param.name;

  function format(v: number): string {
    if (param.type === 'hue') return `${Math.round(v)}°`;
    if (param.type === 'opacity') return `${Math.round(v)}%`;
    return String(Math.round(v));
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{format(value)}</span>
      </div>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
      />
    </div>
  );
}
