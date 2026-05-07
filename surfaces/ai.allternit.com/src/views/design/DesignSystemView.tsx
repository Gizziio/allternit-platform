"use client";
import React, { useState } from 'react';
import {
  TextT, MagicWand, Plus, Check,
  ArrowRight, Swatches, Download, GridFour, Export,
  Clipboard, Lightning, PaintBucket, Ruler, Square, Rows, FrameCorners,
} from '@phosphor-icons/react';
import { useDesignSessionActions, useDesignSessionStore } from './DesignSessionStore';
import { useDesignCanvasStore, tokensToJSON, tokensToCSSVars } from './DesignCanvasStore';
import { pushClipboardItem } from './DesignClipboardStore';

// ── Token data ────────────────────────────────────────────────────────────────

const PALETTES = [
  { name: 'Zinc',    shades: ['#fafafa','#f4f4f5','#e4e4e7','#a1a1aa','#71717a','#52525b','#3f3f46','#27272a','#18181b','#09090b'] },
  { name: 'Violet',  shades: ['#f5f3ff','#ede9fe','#ddd6fe','#c4b5fd','#a78bfa','#8b5cf6','#7c3aed','#6d28d9','#5b21b6','#4c1d95'] },
  { name: 'Sky',     shades: ['#f0f9ff','#e0f2fe','#bae6fd','#7dd3fc','#38bdf8','#0ea5e9','#0284c7','#0369a1','#075985','#0c4a6e'] },
  { name: 'Emerald', shades: ['#ecfdf5','#d1fae5','#a7f3d0','#6ee7b7','#34d399','#10b981','#059669','#047857','#065f46','#064e3b'] },
  { name: 'Rose',    shades: ['#fff1f2','#ffe4e6','#fecdd3','#fda4af','#fb7185','#f43f5e','#e11d48','#be123c','#9f1239','#881337'] },
  { name: 'Amber',   shades: ['#fffbeb','#fef3c7','#fde68a','#fcd34d','#fbbf24','#f59e0b','#d97706','#b45309','#92400e','#78350f'] },
];

const SCALE_LABELS = ['50','100','200','300','400','500','600','700','800','900'];

const FONT_PAIRS = [
  { heading: 'Inter',              body: 'Inter',      tag: 'Clean & Modern',   specimen: 'The quick brown fox' },
  { heading: 'Fraunces',           body: 'Manrope',    tag: 'Editorial',        specimen: 'Crafted with care' },
  { heading: 'Space Grotesk',      body: 'DM Sans',    tag: 'Tech',             specimen: 'Ship fast, ship right' },
  { heading: 'Playfair Display',   body: 'Lato',       tag: 'Luxury',           specimen: 'Elevated by design' },
  { heading: 'Cal Sans',           body: 'Inter',      tag: 'SaaS',             specimen: 'Built for builders' },
  { heading: 'Sora',               body: 'Sora',       tag: 'Minimal',          specimen: 'Less is everything' },
];

const TYPE_SCALE = [
  { name: 'Display', size: '3rem',   weight: 800, lh: '1.08', ls: '-0.04em' },
  { name: 'H1',      size: '2rem',   weight: 700, lh: '1.15', ls: '-0.03em' },
  { name: 'H2',      size: '1.5rem', weight: 700, lh: '1.2',  ls: '-0.02em' },
  { name: 'H3',      size: '1.25rem',weight: 600, lh: '1.3',  ls: '-0.01em' },
  { name: 'Body L',  size: '1rem',   weight: 400, lh: '1.6',  ls: '0' },
  { name: 'Body',    size: '0.875rem',weight: 400, lh: '1.6', ls: '0' },
  { name: 'Label',   size: '0.75rem', weight: 600, lh: '1.4', ls: '0.01em' },
  { name: 'Caption', size: '0.6875rem',weight: 400, lh: '1.4',ls: '0.02em' },
];

const SPACING_SCALE = [
  { name: 'spacing-1',  value: '4px',  rem: '0.25rem' },
  { name: 'spacing-2',  value: '8px',  rem: '0.5rem' },
  { name: 'spacing-3',  value: '12px', rem: '0.75rem' },
  { name: 'spacing-4',  value: '16px', rem: '1rem' },
  { name: 'spacing-5',  value: '20px', rem: '1.25rem' },
  { name: 'spacing-6',  value: '24px', rem: '1.5rem' },
  { name: 'spacing-8',  value: '32px', rem: '2rem' },
  { name: 'spacing-10', value: '40px', rem: '2.5rem' },
  { name: 'spacing-12', value: '48px', rem: '3rem' },
  { name: 'spacing-16', value: '64px', rem: '4rem' },
];

const RADIUS_SCALE = [
  { name: 'radius-none',  value: '0px',   display: 0 },
  { name: 'radius-sm',    value: '4px',   display: 4 },
  { name: 'radius-md',    value: '8px',   display: 8 },
  { name: 'radius-lg',    value: '12px',  display: 12 },
  { name: 'radius-xl',    value: '16px',  display: 16 },
  { name: 'radius-2xl',   value: '24px',  display: 24 },
  { name: 'radius-full',  value: '9999px',display: 9999 },
];

const SHADOW_SCALE = [
  { name: 'shadow-xs',  value: '0 1px 2px rgba(0,0,0,0.05)',                          demo: '0 1px 2px rgba(0,0,0,0.05)' },
  { name: 'shadow-sm',  value: '0 1px 3px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)', demo: '0 1px 3px rgba(0,0,0,0.10)' },
  { name: 'shadow-md',  value: '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)', demo: '0 4px 6px rgba(0,0,0,0.07)' },
  { name: 'shadow-lg',  value: '0 10px 15px rgba(0,0,0,0.10), 0 4px 6px rgba(0,0,0,0.05)', demo: '0 10px 15px rgba(0,0,0,0.10)' },
  { name: 'shadow-xl',  value: '0 20px 25px rgba(0,0,0,0.10), 0 10px 10px rgba(0,0,0,0.04)', demo: '0 20px 25px rgba(0,0,0,0.10)' },
  { name: 'shadow-2xl', value: '0 25px 50px rgba(0,0,0,0.25)',                         demo: '0 25px 50px rgba(0,0,0,0.25)' },
];

const COMPONENT_TOKENS = [
  { name: 'Button',  icon: '⬛', vars: [['--btn-radius', '8px'], ['--btn-height', '36px'], ['--btn-font-weight', '600'], ['--btn-padding', '0 14px']] as [string, string][] },
  { name: 'Card',    icon: '🃏', vars: [['--card-radius', '12px'], ['--card-padding', '16px'], ['--card-shadow', '0 2px 8px rgba(0,0,0,0.08)']] as [string, string][] },
  { name: 'Input',   icon: '📝', vars: [['--input-radius', '8px'], ['--input-height', '36px'], ['--input-border', '1px solid']] as [string, string][] },
  { name: 'Badge',   icon: '🏷️', vars: [['--badge-radius', '20px'], ['--badge-padding', '2px 8px'], ['--badge-font-size', '11px']] as [string, string][] },
  { name: 'Modal',   icon: '💬', vars: [['--modal-radius', '16px'], ['--modal-max-width', '480px'], ['--modal-padding', '24px']] as [string, string][] },
  { name: 'Sidebar', icon: '📐', vars: [['--sidebar-width', '240px'], ['--rail-width', '52px'], ['--sidebar-item-radius', '8px']] as [string, string][] },
];

const AI_PROMPTS = [
  { label: 'Generate full design system',    icon: Lightning,  msg: (p: string) => `Generate a complete design system for "${p}" with color tokens, typography scale, spacing system, and component variants.` },
  { label: 'Create dark mode tokens',         icon: PaintBucket, msg: (p: string) => `Create a dark mode token set for "${p}" that complements the existing light theme.` },
  { label: 'Generate component library spec', icon: GridFour,   msg: (p: string) => `Write a component library spec for "${p}" covering Button, Card, Input, Modal, Table, and Navigation.` },
  { label: 'Export Tailwind config',          icon: Export,     msg: (p: string) => `Generate a Tailwind CSS configuration file with the design tokens for "${p}".` },
];

// ── Nav sections ──────────────────────────────────────────────────────────────

type SectionId = 'overview' | 'colors' | 'typography' | 'spacing' | 'radius' | 'shadows' | 'components' | 'generate';

const NAV_ITEMS: { id: SectionId; label: string; icon: React.ElementType }[] = [
  { id: 'overview',    label: 'Overview',    icon: GridFour },
  { id: 'colors',      label: 'Colors',      icon: PaintBucket },
  { id: 'typography',  label: 'Typography',  icon: TextT },
  { id: 'spacing',     label: 'Spacing',     icon: Ruler },
  { id: 'radius',      label: 'Radius',      icon: FrameCorners },
  { id: 'shadows',     label: 'Shadows',     icon: Rows },
  { id: 'components',  label: 'Components',  icon: Square },
  { id: 'generate',    label: 'Generate',    icon: MagicWand },
];

// ── Shared primitives ─────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: copied ? '#10b981' : 'var(--text-tertiary)', fontSize: 10, fontWeight: 600, cursor: 'pointer', transition: 'color 0.15s', flexShrink: 0 }}
    >
      {copied ? <Check size={10} /> : <Clipboard size={10} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function ApplyButton({ onClick, applied }: { onClick: () => void; applied?: boolean }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: 7, border: 'none', background: applied ? '#10b98120' : 'var(--accent-primary)', color: applied ? '#10b981' : '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}
    >
      {applied ? <><Check size={10} />Applied</> : <><Plus size={10} />Apply</>}
    </button>
  );
}

function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 5px', letterSpacing: '-0.015em' }}>{title}</h2>
        {description && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Section: Overview ─────────────────────────────────────────────────────────

function OverviewSection({ projectName, onNavigate }: { projectName: string; onNavigate: (s: SectionId) => void }) {
  const { tokens, shapeCount } = useDesignCanvasStore();

  const summaryCards: { id: SectionId; label: string; icon: React.ElementType; value: string; hint: string }[] = [
    { id: 'colors',     label: 'Colors',     icon: PaintBucket,  value: PALETTES.length + ' palettes',    hint: 'Base scales & canvas tokens' },
    { id: 'typography', label: 'Typography', icon: TextT,        value: FONT_PAIRS.length + ' font pairs', hint: 'Heading + body combinations' },
    { id: 'spacing',    label: 'Spacing',    icon: Ruler,        value: SPACING_SCALE.length + ' steps',   hint: '4px base grid' },
    { id: 'radius',     label: 'Radius',     icon: FrameCorners, value: RADIUS_SCALE.length + ' values',   hint: 'none → full corner scale' },
    { id: 'shadows',    label: 'Shadows',    icon: Rows,         value: SHADOW_SCALE.length + ' levels',   hint: 'xs → 2xl elevation' },
    { id: 'components', label: 'Components', icon: Square,       value: COMPONENT_TOKENS.length + ' bases', hint: 'Radii, sizing, padding' },
    { id: 'generate',   label: 'Generate',   icon: MagicWand,    value: AI_PROMPTS.length + ' prompts',    hint: 'AI-powered system generation' },
  ];

  return (
    <div>
      <SectionHeader
        title={`${projectName} — Design System`}
        description="Browse and apply tokens across all categories. Click a card to jump to that section."
      />

      {shapeCount > 0 && (
        <div style={{ marginBottom: 28, padding: '14px 18px', borderRadius: 12, background: 'color-mix(in srgb, var(--accent-primary) 6%, var(--bg-secondary))', border: '1px solid color-mix(in srgb, var(--accent-primary) 18%, transparent)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Swatches size={18} color="var(--accent-primary)" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{tokens.length} canvas tokens extracted</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>From {shapeCount} shape{shapeCount !== 1 ? 's' : ''} on the Sketch tab — colors, radii, and shadows automatically detected</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {summaryCards.map(card => {
          const Icon = card.icon;
          return (
            <button key={card.id} onClick={() => onNavigate(card.id)}
              style={{ textAlign: 'left', padding: '16px', borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--surface-panel)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Icon size={16} color="var(--accent-primary)" />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{card.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)', marginBottom: 3 }}>{card.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{card.hint}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Section: Colors ───────────────────────────────────────────────────────────

function ColorsSection({ onApply }: { onApply: (msg: string) => void }) {
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [expandedPalette, setExpandedPalette] = useState<string | null>(null);
  const { tokens } = useDesignCanvasStore();
  const canvasColors = tokens.filter(t => t.category === 'color');

  function apply(name: string) {
    setApplied(s => new Set([...s, name]));
    onApply(`Apply the ${name} color palette as the primary color scale in the design system.`);
  }

  return (
    <div>
      <SectionHeader
        title="Colors"
        description="Curated Tailwind-compatible palettes — each gives you a full 50–900 scale."
      />

      {canvasColors.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-tertiary)', marginBottom: 14 }}>Canvas tokens ({canvasColors.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {canvasColors.map((t, i) => (
              <div key={i} title={t.name} style={{ cursor: 'pointer' }} onClick={() => navigator.clipboard.writeText(t.value)}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: t.value, border: '1px solid var(--border-subtle)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 5 }} />
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.value}</div>
                {t.count > 1 && <div style={{ fontSize: 8, color: 'var(--accent-primary)', fontWeight: 700, textAlign: 'center' }}>×{t.count}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-tertiary)', marginBottom: 14 }}>Curated palettes</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {PALETTES.map(p => {
          const isExpanded = expandedPalette === p.name;
          const isApplied = applied.has(p.name);
          return (
            <div key={p.name} style={{ borderRadius: 10, border: '1px solid var(--border-subtle)', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
              <div
                onClick={() => setExpandedPalette(isExpanded ? null : p.name)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                  {p.shades.map((s, i) => (
                    <div key={i} title={`${p.name}-${SCALE_LABELS[i]}`} style={{ flex: 1, height: 24, borderRadius: 3, background: s }} />
                  ))}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', minWidth: 56, textAlign: 'right' }}>{p.name}</span>
                <ApplyButton onClick={() => apply(p.name)} applied={isApplied} />
              </div>

              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 8 }}>
                  {p.shades.map((s, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div
                        style={{ width: '100%', paddingTop: '100%', position: 'relative', borderRadius: 6, background: s, border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer' }}
                        onClick={() => navigator.clipboard.writeText(s)}
                        title={`Copy ${s}`}
                      />
                      <div style={{ fontSize: 8.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>{SCALE_LABELS[i]}</div>
                      <div style={{ fontSize: 8, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>{s}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section: Typography ───────────────────────────────────────────────────────

function TypographySection({ onApply }: { onApply: (msg: string) => void }) {
  const [selectedPair, setSelectedPair] = useState<string | null>(null);

  return (
    <div>
      <SectionHeader
        title="Typography"
        description="Font pairs and type scale. Click a pair to preview the full scale specimen."
      />

      {/* Font pairs */}
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-tertiary)', marginBottom: 14 }}>Font pairs</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 32 }}>
        {FONT_PAIRS.map(fp => {
          const isSelected = selectedPair === fp.heading;
          return (
            <div key={fp.heading}
              onClick={() => setSelectedPair(isSelected ? null : fp.heading)}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', borderRadius: 10, border: `1px solid ${isSelected ? 'var(--border-default)' : 'var(--border-subtle)'}`, background: isSelected ? 'var(--surface-panel)' : 'var(--bg-secondary)', cursor: 'pointer', transition: 'all 0.12s' }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 4 }}>
                  {fp.specimen}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {fp.heading} / {fp.body}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--accent-primary)', background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)', padding: '2px 7px', borderRadius: 5 }}>
                  {fp.tag}
                </span>
                <ApplyButton onClick={() => onApply(`Use ${fp.heading} for headings and ${fp.body} for body text in the design system.`)} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Type scale */}
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-tertiary)', marginBottom: 14 }}>Type scale</div>
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
        {TYPE_SCALE.map((t, i) => (
          <div key={t.name}
            style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', alignItems: 'center', gap: 16, padding: '14px 16px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', background: 'var(--bg-secondary)' }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t.name}</div>
            <div style={{ fontSize: t.size, fontWeight: t.weight, lineHeight: t.lh, letterSpacing: t.ls, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              The quick brown fox
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{t.size} / {t.weight}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <CopyButton text={`font-size: ${t.size};\nfont-weight: ${t.weight};\nline-height: ${t.lh};\nletter-spacing: ${t.ls};`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Spacing ──────────────────────────────────────────────────────────

function SpacingSection() {
  return (
    <div>
      <SectionHeader
        title="Spacing"
        description="4px base grid. Use CSS variables or multiply base unit for custom values."
      />
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
        {SPACING_SCALE.map((s, i) => (
          <div key={s.name}
            style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 80px auto', alignItems: 'center', gap: 16, padding: '12px 16px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', background: 'var(--bg-secondary)' }}
          >
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>--{s.name}</span>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ height: 10, width: s.value, maxWidth: 200, background: 'var(--accent-primary)', borderRadius: 2, opacity: 0.7 }} />
            </div>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>{s.value}</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{s.rem}</span>
            <CopyButton text={`--${s.name}: ${s.value};`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Radius ───────────────────────────────────────────────────────────

function RadiusSection() {
  return (
    <div>
      <SectionHeader
        title="Border radius"
        description="Corner scale from sharp to full-pill. Map tokens to CSS variables in your :root."
      />
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
        {RADIUS_SCALE.map((r, i) => (
          <div key={r.name}
            style={{ display: 'grid', gridTemplateColumns: '48px 130px 80px 1fr auto', alignItems: 'center', gap: 16, padding: '14px 16px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', background: 'var(--bg-secondary)' }}
          >
            <div style={{ width: 36, height: 36, borderRadius: Math.min(r.display, 18), border: '2px solid var(--accent-primary)', background: 'color-mix(in srgb, var(--accent-primary) 8%, transparent)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>--{r.name}</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>{r.value}</span>
            <div />
            <CopyButton text={`--${r.name}: ${r.value};`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Shadows ──────────────────────────────────────────────────────────

function ShadowsSection() {
  return (
    <div>
      <SectionHeader
        title="Shadows"
        description="Elevation scale — xs to 2xl. Use consistently to signal interactive depth."
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SHADOW_SCALE.map(s => (
          <div key={s.name} style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto', alignItems: 'center', gap: 20, padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
            <div style={{ width: 48, height: 36, borderRadius: 8, background: 'var(--bg-primary)', boxShadow: s.demo, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>--{s.name}</div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{s.value}</div>
            </div>
            <CopyButton text={`--${s.name}: ${s.value};`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Components ───────────────────────────────────────────────────────

function ComponentsSection() {
  const [copied, setCopied] = useState<string | null>(null);

  function copyAll(name: string, vars: [string, string][]) {
    navigator.clipboard.writeText(vars.map(([k, v]) => `${k}: ${v};`).join('\n'));
    setCopied(name);
    setTimeout(() => setCopied(null), 1400);
  }

  return (
    <div>
      <SectionHeader
        title="Component tokens"
        description="Per-component CSS variables. Copy to your global stylesheet and override as needed."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
        {COMPONENT_TOKENS.map(ct => (
          <div key={ct.name} style={{ borderRadius: 12, border: '1px solid var(--border-subtle)', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-panel)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{ct.name}</span>
              <button
                onClick={() => copyAll(ct.name, ct.vars)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: copied === ct.name ? '#10b981' : 'var(--text-tertiary)', fontSize: 10, fontWeight: 600, cursor: 'pointer', transition: 'color 0.15s' }}
              >
                {copied === ct.name ? <><Check size={10} />Copied</> : <><Clipboard size={10} />Copy all</>}
              </button>
            </div>
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {ct.vars.map(([key, val]) => (
                <div key={key}
                  style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <div>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{key}:</span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginLeft: 6, fontWeight: 600 }}>{val}</span>
                  </div>
                  <CopyButton text={`${key}: ${val};`} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Export + Canvas ──────────────────────────────────────────────────

function CanvasExportPanel({ projectName }: { projectName: string }) {
  const { tokens, shapeCount } = useDesignCanvasStore();
  const [copiedCss, setCopiedCss] = useState(false);

  if (shapeCount === 0) return null;

  const downloadJSON = () => {
    const blob = new Blob([tokensToJSON(tokens, projectName)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${projectName.toLowerCase().replace(/\s+/g, '-')}-tokens.json` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const copyCSS = () => {
    const css = tokensToCSSVars(tokens, projectName);
    navigator.clipboard.writeText(css).then(() => {
      pushClipboardItem('token', `Tokens CSS: ${projectName}`, css);
      setCopiedCss(true);
      setTimeout(() => setCopiedCss(false), 1400);
    });
  };

  return (
    <div style={{ marginBottom: 28, padding: '16px 18px', borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--surface-panel)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Canvas tokens ({tokens.length})</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={copyCSS} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'transparent', color: copiedCss ? '#10b981' : 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
            {copiedCss ? <Check size={11} /> : <Clipboard size={11} />} {copiedCss ? 'Copied CSS' : 'Copy CSS'}
          </button>
          <button onClick={downloadJSON} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
            <Download size={11} /> tokens.json
          </button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>From {shapeCount} shape{shapeCount !== 1 ? 's' : ''} on the Sketch canvas</div>
    </div>
  );
}

// ── Section: Generate ─────────────────────────────────────────────────────────

function GenerateSection({ projectName, onGenerate }: { projectName: string; onGenerate: (msg: string) => void }) {
  return (
    <div>
      <SectionHeader
        title="AI generation"
        description="Let the agent build or extend your design system. Each prompt injects the project context."
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {AI_PROMPTS.map(p => {
          const Icon = p.icon;
          return (
            <button key={p.label} onClick={() => onGenerate(p.msg(projectName))}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--surface-panel)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={15} color="var(--accent-primary)" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{p.label}</span>
              <ArrowRight size={14} color="var(--text-tertiary)" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DesignSystemView({ projectName = 'Untitled Project' }: { projectName?: string }) {
  const activeSessionId = useDesignSessionStore(s => s.activeSessionId);
  const { sendMessageStream } = useDesignSessionActions();
  const [activeSection, setActiveSection] = useState<SectionId>('overview');

  const onGenerate = (msg: string) => {
    if (activeSessionId) sendMessageStream(activeSessionId, { text: `[Design System] ${msg}` });
  };

  const sectionContent: Record<SectionId, React.ReactNode> = {
    overview:   <OverviewSection projectName={projectName} onNavigate={setActiveSection} />,
    colors:     <ColorsSection onApply={onGenerate} />,
    typography: <TypographySection onApply={onGenerate} />,
    spacing:    <SpacingSection />,
    radius:     <RadiusSection />,
    shadows:    <ShadowsSection />,
    components: <ComponentsSection />,
    generate:   (
      <>
        <CanvasExportPanel projectName={projectName} />
        <GenerateSection projectName={projectName} onGenerate={onGenerate} />
      </>
    ),
  };

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--bg-primary)' }}>

      {/* Left nav */}
      <div style={{ width: 192, flexShrink: 0, borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', padding: '20px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-tertiary)', padding: '4px 8px', marginBottom: 6 }}>
          Design System
        </div>
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button key={item.id} onClick={() => setActiveSection(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8,
                border: 'none', background: isActive ? 'color-mix(in srgb, var(--accent-primary) 10%, var(--bg-primary))' : 'transparent',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: isActive ? 600 : 400, cursor: 'pointer',
                transition: 'all 0.12s', textAlign: 'left', width: '100%',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-primary)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon size={14} weight={isActive ? 'fill' : 'regular'} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        <div style={{ maxWidth: 860 }}>
          {sectionContent[activeSection]}
        </div>
      </div>

    </div>
  );
}
