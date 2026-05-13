"use client";
import React, { useState } from 'react';
import { Check, Copy, Code, Palette, TextT, FrameCorners, Cursor } from '@phosphor-icons/react';
import { useDesignInspectStore } from './DesignInspectStore';
import { inspectShape } from '@/lib/penpot/inspect';
import { pushClipboardItem } from './DesignClipboardStore';
import { DesignClipboardSidebar } from './DesignClipboardSidebar';

// ── Token definitions pulled from the design system ───────────────────────────

const COLOR_TOKENS = [
  { name: '--bg-primary',       label: 'Background Primary',    group: 'Background' },
  { name: '--bg-secondary',     label: 'Background Secondary',  group: 'Background' },
  { name: '--bg-tertiary',      label: 'Background Tertiary',   group: 'Background' },
  { name: '--text-primary',     label: 'Text Primary',          group: 'Text' },
  { name: '--text-secondary',   label: 'Text Secondary',        group: 'Text' },
  { name: '--text-tertiary',    label: 'Text Tertiary',         group: 'Text' },
  { name: '--accent-primary',   label: 'Accent Primary',        group: 'Accent' },
  { name: '--accent-chat',      label: 'Accent Chat',           group: 'Accent' },
  { name: '--border-subtle',    label: 'Border Subtle',         group: 'Border' },
  { name: '--border-default',   label: 'Border Default',        group: 'Border' },
];

const TYPE_SCALE = [
  { label: 'Display',   size: '32px', weight: '800', lh: '1.1',  ls: '-0.03em' },
  { label: 'Heading 1', size: '24px', weight: '700', lh: '1.2',  ls: '-0.02em' },
  { label: 'Heading 2', size: '18px', weight: '700', lh: '1.25', ls: '-0.01em' },
  { label: 'Heading 3', size: '15px', weight: '600', lh: '1.3',  ls: '0' },
  { label: 'Body',      size: '13px', weight: '400', lh: '1.6',  ls: '0' },
  { label: 'Small',     size: '11px', weight: '400', lh: '1.5',  ls: '0' },
  { label: 'Label',     size: '9px',  weight: '800', lh: '1',    ls: '0.1em' },
];

const SPACING_SCALE = [2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64];

const RADIUS_SCALE = [
  { label: 'xs', value: '4px' },
  { label: 'sm', value: '6px' },
  { label: 'md', value: '8px' },
  { label: 'lg', value: '12px' },
  { label: 'xl', value: '16px' },
  { label: '2xl', value: '20px' },
  { label: 'full', value: '9999px' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTokenValue(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function CopyButton({ text, onCopy }: { text: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy}
      style={{ padding: '3px 7px', borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'transparent', color: copied ? '#10b981' : 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, transition: 'all 0.15s' }}>
      {copied ? <Check size={10} weight="bold" /> : <Copy size={10} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ color: 'var(--text-tertiary)' }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
    </div>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

function ColorsSection() {
  const groups = Array.from(new Set(COLOR_TOKENS.map(t => t.group)));
  return (
    <div>
      <SectionHeader icon={<Palette size={15} />} title="Color Tokens" />
      {groups.map(group => (
        <div key={group} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>{group}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {COLOR_TOKENS.filter(t => t.group === group).map(token => {
              const val = getTokenValue(token.name);
              return (
                <div key={token.name}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                    background: `var(${token.name})`,
                    border: '1px solid var(--border-subtle)',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{token.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>{token.label}</div>
                  </div>
                  <CopyButton text={`var(${token.name})`} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TypographySection() {
  return (
    <div>
      <SectionHeader icon={<TextT size={15} />} title="Type Scale" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {TYPE_SCALE.map(t => (
          <div key={t.label}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: t.size, fontWeight: t.weight, lineHeight: t.lh, letterSpacing: t.ls, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{t.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>{t.size} / {t.weight}</span>
            </div>
            <CopyButton text={`font-size: ${t.size}; font-weight: ${t.weight}; line-height: ${t.lh}; letter-spacing: ${t.ls};`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SpacingSection() {
  return (
    <div>
      <SectionHeader icon={<FrameCorners size={15} />} title="Spacing Scale" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
        {SPACING_SCALE.map(s => (
          <div key={s}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 8px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ width: Math.min(s * 1.5, 60), height: 8, borderRadius: 2, background: 'var(--accent-primary)', opacity: 0.7 }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{s}px</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RadiusSection() {
  return (
    <div>
      <SectionHeader icon={<FrameCorners size={15} />} title="Border Radius" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
        {RADIUS_SCALE.map(r => (
          <div key={r.label}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 8px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ width: 36, height: 36, borderRadius: r.label === 'full' ? 9999 : r.value, border: '2px solid var(--accent-primary)', background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>{r.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{r.value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CSSExportSection({ projectName }: { projectName: string }) {
  const css = `:root {
${COLOR_TOKENS.map(t => `  ${t.name}: /* see theme */;`).join('\n')}

  /* Typography */
  --font-display: 800 32px/1.1 system-ui;
  --font-heading: 700 24px/1.2 system-ui;
  --font-body: 400 13px/1.6 system-ui;
  --font-label: 800 9px/1 system-ui;

  /* Spacing */
${SPACING_SCALE.map(s => `  --space-${s}: ${s}px;`).join('\n')}

  /* Radius */
${RADIUS_SCALE.map(r => `  --radius-${r.label}: ${r.value};`).join('\n')}
}`;

  return (
    <div>
      <SectionHeader icon={<Code size={15} />} title="CSS Export" />
      <div style={{ position: 'relative' }}>
        <pre style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '14px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', lineHeight: 1.6, overflow: 'auto', maxHeight: 300, margin: 0 }}>
          {css}
        </pre>
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <CopyButton text={css} onCopy={() => pushClipboardItem('css', `Design System: ${projectName}`, css)} />
        </div>
      </div>
    </div>
  );
}

// ── Inspect section (live from canvas selection) ──────────────────────────────

function InspectSection() {
  const selectedShape = useDesignInspectStore(s => s.selectedShape);

  if (!selectedShape) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 10, color: 'var(--text-tertiary)' }}>
        <Cursor size={28} />
        <span style={{ fontSize: 12 }}>Select a shape in the Sketch tab</span>
      </div>
    );
  }

  const { css, cssString, variables } = inspectShape(selectedShape);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader icon={<Cursor size={15} />} title={`Inspect: ${selectedShape.name}`} />

      {/* CSS Properties table */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>CSS Properties</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {Object.entries(css).map(([prop, val]) => (
            <div key={prop} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{prop}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
              <CopyButton text={`${prop}: ${val};`} />
            </div>
          ))}
        </div>
      </div>

      {/* CSS Variables (fill colors) */}
      {Object.keys(variables).length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Fill Variables</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {Object.entries(variables).map(([name, val]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, background: val, border: '1px solid var(--border-subtle)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{name}: {val}</span>
                <CopyButton text={`${name}: ${val};`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full CSS block */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>CSS Block</div>
        <div style={{ position: 'relative' }}>
          <pre style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '14px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', lineHeight: 1.7, overflow: 'auto', maxHeight: 280, margin: 0 }}>
            {cssString}
          </pre>
          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            <CopyButton
              text={cssString}
              onCopy={() => pushClipboardItem('css', `CSS: ${selectedShape.name}`, cssString)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Section = 'inspect' | 'colors' | 'type' | 'spacing' | 'radius' | 'export';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'inspect',  label: 'Inspect',   icon: <Cursor size={13} /> },
  { id: 'colors',   label: 'Colors',    icon: <Palette size={13} /> },
  { id: 'type',     label: 'Typography',icon: <TextT size={13} /> },
  { id: 'spacing',  label: 'Spacing',   icon: <FrameCorners size={13} /> },
  { id: 'radius',   label: 'Radius',    icon: <FrameCorners size={13} /> },
  { id: 'export',   label: 'CSS Export',icon: <Code size={13} /> },
];

export function DesignHandoffView({ projectName = 'Untitled Project' }: { projectName?: string }) {
  const [active, setActive] = useState<Section>('inspect');
  const [showClipboard, setShowClipboard] = useState(false);
  const hasSelection = useDesignInspectStore(s => s.selectedShape !== null);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg-secondary)', position: 'relative' }}>

      {/* Sidebar nav */}
      <div style={{ width: 180, background: 'var(--bg-primary)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', flexShrink: 0, padding: '14px 10px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, padding: '0 6px' }}>Design Spec</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14, padding: '0 6px', lineHeight: 1.4 }}>{projectName}</div>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActive(s.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', borderRadius: 7, border: 'none', background: active === s.id ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' : 'transparent', color: active === s.id ? 'var(--accent-primary)' : 'var(--text-secondary)', fontSize: 12, fontWeight: active === s.id ? 700 : 400, cursor: 'pointer', textAlign: 'left', marginBottom: 2, transition: 'all 0.1s', width: '100%' }}>
            <span>{s.icon}</span>
            <span style={{ flex: 1 }}>{s.label}</span>
            {s.id === 'inspect' && hasSelection && (
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }} />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', minWidth: 0 }}>
        {active === 'inspect' && <InspectSection />}
        {active === 'colors'  && <ColorsSection />}
        {active === 'type'    && <TypographySection />}
        {active === 'spacing' && <SpacingSection />}
        {active === 'radius'  && <RadiusSection />}
        {active === 'export'  && <CSSExportSection projectName={projectName} />}
      </div>

      {/* Clipboard toggle button */}
      <button
        onClick={() => setShowClipboard(c => !c)}
        title="Clipboard history"
        style={{
          position: 'absolute', bottom: 16, right: showClipboard ? 256 : 16,
          width: 34, height: 34, borderRadius: '50%',
          background: showClipboard ? 'var(--accent-primary)' : 'var(--bg-primary)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: showClipboard ? '#fff' : 'var(--text-secondary)',
          transition: 'right 0.2s, background 0.15s',
          zIndex: 10,
        }}>
        <Cursor size={14} />
      </button>

      {/* Clipboard sidebar */}
      {showClipboard && (
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 240, zIndex: 9 }}>
          <DesignClipboardSidebar onPaste={() => {}} />
        </div>
      )}
    </div>
  );
}
