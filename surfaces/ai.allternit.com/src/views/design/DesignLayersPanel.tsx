"use client";

/**
 * Floating layers panel — left side of the Sketch canvas.
 *
 * Shows all shapes on the current page as a flat list grouped by type
 * (frames at the top, then components, then UI blocks).
 * Clicking a row selects that shape in tldraw.
 * Selection in tldraw is reflected back here via the selectedShapeId prop.
 */

import React, { useState } from 'react';
import { Editor } from 'tldraw';
import {
  FrameCorners,
  Cube,
  Square,
  CaretDown,
  CaretRight,
  Eye,
  EyeSlash,
} from '@phosphor-icons/react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LayerRow {
  id: string;
  type: 'design-frame' | 'design-component' | 'design-uiblock' | string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeIcon(type: string) {
  if (type === 'design-frame') return <FrameCorners size={11} weight="bold" />;
  if (type === 'design-component') return <Cube size={11} weight="bold" />;
  return <Square size={11} />;
}

function typeColor(type: string): string {
  if (type === 'design-frame') return 'var(--accent-primary)';
  if (type === 'design-component') return '#a855f7';
  return '#f97316';
}

function typeLabel(type: string): string {
  if (type === 'design-frame') return 'Frame';
  if (type === 'design-component') return 'Component';
  if (type === 'design-uiblock') return 'Block';
  return type;
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface DesignLayersPanelProps {
  editorRef: React.MutableRefObject<Editor | null>;
  shapes: LayerRow[];
  selectedShapeId: string | null;
  onSelectShape: (id: string) => void;
}

export function DesignLayersPanel({
  editorRef,
  shapes,
  selectedShapeId,
  onSelectShape,
}: DesignLayersPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const toggleHide = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const editor = editorRef.current;
    if (!editor) return;
    const shape = editor.getShape(id as any);
    if (!shape) return;
    if (shape.type === 'design-uiblock') return;
    const currentOpacity = typeof (shape as any).props?.opacity === 'number'
      ? (shape as any).props.opacity
      : 1;
    const nextHidden = currentOpacity === 0;
    editor.updateShapes([{
      id: id as any,
      type: (shape as any).type,
      props: { opacity: nextHidden ? 1 : 0 },
    }]);
    setHidden(prev => {
      const next = new Set(prev);
      if (nextHidden) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Group: frames → components → blocks
  const frames     = shapes.filter(s => s.type === 'design-frame');
  const components = shapes.filter(s => s.type === 'design-component');
  const blocks     = shapes.filter(s => s.type === 'design-uiblock');
  const others     = shapes.filter(s => !['design-frame','design-component','design-uiblock'].includes(s.type));

  const groups = [
    { label: 'Frames',     items: frames,     type: 'design-frame' },
    { label: 'Components', items: components, type: 'design-component' },
    { label: 'UI Blocks',  items: blocks,     type: 'design-uiblock' },
    { label: 'Other',      items: others,     type: 'other' },
  ].filter(g => g.items.length > 0);

  return (
    <div style={{
      position: 'absolute',
      top: 12,
      left: 12,
      width: 196,
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      zIndex: 300,
      maxHeight: 'calc(100% - 24px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 12px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          borderBottom: collapsed ? 'none' : '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
        <span style={{ color: 'var(--text-tertiary)' }}>
          {collapsed ? <CaretRight size={11} /> : <CaretDown size={11} />}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Layers</span>
        <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
          {shapes.length}
        </span>
      </button>

      {/* Layer list */}
      {!collapsed && (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {shapes.length === 0 && (
            <div style={{ padding: '16px 12px', fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
              No shapes yet
            </div>
          )}

          {groups.map(group => (
            <div key={group.label}>
              <div style={{
                padding: '5px 12px 3px',
                fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--text-tertiary)',
              }}>
                {group.label}
              </div>
              {group.items.map(shape => {
                const isSelected = shape.id === selectedShapeId;
                const isHidden = hidden.has(shape.id);
                return (
                  <div
                    key={shape.id}
                    onClick={() => onSelectShape(shape.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px 6px 12px',
                      background: isSelected
                        ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)'
                        : 'transparent',
                      borderLeft: isSelected
                        ? '2px solid var(--accent-primary)'
                        : '2px solid transparent',
                      cursor: 'pointer',
                      opacity: isHidden ? 0.4 : 1,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary)';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{ color: typeColor(shape.type), flexShrink: 0 }}>
                      {typeIcon(shape.type)}
                    </span>
                    <span style={{
                      flex: 1, fontSize: 11, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: isSelected ? 600 : 400,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}>
                      {shape.label}
                    </span>
                    <span
                      title={`${Math.round(shape.w)}×${Math.round(shape.h)}`}
                      style={{ fontSize: 8, color: 'var(--text-tertiary)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}
                    >
                      {Math.round(shape.w)}×{Math.round(shape.h)}
                    </span>
                    <button
                      onClick={e => toggleHide(shape.id, e)}
                      title={isHidden ? 'Show' : 'Hide'}
                      style={{
                        background: 'none', border: 'none', padding: 2,
                        cursor: 'pointer', color: 'var(--text-tertiary)',
                        opacity: 0, flexShrink: 0,
                        display: 'flex', alignItems: 'center',
                      }}
                      className="layer-eye"
                    >
                      {isHidden ? <EyeSlash size={11} /> : <Eye size={11} />}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .layer-eye { opacity: 0 !important; }
        div:hover > .layer-eye, div:hover .layer-eye { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
