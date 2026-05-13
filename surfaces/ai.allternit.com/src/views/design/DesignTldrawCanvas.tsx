"use client";
import React, { useCallback, useRef, useState } from 'react';
import {
  Tldraw,
  createShapeId,
  HTMLContainer,
  ShapeUtil,
  Rectangle2d,
  Editor,
  type TLResizeInfo,
  type TLShapeId,
  resizeBox,
} from 'tldraw';
import 'tldraw/tldraw.css';
import { importPenpotFile } from '@/lib/penpot/importer';
import { useDesignInspectStore } from './DesignInspectStore';
import { useDesignCanvasStore, extractTokensFromShapes } from './DesignCanvasStore';
import { DesignPropertiesPanel } from './DesignPropertiesPanel';
import { DesignLayersPanel } from './DesignLayersPanel';
import { pushClipboardItem } from './DesignClipboardStore';
import type { PenpotShape } from '@/lib/penpot/schema';
import { exportToPenpot } from '@/lib/penpot/exporter';
import type {
  PenpotFill, PenpotStroke, PenpotShadow, PenpotBlur,
  PenpotConstraintH, PenpotConstraintV,
  PenpotLayout, PenpotExport,
  PenpotComponentId, PenpotFileId,
} from '@/lib/penpot/schema';
import {
  type DesignComponentShape as IComponentShape,
  type DesignFrameShape as IFrameShape,
  type DesignUIBlockShape as IUIBlockShape,
} from '@/lib/tldraw/custom-shapes';



// ─── FrameShapeUtil ───────────────────────────────────────────────────────────

class FrameShapeUtil extends ShapeUtil<IFrameShape> {
  static override type = 'design-frame' as const;
  override canResize() { return true; }
  override canEdit() { return true; }

  override getDefaultProps(): IFrameShape['props'] {
    return {
      w: 390, h: 844, label: 'Frame', fill: '#ffffff',
      fills: [{ fillType: 'plain', fillColor: '#ffffff', fillOpacity: 1 }],
      strokes: [], shadows: [], blur: null, opacity: 1,
      rx: 0, ry: 0, clipContent: true,
      constraintH: 'left', constraintV: 'top',
      layout: null, exports: [],
    };
  }

  override getGeometry(shape: IFrameShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  override component(shape: IFrameShape) {
    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'none' }}>
        {/* Frame body */}
        <div style={{
          width: '100%', height: '100%',
          background: shape.props.fill,
          borderRadius: 4,
          border: '1.5px solid rgba(0,0,0,0.12)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Frame label */}
          <div style={{
            position: 'absolute', top: -22, left: 0,
            fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)',
            letterSpacing: '-0.01em', whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            {shape.props.label}
          </div>
          {/* Corner handle markers */}
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              position: 'absolute',
              top: i < 2 ? 0 : 'auto', bottom: i >= 2 ? 0 : 'auto',
              left: i % 2 === 0 ? 0 : 'auto', right: i % 2 === 1 ? 0 : 'auto',
              width: 8, height: 8,
              borderTop: i < 2 ? '2px solid rgba(0,100,255,0.4)' : 'none',
              borderBottom: i >= 2 ? '2px solid rgba(0,100,255,0.4)' : 'none',
              borderLeft: i % 2 === 0 ? '2px solid rgba(0,100,255,0.4)' : 'none',
              borderRight: i % 2 === 1 ? '2px solid rgba(0,100,255,0.4)' : 'none',
            }} />
          ))}
        </div>
      </HTMLContainer>
    );
  }

  override indicator(shape: IFrameShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={4} />;
  }

  override onResize(shape: IFrameShape, info: TLResizeInfo<IFrameShape>) {
    return resizeBox(shape, info);
  }
}

// ─── ComponentShapeUtil ───────────────────────────────────────────────────────

const COMPONENT_COLORS: Record<IComponentShape['props']['componentType'], { fill: string; stroke: string }> = {
  custom:  { fill: '#f8f9ff', stroke: '#818cf8' },
  button:  { fill: '#eff6ff', stroke: '#3b82f6' },
  input:   { fill: '#f0fdf4', stroke: '#22c55e' },
  card:    { fill: '#fff7ed', stroke: '#f97316' },
  nav:     { fill: '#fdf4ff', stroke: '#a855f7' },
  modal:   { fill: '#fff1f2', stroke: '#f43f5e' },
  badge:   { fill: '#fefce8', stroke: '#eab308' },
};

class ComponentShapeUtil extends ShapeUtil<IComponentShape> {
  static override type = 'design-component' as const;
  override canResize() { return true; }

  override getDefaultProps(): IComponentShape['props'] {
    return {
      w: 200, h: 120, label: 'Component', componentType: 'custom',
      fill: '#f8f9ff', stroke: '#818cf8', radius: 8,
      fills: [{ fillType: 'plain', fillColor: '#f8f9ff', fillOpacity: 1 }],
      strokes: [{ strokeColor: '#818cf8', strokeOpacity: 1, strokeStyle: 'solid', strokeWidth: 1.5, strokeAlignment: 'center' }],
      opacity: 1, componentId: null, componentFile: null,
    };
  }

  override getGeometry(shape: IComponentShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  override component(shape: IComponentShape) {
    const colors = COMPONENT_COLORS[shape.props.componentType];
    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'none' }}>
        <div style={{
          width: '100%', height: '100%',
          background: colors.fill,
          borderRadius: shape.props.radius,
          border: `1.5px dashed ${colors.stroke}`,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 4, position: 'relative',
        }}>
          {/* Component badge */}
          <div style={{
            position: 'absolute', top: -18, left: 0,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: colors.stroke, opacity: 0.8,
            }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: colors.stroke, whiteSpace: 'nowrap' }}>
              {shape.props.label}
            </span>
          </div>
          <div style={{ fontSize: 12, color: colors.stroke, fontWeight: 600, opacity: 0.6 }}>
            {shape.props.componentType === 'custom' ? '◇' : shape.props.componentType}
          </div>
        </div>
      </HTMLContainer>
    );
  }

  override indicator(shape: IComponentShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={shape.props.radius} />;
  }

  override onResize(shape: IComponentShape, info: TLResizeInfo<IComponentShape>) {
    return resizeBox(shape, info);
  }
}

// ─── UIBlockShapeUtil ─────────────────────────────────────────────────────────

function renderUIBlock(variant: IUIBlockShape['props']['variant'], w: number, h: number) {
  switch (variant) {
    case 'button-primary':
      return (
        <div style={{ width: '100%', height: '100%', background: '#3b82f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Button</span>
        </div>
      );
    case 'button-secondary':
      return (
        <div style={{ width: '100%', height: '100%', background: 'transparent', border: '1.5px solid #3b82f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#3b82f6', fontSize: 13, fontWeight: 700 }}>Button</span>
        </div>
      );
    case 'input':
      return (
        <div style={{ width: '100%', height: '100%', background: '#f9fafb', border: '1.5px solid #d1d5db', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 12px' }}>
          <span style={{ color: '#9ca3af', fontSize: 12 }}>Placeholder text…</span>
        </div>
      );
    case 'card':
      return (
        <div style={{ width: '100%', height: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ height: 12, background: '#e5e7eb', borderRadius: 4, width: '60%' }} />
          <div style={{ height: 10, background: '#f3f4f6', borderRadius: 4, width: '90%' }} />
          <div style={{ height: 10, background: '#f3f4f6', borderRadius: 4, width: '75%' }} />
        </div>
      );
    case 'nav-bar':
      return (
        <div style={{ width: '100%', height: '100%', background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 20 }}>
          <div style={{ width: 24, height: 24, background: '#3b82f6', borderRadius: 6 }} />
          {[70, 55, 65].map((w, i) => (
            <div key={i} style={{ height: 10, background: '#e5e7eb', borderRadius: 4, width: w }} />
          ))}
        </div>
      );
    case 'badge':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 20, padding: '3px 10px' }}>
            <span style={{ color: '#3b82f6', fontSize: 12, fontWeight: 700 }}>Badge</span>
          </div>
        </div>
      );
    case 'avatar':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: Math.min(w, h) - 4, height: Math.min(w, h) - 4, borderRadius: '50%', background: 'linear-gradient(135deg, #818cf8, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>A</span>
          </div>
        </div>
      );
    case 'divider':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        </div>
      );
  }
}

class UIBlockShapeUtil extends ShapeUtil<IUIBlockShape> {
  static override type = 'design-uiblock' as const;
  override canResize() { return true; }

  override getDefaultProps(): IUIBlockShape['props'] {
    return { w: 160, h: 44, variant: 'button-primary' };
  }

  override getGeometry(shape: IUIBlockShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  override component(shape: IUIBlockShape) {
    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'none' }}>
        {renderUIBlock(shape.props.variant, shape.props.w, shape.props.h)}
      </HTMLContainer>
    );
  }

  override indicator(shape: IUIBlockShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }

  override onResize(shape: IUIBlockShape, info: TLResizeInfo<IUIBlockShape>) {
    return resizeBox(shape, info);
  }
}

// ─── tldraw shape → PenpotShape (for inspect store) ──────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tldrawShapeToPenpot(shape: any): PenpotShape | null {
  if (!shape) return null;
  const base = {
    id: shape.id,
    name: shape.props?.label ?? shape.props?.variant ?? shape.id,
    x: shape.x,
    y: shape.y,
    width: shape.props?.w ?? 0,
    height: shape.props?.h ?? 0,
    fills: shape.props?.fills ?? [],
    strokes: shape.props?.strokes ?? [],
    shadows: shape.props?.shadows ?? [],
    blur: shape.props?.blur ?? undefined,
    opacity: shape.props?.opacity ?? 1,
  };
  if (shape.type === 'design-frame') {
    return {
      ...base,
      type: 'frame' as const,
      rx: shape.props?.rx ?? 0,
      ry: shape.props?.ry ?? 0,
      clipContent: shape.props?.clipContent ?? true,
      layout: shape.props?.layout ?? undefined,
      constraintH: shape.props?.constraintH ?? 'left',
      constraintV: shape.props?.constraintV ?? 'top',
      exports: shape.props?.exports ?? [],
    };
  }
  if (shape.type === 'design-component') {
    return {
      ...base,
      type: 'group' as const,
      children: [],
    };
  }
  if (shape.type === 'design-uiblock') {
    return {
      ...base,
      name: shape.props?.variant ?? 'ui-block',
      type: 'rect' as const,
    };
  }
  return null;
}

// ─── Shape registry ───────────────────────────────────────────────────────────

const customShapeUtils = [FrameShapeUtil, ComponentShapeUtil, UIBlockShapeUtil];

// ─── Toolbar ─────────────────────────────────────────────────────────────────

const FRAME_PRESETS = [
  { label: 'Mobile', w: 390, h: 844 },
  { label: 'Tablet', w: 768, h: 1024 },
  { label: 'Desktop', w: 1440, h: 900 },
  { label: '16:9', w: 1920, h: 1080 },
];

const COMPONENT_TYPES: IComponentShape['props']['componentType'][] = [
  'button', 'input', 'card', 'nav', 'modal', 'badge', 'custom',
];

const UIBLOCK_VARIANTS: IUIBlockShape['props']['variant'][] = [
  'button-primary', 'button-secondary', 'input', 'card', 'nav-bar', 'badge', 'avatar', 'divider',
];

interface DesignToolbarProps {
  onAddFrame: (w: number, h: number, label: string) => void;
  onAddComponent: (type: IComponentShape['props']['componentType']) => void;
  onAddUIBlock: (variant: IUIBlockShape['props']['variant']) => void;
  onExportSVG: () => void;
  onImportPenpot: () => void;
  onExportPenpot: () => void;
}

function DesignToolbar({ onAddFrame, onAddComponent, onAddUIBlock, onExportSVG, onImportPenpot, onExportPenpot }: DesignToolbarProps) {
  const [openPanel, setOpenPanel] = useState<'frame' | 'component' | 'block' | null>(null);

  const toggle = (panel: typeof openPanel) =>
    setOpenPanel(p => (p === panel ? null : panel));

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 11px', borderRadius: 7,
    background: active ? 'var(--accent-primary)' : 'var(--bg-secondary)',
    border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
    color: active ? '#fff' : 'var(--text-secondary)',
    fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  });

  return (
    <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {/* Main toolbar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '5px 8px', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
        <button style={btnStyle(openPanel === 'frame')} onClick={() => toggle('frame')}>＋ Frame</button>
        <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />
        <button style={btnStyle(openPanel === 'component')} onClick={() => toggle('component')}>◇ Component</button>
        <button style={btnStyle(openPanel === 'block')} onClick={() => toggle('block')}>⊞ UI Block</button>
        <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />
        <button style={{ ...btnStyle(false), color: 'var(--accent-primary)' }} onClick={onExportSVG}>↗ SVG</button>
        <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />
        <button style={{ ...btnStyle(false) }} onClick={onImportPenpot} title="Import .penpot file">⇩ Penpot</button>
        <button style={{ ...btnStyle(false) }} onClick={onExportPenpot} title="Export as .penpot file">⇧ Penpot</button>

      </div>

      {/* Frame presets panel */}
      {openPanel === 'frame' && (
        <div style={{ display: 'flex', gap: 6, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '6px 8px', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
          {FRAME_PRESETS.map(p => (
            <button key={p.label} style={btnStyle(false)}
              onClick={() => { onAddFrame(p.w, p.h, p.label); setOpenPanel(null); }}>
              {p.label}
              <span style={{ opacity: 0.5, marginLeft: 4, fontWeight: 400 }}>{p.w}×{p.h}</span>
            </button>
          ))}
        </div>
      )}

      {/* Component type panel */}
      {openPanel === 'component' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 400, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '6px 8px', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
          {COMPONENT_TYPES.map(t => (
            <button key={t} style={btnStyle(false)}
              onClick={() => { onAddComponent(t); setOpenPanel(null); }}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* UI block variant panel */}
      {openPanel === 'block' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 500, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '6px 8px', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
          {UIBLOCK_VARIANTS.map(v => (
            <button key={v} style={btnStyle(false)}
              onClick={() => { onAddUIBlock(v); setOpenPanel(null); }}>
              {v.replace('-', ' ')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DesignTldrawCanvasProps {
  projectName?: string;
  onSVGExport?: (svg: string) => void;
}

export function DesignTldrawCanvas({ projectName = 'Untitled', onSVGExport }: DesignTldrawCanvasProps) {
  const editorRef = useRef<Editor | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const setSelectedShape = useDesignInspectStore(s => s.setSelectedShape);
  const clearSelection = useDesignInspectStore(s => s.clearSelection);
  const setCanvasTokens = useDesignCanvasStore(s => s.setTokens);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [layerShapes, setLayerShapes] = useState<{ id: string; type: string; label: string; x: number; y: number; w: number; h: number; hidden: boolean }[]>([]);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Seed a default mobile frame on first mount
    const existing = editor.getCurrentPageShapes();
    if (existing.length === 0) {
      editor.createShapes([{
        id: createShapeId('default-frame'),
        type: 'design-frame',
        x: 80, y: 80,
        props: { w: 390, h: 844, label: projectName, fill: '#ffffff' },
      }]);
      editor.zoomToFit({ animation: { duration: 0 } });
    }

    // Sync selection, tokens, and layers on every canvas change
    editor.on('change', () => {
      const allShapes = editor.getCurrentPageShapes();
      const selected = editor.getSelectedShapes();

      // Rebuild layer list
      setLayerShapes(allShapes.map((s: any) => ({
        id: s.id,
        type: s.type,
        label: s.props?.label ?? s.props?.variant ?? s.props?.componentType ?? s.type,
        x: s.x, y: s.y,
        w: s.props?.w ?? 0,
        h: s.props?.h ?? 0,
        hidden: (s.props?.opacity ?? 1) === 0,
      })));

      // Update tokens from all shapes
      const tokens = extractTokensFromShapes(allShapes);
      setCanvasTokens(tokens, allShapes.length);

      // Update selected shape for inspect panel + properties panel
      if (selected.length === 1) {
        const penpot = tldrawShapeToPenpot(selected[0]);
        if (penpot) {
          setSelectedShape(penpot);
          setSelectedShapeId(selected[0].id);
        } else {
          clearSelection();
          setSelectedShapeId(null);
        }
      } else {
        clearSelection();
        setSelectedShapeId(null);
      }
    });
  }, [projectName, setSelectedShape, clearSelection, setSelectedShapeId, setCanvasTokens, setLayerShapes]);

  const addFrame = useCallback((w: number, h: number, label: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const cam = editor.getCamera();
    editor.createShapes([{
      id: createShapeId(`frame-${Date.now()}`),
      type: 'design-frame',
      x: -cam.x / cam.z + 40,
      y: -cam.y / cam.z + 40,
      props: {
        w, h, label, fill: '#ffffff',
        fills: [{ fillType: 'plain', fillColor: '#ffffff', fillOpacity: 1 }],
        strokes: [], shadows: [], blur: null, opacity: 1,
        rx: 0, ry: 0, clipContent: true,
        constraintH: 'left', constraintV: 'top',
        layout: null, exports: [],
      },
    }]);
  }, []);

  const addComponent = useCallback((componentType: IComponentShape['props']['componentType']) => {
    const editor = editorRef.current;
    if (!editor) return;
    const cam = editor.getCamera();
    const colors = COMPONENT_COLORS[componentType];
    editor.createShapes([{
      id: createShapeId(`comp-${Date.now()}`),
      type: 'design-component',
      x: -cam.x / cam.z + 40,
      y: -cam.y / cam.z + 40,
      props: {
        w: 200, h: 80, label: componentType, componentType,
        fill: colors.fill, stroke: colors.stroke, radius: 8,
        fills: [{ fillType: 'plain', fillColor: colors.fill, fillOpacity: 1 }],
        strokes: [{ strokeColor: colors.stroke, strokeOpacity: 1, strokeStyle: 'solid', strokeWidth: 1.5, strokeAlignment: 'center' }],
        opacity: 1, componentId: null, componentFile: null,
      },
    }]);
  }, []);

  const addUIBlock = useCallback((variant: IUIBlockShape['props']['variant']) => {
    const editor = editorRef.current;
    if (!editor) return;
    const cam = editor.getCamera();
    const defaults: Record<IUIBlockShape['props']['variant'], { w: number; h: number }> = {
      'button-primary': { w: 160, h: 44 },
      'button-secondary': { w: 160, h: 44 },
      'input': { w: 240, h: 44 },
      'card': { w: 280, h: 160 },
      'nav-bar': { w: 390, h: 56 },
      'badge': { w: 80, h: 28 },
      'avatar': { w: 48, h: 48 },
      'divider': { w: 280, h: 16 },
    };
    const { w, h } = defaults[variant];
    editor.createShapes([{
      id: createShapeId(`block-${Date.now()}`),
      type: 'design-uiblock',
      x: -cam.x / cam.z + 40,
      y: -cam.y / cam.z + 40,
      props: { w, h, variant },
    }]);
  }, []);

  const selectShape = useCallback((id: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setSelectedShapes([id as any]);
    editor.zoomToSelection({ animation: { duration: 200 } });
  }, []);

  const handlePenpotImport = useCallback(async (file: File) => {
    const editor = editorRef.current;
    if (!editor) return;
    await importPenpotFile(file, editor);
  }, []);

  const handlePenpotExport = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    await exportToPenpot(editor, projectName);
  }, [projectName]);

  const exportSVG = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    const shapes = editor.getCurrentPageShapes();
    if (!shapes.length) return;
    const shapeIds = shapes.map(s => s.id);
    const result = await editor.getSvgString(shapeIds, { background: true, padding: 32 });
    if (result?.svg && onSVGExport) onSVGExport(result.svg);
    if (result?.svg) {
      pushClipboardItem('svg', `SVG: ${projectName}`, result.svg);
      const blob = new Blob([result.svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${projectName}.svg`; a.click();
      URL.revokeObjectURL(url);
    }
  }, [projectName, onSVGExport]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Tldraw
        shapeUtils={customShapeUtils}
        onMount={handleMount}
        inferDarkMode
      />
      <DesignToolbar
        onAddFrame={addFrame}
        onAddComponent={addComponent}
        onAddUIBlock={addUIBlock}
        onExportSVG={exportSVG}
        onImportPenpot={() => fileInputRef.current?.click()}
        onExportPenpot={handlePenpotExport}
      />
      <DesignLayersPanel
        editorRef={editorRef}
        shapes={layerShapes}
        selectedShapeId={selectedShapeId}
        onSelectShape={selectShape}
      />
      <DesignPropertiesPanel editorRef={editorRef} selectedShapeId={selectedShapeId} />
      {/* Hidden file input for .penpot import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".penpot"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handlePenpotImport(file);
          e.target.value = '';
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        .tl-background { background: var(--bg-secondary) !important; }
        .tl-canvas { background: transparent !important; }
        .tl-grid { opacity: 0.06; }
      `}} />
    </div>
  );
}
