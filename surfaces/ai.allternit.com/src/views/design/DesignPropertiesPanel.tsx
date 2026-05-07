"use client";

/**
 * Floating right-side panel in the Sketch canvas.
 *
 * Reads the selected tldraw shape via DesignInspectStore and renders
 * editable controls for fill, opacity, border-radius, stroke, and shadow.
 * On change it calls editor.updateShapes() to write the prop back immediately.
 */

import React, { useCallback } from 'react';
import { Editor } from 'tldraw';
import { useDesignInspectStore } from './DesignInspectStore';
import type { PenpotLayout, PenpotFlexDirection, PenpotAlignItems, PenpotJustifyContent } from '@/lib/penpot/schema';

// ─── Tiny form primitives ─────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', width: 72, flexShrink: 0, fontWeight: 600 }}>{label}</span>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, min = 0, max = 9999, step = 1, suffix }: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; suffix?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
      <input
        type="number"
        value={value}
        min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 5, padding: '3px 6px', fontSize: 11, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', minWidth: 0 }}
      />
      {suffix && <span style={{ fontSize: 9, color: 'var(--text-tertiary)', flexShrink: 0 }}>{suffix}</span>}
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
      <input
        type="color"
        value={value || '#ffffff'}
        onChange={e => onChange(e.target.value)}
        style={{ width: 28, height: 26, padding: 2, border: '1px solid var(--border-subtle)', borderRadius: 5, background: 'var(--bg-tertiary)', cursor: 'pointer', flexShrink: 0 }}
      />
      <input
        type="text"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder="#ffffff"
        style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 5, padding: '3px 6px', fontSize: 11, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', minWidth: 0 }}
      />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8, marginTop: 12, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 5 }}>
      {children}
    </div>
  );
}

function SegmentedControl<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 2, flex: 1, background: 'var(--bg-tertiary)', borderRadius: 6, padding: 2 }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: '3px 4px', borderRadius: 4, border: 'none', cursor: 'pointer',
            background: value === opt.value ? 'var(--bg-primary)' : 'transparent',
            color: value === opt.value ? 'var(--text-primary)' : 'var(--text-tertiary)',
            fontSize: 9, fontWeight: value === opt.value ? 700 : 400,
            boxShadow: value === opt.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.1s',
          }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface DesignPropertiesPanelProps {
  editorRef: React.MutableRefObject<Editor | null>;
  /** The tldraw shape id of the currently selected shape (from editor.getSelectedShapes()[0]) */
  selectedShapeId: string | null;
}

export function DesignPropertiesPanel({ editorRef, selectedShapeId }: DesignPropertiesPanelProps) {
  const selectedShape = useDesignInspectStore(s => s.selectedShape);

  if (!selectedShape || !selectedShapeId) {
    return (
      <div style={panelStyle}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0' }}>
          Select a shape
        </div>
      </div>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const update = useCallback((props: Record<string, unknown>) => {
    const editor = editorRef.current;
    if (!editor || !selectedShapeId) return;
    editor.updateShapes([{ id: selectedShapeId as any, type: (editor.getShape(selectedShapeId as any) as any)?.type, props }]);
  }, [editorRef, selectedShapeId]);

  const fills = (selectedShape as any).fills ?? [];
  const strokes = (selectedShape as any).strokes ?? [];
  const shadows = (selectedShape as any).shadows ?? [];
  const opacity = (selectedShape as any).opacity ?? 1;
  const rx = (selectedShape as any).rx ?? 0;

  const fillColor = fills[0]?.fillColor ?? '#ffffff';
  const fillOpacity = fills[0]?.fillOpacity ?? 1;
  const strokeColor = strokes[0]?.strokeColor ?? '#000000';
  const strokeWidth = strokes[0]?.strokeWidth ?? 1;
  const shadowX = shadows[0]?.offsetX ?? 0;
  const shadowY = shadows[0]?.offsetY ?? 4;
  const shadowBlur = shadows[0]?.blur ?? 8;
  const shadowOpacity = shadows[0]?.color?.opacity ?? 0;

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {selectedShape.name}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 12, marginTop: -8 }}>{selectedShape.type}</div>

      {/* Geometry */}
      <SectionLabel>Size</SectionLabel>
      <Row label="W">
        <NumberInput value={selectedShape.width} onChange={v => update({ w: v })} suffix="px" />
      </Row>
      <Row label="H">
        <NumberInput value={selectedShape.height} onChange={v => update({ h: v })} suffix="px" />
      </Row>

      {/* Fill */}
      <SectionLabel>Fill</SectionLabel>
      <Row label="Color">
        <ColorInput
          value={fillColor}
          onChange={color => update({ fill: color, fills: [{ fillType: 'plain', fillColor: color, fillOpacity: fillOpacity }] })}
        />
      </Row>
      <Row label="Opacity">
        <NumberInput
          value={Math.round(fillOpacity * 100)}
          onChange={v => update({ fills: [{ fillType: 'plain', fillColor: fillColor, fillOpacity: v / 100 }] })}
          min={0} max={100} suffix="%"
        />
      </Row>

      {/* Layer opacity */}
      <SectionLabel>Layer</SectionLabel>
      <Row label="Opacity">
        <NumberInput
          value={Math.round(opacity * 100)}
          onChange={v => update({ opacity: v / 100 })}
          min={0} max={100} suffix="%"
        />
      </Row>

      {/* Radius (frames & rects) */}
      {(selectedShape.type === 'frame' || selectedShape.type === 'rect') && (
        <>
          <SectionLabel>Corners</SectionLabel>
          <Row label="Radius">
            <NumberInput value={rx} onChange={v => update({ rx: v, ry: v })} min={0} suffix="px" />
          </Row>
        </>
      )}

      {/* Stroke */}
      <SectionLabel>Stroke</SectionLabel>
      <Row label="Color">
        <ColorInput
          value={strokeColor}
          onChange={color => {
            const next = [...strokes];
            if (!next[0]) next[0] = { strokeStyle: 'solid', strokeAlignment: 'center', strokeWidth: 1 };
            next[0] = { ...next[0], strokeColor: color };
            update({ strokes: next });
          }}
        />
      </Row>
      <Row label="Width">
        <NumberInput
          value={strokeWidth}
          onChange={w => {
            const next = [...strokes];
            if (!next[0]) next[0] = { strokeStyle: 'solid', strokeAlignment: 'center', strokeColor: strokeColor };
            next[0] = { ...next[0], strokeWidth: w };
            update({ strokes: next });
          }}
          min={0} max={32} suffix="px"
        />
      </Row>

      {/* Shadow */}
      <SectionLabel>Shadow</SectionLabel>
      <Row label="Opacity">
        <NumberInput
          value={Math.round(shadowOpacity * 100)}
          onChange={v => {
            const next = [...shadows];
            const base = next[0] ?? { offsetX: shadowX, offsetY: shadowY, blur: shadowBlur, style: 'drop-shadow' };
            next[0] = { ...base, hidden: v === 0, color: { color: '#000000', opacity: v / 100 } };
            update({ shadows: next });
          }}
          min={0} max={100} suffix="%"
        />
      </Row>
      <Row label="Blur">
        <NumberInput
          value={shadowBlur}
          onChange={v => {
            const next = [...shadows];
            const base = next[0] ?? { offsetX: shadowX, offsetY: shadowY, style: 'drop-shadow', color: { color: '#000000', opacity: shadowOpacity } };
            next[0] = { ...base, blur: v, hidden: shadowOpacity === 0 };
            update({ shadows: next });
          }}
          min={0} max={64} suffix="px"
        />
      </Row>
      <Row label="Y">
        <NumberInput
          value={shadowY}
          onChange={v => {
            const next = [...shadows];
            const base = next[0] ?? { offsetX: shadowX, blur: shadowBlur, style: 'drop-shadow', color: { color: '#000000', opacity: shadowOpacity } };
            next[0] = { ...base, offsetY: v, hidden: shadowOpacity === 0 };
            update({ shadows: next });
          }}
          min={-64} max={64} suffix="px"
        />
      </Row>

      {/* Layout — only for frame shapes */}
      {selectedShape.type === 'frame' && (() => {
        const layout: PenpotLayout = (selectedShape as any).layout ?? {};
        const hasLayout = !!layout.layoutType;
        const gap = layout.layoutGap?.rowGap ?? 0;
        const pad = layout.layoutPadding ?? { top: 0, right: 0, bottom: 0, left: 0 };

        const updateLayout = (patch: Partial<PenpotLayout>) => {
          const next: PenpotLayout = { ...layout, ...patch };
          update({ layout: next });
        };

        return (
          <>
            <SectionLabel>Layout</SectionLabel>
            <Row label="Type">
              <SegmentedControl<'none' | 'flex'>
                options={[{ value: 'none', label: 'None' }, { value: 'flex', label: 'Flex' }]}
                value={hasLayout ? 'flex' : 'none'}
                onChange={v => updateLayout({ layoutType: v === 'flex' ? 'flex' : null })}
              />
            </Row>
            {hasLayout && (
              <>
                <Row label="Direction">
                  <SegmentedControl<PenpotFlexDirection>
                    options={[
                      { value: 'row', label: 'Row' },
                      { value: 'column', label: 'Col' },
                      { value: 'row-reverse', label: 'Row↩' },
                      { value: 'column-reverse', label: 'Col↩' },
                    ]}
                    value={layout.layoutFlexDir ?? 'row'}
                    onChange={v => updateLayout({ layoutFlexDir: v })}
                  />
                </Row>
                <Row label="Align">
                  <SegmentedControl<PenpotAlignItems>
                    options={[
                      { value: 'start', label: 'Start' },
                      { value: 'center', label: 'Center' },
                      { value: 'end', label: 'End' },
                      { value: 'stretch', label: 'Stretch' },
                    ]}
                    value={layout.layoutAlignItems ?? 'start'}
                    onChange={v => updateLayout({ layoutAlignItems: v })}
                  />
                </Row>
                <Row label="Justify">
                  <SegmentedControl<PenpotJustifyContent>
                    options={[
                      { value: 'start', label: 'Start' },
                      { value: 'center', label: 'Ctr' },
                      { value: 'end', label: 'End' },
                      { value: 'space-between', label: 'S-B' },
                    ]}
                    value={layout.layoutJustifyContent ?? 'start'}
                    onChange={v => updateLayout({ layoutJustifyContent: v })}
                  />
                </Row>
                <Row label="Wrap">
                  <SegmentedControl<'wrap' | 'nowrap'>
                    options={[{ value: 'nowrap', label: 'No wrap' }, { value: 'wrap', label: 'Wrap' }]}
                    value={layout.layoutWrap ?? 'nowrap'}
                    onChange={v => updateLayout({ layoutWrap: v })}
                  />
                </Row>
                <Row label="Gap">
                  <NumberInput value={gap} onChange={v => updateLayout({ layoutGap: { rowGap: v, columnGap: v } })} min={0} max={128} suffix="px" />
                </Row>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>Padding</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
                  {(['top','right','bottom','left'] as const).map(side => (
                    <div key={side} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', width: 24, flexShrink: 0, textAlign: 'right' }}>{side[0].toUpperCase()}</span>
                      <NumberInput
                        value={pad[side]}
                        onChange={v => updateLayout({ layoutPadding: { ...pad, [side]: v } })}
                        min={0} max={128} suffix="px"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        );
      })()}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 12,
  width: 208,
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 12,
  padding: '14px 14px 10px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
  zIndex: 300,
  maxHeight: 'calc(100% - 24px)',
  overflowY: 'auto',
};
