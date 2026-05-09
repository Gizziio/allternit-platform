"use client";
import React, { useState } from 'react';
import { ArrowRight, Palette, Layout, Slideshow, DeviceMobile, Browsers, Megaphone, CaretDown } from '@phosphor-icons/react';
import { DESIGN_DIRECTIONS, type DesignDirection } from '../../lib/design/directions';

// ── Project types ──────────────────────────────────────────────────────────────

const PROJECT_TYPES = [
  { id: 'prototype',      label: 'Web Prototype',   description: 'Interactive UI with components and flows', icon: <Browsers size={18} weight="duotone" /> },
  { id: 'slides',         label: 'Deck / Slides',   description: 'Presentations, pitch decks, reports',      icon: <Slideshow size={18} weight="duotone" /> },
  { id: 'mobile',         label: 'Mobile App',      description: 'iOS / Android native-feel prototype',      icon: <DeviceMobile size={18} weight="duotone" /> },
  { id: 'brand',          label: 'Brand System',    description: 'Tokens, palette, typography, components',  icon: <Palette size={18} weight="duotone" /> },
  { id: 'dashboard',      label: 'Dashboard',       description: 'Data-rich admin or analytics surface',     icon: <Layout size={18} weight="duotone" /> },
  { id: 'content-engine', label: 'Content Engine',  description: 'Multi-channel content + campaign system',  icon: <Megaphone size={18} weight="duotone" /> },
];

// Core 5 shown by default; rest revealed on "show all"
const CORE_DIRECTION_IDS = ['editorial-monocle', 'modern-minimal', 'warm-soft', 'tech-utility', 'brutalist-experimental'];

// ── Props ──────────────────────────────────────────────────────────────────────

interface NewProjectScreenProps {
  onStart: (config: { name: string; type: string; direction: DesignDirection }) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function NewProjectScreen({ onStart }: NewProjectScreenProps) {
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState('prototype');
  const [selectedDirection, setSelectedDirection] = useState('modern-minimal');
  const [showAllDirections, setShowAllDirections] = useState(false);

  const canStart = name.trim().length > 0;
  const direction = DESIGN_DIRECTIONS.find(d => d.id === selectedDirection) ?? DESIGN_DIRECTIONS[0];
  const visibleDirections = showAllDirections
    ? DESIGN_DIRECTIONS
    : DESIGN_DIRECTIONS.filter(d => CORE_DIRECTION_IDS.includes(d.id));

  function handleStart() {
    if (!canStart) return;
    onStart({ name: name.trim(), type: selectedType, direction });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-primary)', overflowY: 'auto' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 32px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <Palette size={16} weight="fill" color="var(--accent-primary)" />
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Allternit Design
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '48px 24px 80px' }}>
        <div style={{ width: '100%', maxWidth: 760 }}>

          {/* Heading */}
          <div style={{ marginBottom: 36 }}>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: '0 0 8px' }}>
              New project
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Name your project, pick a type and a visual direction — the agent uses these to guide every design decision.
            </p>
          </div>

          {/* Project name */}
          <Section label="Project name">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canStart) handleStart(); }}
              placeholder="e.g. Acme Dashboard, Pitch Deck v3, Brand Refresh"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '12px 16px',
                borderRadius: 10, border: '1.5px solid var(--border-default)',
                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                fontSize: 15, fontWeight: 600, outline: 'none',
              }}
            />
          </Section>

          {/* Project type */}
          <Section label="Project type">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {PROJECT_TYPES.map(pt => {
                const active = selectedType === pt.id;
                return (
                  <button key={pt.id} onClick={() => setSelectedType(pt.id)} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                    padding: '14px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    border: `1.5px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    background: active ? 'color-mix(in srgb, var(--accent-primary) 8%, transparent)' : 'var(--bg-primary)',
                    transition: 'all 0.12s',
                  }}>
                    <span style={{ color: active ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}>{pt.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: active ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{pt.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{pt.description}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Visual direction */}
          <Section label="Visual direction">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleDirections.map(dir => (
                <DirectionCard
                  key={dir.id}
                  direction={dir}
                  active={selectedDirection === dir.id}
                  onSelect={() => setSelectedDirection(dir.id)}
                />
              ))}
            </div>
            {!showAllDirections && DESIGN_DIRECTIONS.length > CORE_DIRECTION_IDS.length && (
              <button
                onClick={() => setShowAllDirections(true)}
                style={{
                  marginTop: 10, display: 'flex', alignItems: 'center', gap: 5,
                  padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)',
                  background: 'transparent', color: 'var(--text-tertiary)', fontSize: 11,
                  fontWeight: 700, cursor: 'pointer',
                }}
              >
                <CaretDown size={12} /> Show {DESIGN_DIRECTIONS.length - CORE_DIRECTION_IDS.length} more directions
              </button>
            )}
          </Section>

          {/* CTA */}
          <button
            onClick={handleStart}
            disabled={!canStart}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '14px 24px', borderRadius: 12, border: 'none',
              background: canStart ? 'var(--accent-primary)' : 'var(--surface-hover)',
              color: canStart ? '#fff' : 'var(--text-tertiary)',
              fontSize: 14, fontWeight: 800, cursor: canStart ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
          >
            Start with {direction.label.split(' — ')[0]} direction
            <ArrowRight size={16} weight="bold" />
          </button>

        </div>
      </div>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 12 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Direction card ─────────────────────────────────────────────────────────────

function DirectionCard({ direction, active, onSelect }: { direction: DesignDirection; active: boolean; onSelect: () => void }) {
  const swatchKeys: (keyof typeof direction.palette)[] = ['bg', 'surface', 'fg', 'accent'];

  return (
    <button onClick={onSelect} style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px',
      borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%',
      border: `1.5px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
      background: active ? 'color-mix(in srgb, var(--accent-primary) 6%, transparent)' : 'var(--bg-primary)',
      transition: 'all 0.12s',
    }}>
      {/* OKLch palette swatches */}
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {swatchKeys.map(key => (
          <div key={key} style={{
            width: 16, height: 36, borderRadius: 5,
            background: direction.palette[key],
            border: '1px solid rgba(0,0,0,0.07)',
            flexShrink: 0,
          }} />
        ))}
      </div>

      {/* Label + font preview + mood */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: active ? 'var(--accent-primary)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            {direction.label.split(' — ')[0]}
          </span>
          {direction.label.includes(' — ') && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {direction.label.split(' — ')[1]}
            </span>
          )}
        </div>
        {/* Live font preview */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontFamily: direction.displayFont, fontSize: 14, color: 'var(--text-primary)', fontWeight: 700 }}>
            Display
          </span>
          <span style={{ fontFamily: direction.bodyFont, fontSize: 12, color: 'var(--text-secondary)' }}>
            Body text
          </span>
          {direction.monoFont && (
            <span style={{ fontFamily: direction.monoFont, fontSize: 11, color: 'var(--text-tertiary)' }}>
              mono()
            </span>
          )}
        </div>
        {/* References */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {direction.references.slice(0, 3).map(ref => (
            <span key={ref} style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--surface-hover)', borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>
              {ref}
            </span>
          ))}
        </div>
      </div>

      {/* Accent pip */}
      <div style={{
        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
        background: direction.palette.accent,
        boxShadow: `0 0 0 2px var(--bg-primary), 0 0 0 3.5px ${direction.palette.accent}`,
      }} />
    </button>
  );
}
