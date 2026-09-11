// @ts-nocheck
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
import { cn } from '@/lib/utils';

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
    <button type="button"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: copied ? '#10b981' : 'var(--text-tertiary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'color 0.15s', flexShrink: 0 }}
    >
      {copied ? <Check size={10} /> : <Clipboard size={10} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function ApplyButton({ onClick, applied }: { onClick: () => void; applied?: boolean }) {
  return (
    <button type="button"
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: 7, border: 'none', background: applied ? '#10b98120' : 'var(--accent-primary)', color: applied ? '#10b981' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}
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
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>From {shapeCount} shape{shapeCount !== 1 ? 's' : ''} on the Sketch tab — colors, radii, and shadows automatically detected</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {summaryCards.map(card => {
          const Icon = card.icon;
          return (
            <button type="button" key={card.id} onClick={() => onNavigate(card.id)}
              style={{ textAlign: 'left', padding: '16px', borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--surface-panel)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Icon size={16} color="var(--accent-primary)" />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{card.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)', marginBottom: 3 }}>{card.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{card.hint}</div>
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
        <div className="mb-7">
          <div className="text-[12px] font-extrabold uppercase tracking-[0.09em] text-[var(--text-tertiary)] mb-3.5">Canvas tokens ({canvasColors.length})</div>
          <div className="flex flex-wrap gap-2.5">
            {canvasColors.map((t, i) => (
              <div role="button" tabIndex={0} key={`designsystemview-${i}`} title={t.name} className="cursor-pointer group" onClick={() => navigator.clipboard.writeText(t.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigator.clipboard.writeText(t.value); }}>
                <div className="w-11 h-11 rounded-[10px] border border-solid border-[var(--border-subtle)] shadow-[0_1px_3px_rgba(0,0,0,0.08)] mb-1.5 transition-transform group-hover:scale-105" style={{ background: t.value }} />
                <div className="text-[12px] font-mono text-[var(--text-tertiary)] text-center max-w-[44px] overflow-hidden text-ellipsis whitespace-nowrap">{t.value}</div>
                {t.count > 1 && <div className="text-[12px] font-bold text-[var(--accent-primary)] text-center">×{t.count}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[12px] font-extrabold uppercase tracking-[0.09em] text-[var(--text-tertiary)] mb-3.5">Curated palettes</div>

      <div className="flex flex-col gap-0.5">
        {PALETTES.map(p => {
          const isExpanded = expandedPalette === p.name;
          const isApplied = applied.has(p.name);
          return (
            <div key={p.name} className="rounded-[10px] border border-solid border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-secondary)]">
              <div role="button" tabIndex={0}
                onClick={() => setExpandedPalette(isExpanded ? null : p.name)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedPalette(isExpanded ? null : p.name); }}
                className="flex items-center gap-3.5 p-[12px_16px] cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
              >
                <div className="flex gap-0.5 flex-1">
                  {p.shades.map((s, i) => (
                    <div key={`designsystemview-${i}`} title={`${p.name}-${SCALE_LABELS[i]}`} className="flex-1 h-6 rounded-[3px]" style={{ background: s }} />
                  ))}
                </div>
                <span className="text-[12px] font-bold text-[var(--text-primary)] min-w-[56px] text-right">{p.name}</span>
                <ApplyButton onClick={() => apply(p.name)} applied={isApplied} />
              </div>

              {isExpanded && (
                <div className="border-t border-solid border-[var(--border-subtle)] p-[12px_16px] grid grid-cols-10 gap-2">
                  {p.shades.map((s, i) => (
                    <div key={`designsystemview-${i}`} className="flex flex-col items-center gap-1">
                      <div role="button" tabIndex={0}
                        className="w-full pt-[100%] relative rounded-md border border-solid border-[rgba(0,0,0,0.08)] cursor-pointer hover:scale-105 transition-transform" style={{ background: s }}
                        onClick={() => navigator.clipboard.writeText(s)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigator.clipboard.writeText(s); }}
                        title={`Copy ${s}`}
                      />
                      <div className="text-[12.5px] text-[var(--text-tertiary)] font-mono text-center">{SCALE_LABELS[i]}</div>
                      <div className="text-[12px] text-[var(--text-tertiary)] font-mono text-center">{s}</div>
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
      <div className="text-[12px] font-extrabold uppercase tracking-[0.09em] text-[var(--text-tertiary)] mb-3.5">Font pairs</div>
      <div className="flex flex-col gap-0.5 mb-8">
        {FONT_PAIRS.map(fp => {
          const isSelected = selectedPair === fp.heading;
          return (
            <div role="button" tabIndex={0} key={fp.heading}
              onClick={() => setSelectedPair(isSelected ? null : fp.heading)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedPair(isSelected ? null : fp.heading); }}
              className={cn("flex items-center gap-4 p-[14px_16px] rounded-[10px] border border-solid cursor-pointer transition-all duration-150", isSelected ? "border-[var(--border-default)] bg-[var(--surface-panel)]" : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:bg-[var(--surface-hover)]")}
            >
              <div className="flex-1">
                <div className="text-[22px] font-extrabold text-[var(--text-primary)] leading-[1.15] tracking-[-0.02em] mb-1">
                  {fp.specimen}
                </div>
                <div className="text-[12px] text-[var(--text-secondary)]">
                  {fp.heading} / {fp.body}
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-[12px] font-bold uppercase tracking-[0.07em] text-[var(--accent-primary)] bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)] px-1.5 py-0.5 rounded-[5px]">
                  {fp.tag}
                </span>
                <ApplyButton onClick={() => onApply(`Use ${fp.heading} for headings and ${fp.body} for body text in the design system.`)} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Type scale */}
      <div className="text-[12px] font-extrabold uppercase tracking-[0.09em] text-[var(--text-tertiary)] mb-3.5">Type scale</div>
      <div className="border border-solid border-[var(--border-subtle)] rounded-xl overflow-hidden">
        {TYPE_SCALE.map((t, i) => (
          <div key={t.name}
            className={cn("grid grid-cols-[80px_1fr_1fr_1fr] items-center gap-4 p-[14px_16px] bg-[var(--bg-secondary)]", i > 0 && "border-t border-solid border-[var(--border-subtle)]")}
          >
            <div className="text-[12px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.07em]">{t.name}</div>
            <div className="text-[var(--text-primary)] overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: t.size, fontWeight: t.weight, lineHeight: t.lh, letterSpacing: t.ls }}>
              The quick brown fox
            </div>
            <div className="text-[12px] font-mono text-[var(--text-tertiary)]">{t.size} / {t.weight}</div>
            <div className="flex justify-end">
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
      <div className="border border-solid border-[var(--border-subtle)] rounded-xl overflow-hidden">
        {SPACING_SCALE.map((s, i) => (
          <div key={s.name}
            className={cn("grid grid-cols-[120px_1fr_80px_80px_auto] items-center gap-4 p-[12px_16px] bg-[var(--bg-secondary)]", i > 0 && "border-t border-solid border-[var(--border-subtle)]")}
          >
            <span className="text-[12px] font-mono text-[var(--text-tertiary)]">--{s.name}</span>
            <div className="flex items-center">
              <div className="h-[10px] max-w-[200px] bg-[var(--accent-primary)] rounded-sm opacity-70" style={{ width: s.value }} />
            </div>
            <span className="text-[12px] font-mono text-[var(--text-primary)] font-semibold">{s.value}</span>
            <span className="text-[12px] font-mono text-[var(--text-tertiary)]">{s.rem}</span>
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
      <div className="border border-solid border-[var(--border-subtle)] rounded-xl overflow-hidden">
        {RADIUS_SCALE.map((r, i) => (
          <div key={r.name}
            className={cn("grid grid-cols-[48px_130px_80px_1fr_auto] items-center gap-4 p-[14px_16px] bg-[var(--bg-secondary)]", i > 0 && "border-t border-solid border-[var(--border-subtle)]")}
          >
            <div className="w-9 h-9 border-2 border-solid border-[var(--accent-primary)] bg-[color-mix(in_srgb,var(--accent-primary)_8%,transparent)] shrink-0" style={{ borderRadius: Math.min(r.display, 18) }} />
            <span className="text-[12px] font-mono text-[var(--text-tertiary)]">--{r.name}</span>
            <span className="text-[12px] font-mono text-[var(--text-primary)] font-semibold">{r.value}</span>
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
      <div className="flex flex-col gap-2.5">
        {SHADOW_SCALE.map(s => (
          <div key={s.name} className="grid grid-cols-[60px_1fr_auto] items-center gap-5 p-[16px_20px] rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            <div className="w-12 h-9 rounded-lg bg-[var(--bg-primary)] shrink-0" style={{ boxShadow: s.demo }} />
            <div>
              <div className="text-[12px] font-bold text-[var(--text-primary)] mb-1">--{s.name}</div>
              <div className="text-[12px] font-mono text-[var(--text-tertiary)] leading-relaxed">{s.value}</div>
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
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2.5">
        {COMPONENT_TOKENS.map(ct => (
          <div key={ct.name} className="rounded-xl border border-solid border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-secondary)]">
            <div className="flex items-center justify-between p-[12px_14px] border-b border-solid border-[var(--border-subtle)] bg-[var(--surface-panel)]">
              <span className="text-[13px] font-bold text-[var(--text-primary)]">{ct.name}</span>
              <button type="button"
                onClick={() => copyAll(ct.name, ct.vars)}
                className={cn("flex items-center gap-1 px-2 py-1 rounded-md border border-solid border-[var(--border-subtle)] bg-transparent text-[12px] font-semibold cursor-pointer transition-colors duration-150 hover:bg-[var(--surface-hover)]", copied === ct.name ? "text-[#10b981]" : "text-[var(--text-tertiary)]")}
              >
                {copied === ct.name ? <><Check size={10} />Copied</> : <><Clipboard size={10} />Copy all</>}
              </button>
            </div>
            <div className="flex flex-col gap-0 p-[10px_14px]">
              {ct.vars.map(([key, val]) => (
                <div key={key}
                  className="grid grid-cols-[1fr_auto] items-center gap-2 py-1.5 border-b border-solid border-[var(--border-subtle)]"
                >
                  <div>
                    <span className="text-[12px] font-mono text-[var(--text-tertiary)]">{key}:</span>
                    <span className="text-[12px] font-mono font-semibold text-[var(--text-primary)] ml-1.5">{val}</span>
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
    <div className="mb-7 p-[16px_18px] rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--surface-panel)]">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] font-bold text-[var(--text-primary)]">Canvas tokens ({tokens.length})</div>
        <div className="flex gap-1.5">
          <button type="button" onClick={copyCSS} className={cn("flex items-center gap-1.5 p-[6px_11px] rounded-md border border-solid border-[var(--border-subtle)] bg-transparent text-[12px] font-semibold cursor-pointer", copiedCss ? "text-[#10b981]" : "text-[var(--text-secondary)]")}>
            {copiedCss ? <Check size={11} /> : <Clipboard size={11} />} {copiedCss ? 'Copied CSS' : 'Copy CSS'}
          </button>
          <button type="button" onClick={downloadJSON} className="flex items-center gap-1.5 p-[6px_11px] rounded-md border border-solid border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] text-[12px] font-semibold cursor-pointer">
            <Download size={11} /> tokens.json
          </button>
        </div>
      </div>
      <div className="text-[12px] text-[var(--text-tertiary)]">From {shapeCount} shape{shapeCount !== 1 ? 's' : ''} on the Sketch canvas</div>
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
      <div className="flex flex-col gap-2">
        {AI_PROMPTS.map(p => {
          const Icon = p.icon;
          return (
            <button type="button" key={p.label} onClick={() => onGenerate(p.msg(projectName))}
              className="flex items-center gap-3.5 p-[14px_16px] rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] cursor-pointer text-left transition-all duration-150 hover:border-[var(--border-default)] hover:bg-[var(--surface-panel)]"
            >
              <div className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)] flex items-center justify-center shrink-0">
                <Icon size={15} className="text-[var(--accent-primary)]" />
              </div>
              <span className="text-[13px] font-semibold text-[var(--text-primary)] flex-1">{p.label}</span>
              <ArrowRight size={14} className="text-[var(--text-tertiary)]" />
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
    <div className="flex-1 flex overflow-hidden bg-[var(--bg-primary)]">

      {/* Left nav */}
      <div className="w-48 shrink-0 border-r border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-[20px_10px] flex flex-col gap-0.5 overflow-y-auto">
        <div className="text-[12px] font-extrabold uppercase tracking-[0.09em] text-[var(--text-tertiary)] p-[4px_8px] mb-1.5">
          Design System
        </div>
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button type="button" key={item.id} onClick={() => setActiveSection(item.id)}
              className={cn(
                "w-full flex items-center gap-2.5 p-[8px_10px] rounded-lg border-none text-[13px] text-left cursor-pointer transition-all duration-150",
                isActive ? "bg-[color-mix(in_srgb,var(--accent-primary)_10%,var(--bg-primary))] text-[var(--accent-primary)] font-semibold" : "bg-transparent text-[var(--text-secondary)] font-normal hover:bg-[var(--bg-primary)]"
              )}
            >
              <Icon size={14} weight={isActive ? 'fill' : 'regular'} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-[28px_32px]">
        <div className="max-w-[860px]">
          {sectionContent[activeSection]}
        </div>
      </div>

    </div>
  );
}
