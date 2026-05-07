"use client";

import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  Tldraw, 
  createShapeId, 
  HTMLContainer, 
  ShapeUtil, 
  Rectangle2d,
  Editor,
  type TLResizeInfo,
  resizeBox,
} from 'tldraw';
import 'tldraw/tldraw.css';
import { 
  useCodeModeStore, 
  type CodeCanvasTile, 
  type CodeWorkspaceRecord 
} from './CodeModeStore';
import { CodeCanvasTileContent } from './CodeCanvasTileContent';
import { CanvasTile } from '@/components/canvas/CanvasTile';
import { type CodeTileShape as ICodeTileShape } from '@/lib/tldraw/custom-shapes';

// --- CUSTOM SHAPE DEFINITION ---

class CodeTileShapeUtil extends ShapeUtil<ICodeTileShape> {
  static override type = 'code-tile' as const;

  override canResize() { return true; }
  override canEdit() { return false; }

  override getDefaultProps(): ICodeTileShape['props'] {
    return {
      w: 480,
      h: 360,
      tileId: '',
      label: 'Session',
    };
  }

  override getGeometry(shape: ICodeTileShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  override component(shape: ICodeTileShape) {
    const { tileId } = shape.props;
    const editor = this.editor;
    const workspace = useCodeModeStore((s) => 
      s.workspaces.find(w => w.canvasTiles?.some(t => t.tileId === tileId))
    );
    const removeCanvasTile = useCodeModeStore((s) => s.removeCanvasTile);
    const setCanvasFocusTile = useCodeModeStore((s) => s.setCanvasFocusTile);
    const tile = workspace?.canvasTiles?.find(t => t.tileId === tileId);

    if (!tile) return <HTMLContainer>Tile not found</HTMLContainer>;

    const workspaceId = workspace?.workspace_id;

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: 'all',
          backgroundColor: 'var(--surface-floating)',
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <CanvasTile
          tile={tile}
          onMove={() => {}} 
          onResize={() => {}} 
          onFocus={() => {
            if (workspaceId) setCanvasFocusTile(workspaceId, tileId);
          }} 
          onClose={() => {
            if (workspaceId) {
              removeCanvasTile(workspaceId, tileId);
              editor.deleteShapes([shape.id]);
            }
          }} 
          onBringToFront={() => {
            editor.bringToFront([shape.id]);
          }} 
        >
          <CodeCanvasTileContent tile={tile} workspacePath={workspace?.root_path} />
        </CanvasTile>
      </HTMLContainer>
    );
  }

  override indicator(shape: ICodeTileShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }

  override onResize(shape: ICodeTileShape, info: TLResizeInfo<ICodeTileShape>) {
    return resizeBox(shape, info);
  }
}

const customShapeUtils = [CodeTileShapeUtil];

// --- COMPONENT ---

interface CodeTldrawCanvasProps {
  workspace: CodeWorkspaceRecord | undefined;
}

export function CodeTldrawCanvas({ workspace }: CodeTldrawCanvasProps) {
  const updateCanvasTile = useCodeModeStore((s) => s.updateCanvasTile);
  const setCanvasViewport = useCodeModeStore((s) => s.setCanvasViewport);
  const workspaceId = workspace?.workspace_id;
  const editorRef = useRef<Editor | null>(null);

  // 1. Sync external changes (from store/toolbar) to tldraw
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !workspace) return;

    const tiles = workspace.canvasTiles ?? [];
    const currentShapes = editor.getCurrentPageShapes();

    // Sync shapes...
    tiles.forEach(tile => {
      const shapeId = createShapeId(tile.tileId);
      const existing = editor.getShape(shapeId);
      
      if (!existing) {
        editor.createShapes([{
          id: shapeId,
          type: 'code-tile',
          x: tile.x,
          y: tile.y,
          props: {
            w: tile.width,
            h: tile.height,
            tileId: tile.tileId,
            label: tile.label || tile.type,
          },
        }]);
      } else {
        if (Math.abs(existing.x - tile.x) > 1 || Math.abs(existing.y - tile.y) > 1) {
          editor.updateShapes([{
            id: shapeId,
            type: 'code-tile',
            x: tile.x,
            y: tile.y,
          }]);
        }
      }
    });

    // Sync camera from store (if updated via toolbar)
    const storeV = workspace.canvasViewport;
    if (storeV) {
      const cam = editor.getCamera();
      if (Math.abs(cam.x - storeV.x) > 1 || Math.abs(cam.y - storeV.y) > 1 || Math.abs(cam.z - storeV.zoom) > 0.01) {
        editor.setCamera({ x: storeV.x, y: storeV.y, z: storeV.zoom });
      }
    }

    // Cleanup orphaned shapes...
    const tileIds = new Set(tiles.map(t => createShapeId(t.tileId)));
    currentShapes.forEach(shape => {
      if (shape.type === 'code-tile' && !tileIds.has(shape.id)) editor.deleteShapes([shape.id]);
    });

  }, [workspace]);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // 2. Sync from tldraw back to store (Dragging/Panning)
    editor.sideEffects.registerAfterChangeHandler('shape', (_prev: any, next: any) => {
      if (next.type === 'code-tile' && workspaceId) {
        updateCanvasTile(workspaceId, next.props.tileId, {
          x: next.x,
          y: next.y,
          width: next.props.w,
          height: next.props.h,
        });
      }
    });

    // Sync camera movements back to store for spawn coordinate calculation
    editor.on('tick', () => {
      const cam = editor.getCamera();
      if (workspaceId) {
        setCanvasViewport(workspaceId, { x: cam.x, y: cam.y, zoom: cam.z });
      }
    });

  }, [workspaceId, updateCanvasTile, setCanvasViewport]);

  return (
    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--shell-frame-bg)' }}>
      <Tldraw
        shapeUtils={customShapeUtils}
        onMount={handleMount}
        hideUi={true} 
      />
      
      {/* Custom Global Styles for tldraw within Allternit */}
      <style dangerouslySetInnerHTML={{ __html: `
        .tl-container {
          background: transparent !important;
        }
        .tl-background {
          background: transparent !important;
        }
        .tl-canvas {
          background: transparent !important;
        }
        /* Custom Allternit Grid */
        .tl-grid {
          opacity: 0.05;
        }
      `}} />
    </div>
  );
}
