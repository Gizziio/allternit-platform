import JSZip from 'jszip';
import { type Editor } from 'tldraw';
import type {
  PenpotFile, PenpotPage, PenpotShape, PenpotFill,
} from './schema';
import type {
  AllternitCanvasShape,
  DesignComponentShapeProps,
  DesignFrameShapeProps,
  DesignUIBlockShapeProps,
} from '@/lib/tldraw/custom-shapes';

// ─── tldraw shape prop snapshots (inlined to avoid circular dep) ──────────────

function uid(): string {
  return crypto.randomUUID();
}

function fillsFromProps(props: { fill?: string; fills?: PenpotFill[] }): PenpotFill[] {
  if (props.fills?.length) return props.fills;
  return [{ fillType: 'plain', fillColor: props.fill ?? '#ffffff', fillOpacity: 1 }];
}

export async function exportToPenpot(
  editor: Editor,
  fileName = 'allternit-design',
): Promise<void> {
  const shapes = editor.getCurrentPageShapes() as AllternitCanvasShape[];
  const fileId = uid();
  const pageId = uid();
  const objects: Record<string, PenpotShape> = {};

  for (const shape of shapes) {
    const base = {
      x: shape.x, y: shape.y,
      parentId: undefined,
      frameId: undefined,
    };

    if (shape.type === 'design-frame') {
      const p = shape.props as DesignFrameShapeProps;
      objects[shape.id] = {
        id: shape.id,
        name: p.label ?? 'Frame',
        type: 'frame',
        x: shape.x, y: shape.y,
        width: p.w, height: p.h,
        rotation: shape.rotation ?? 0,
        opacity: p.opacity ?? 1,
        fills: fillsFromProps(p),
        strokes: p.strokes ?? [],
        shadows: [],
        rx: p.rx ?? 0, ry: p.ry ?? 0,
        clipContent: p.clipContent ?? true,
        children: [],
        constraintH: 'left', constraintV: 'top',
      } as any;
    } else if (shape.type === 'design-component') {
      const p = shape.props as DesignComponentShapeProps;
      const obj: any = {
        id: shape.id,
        name: p.label ?? 'Component',
        type: 'group',
        x: shape.x, y: shape.y,
        width: p.w, height: p.h,
        rotation: shape.rotation ?? 0,
        opacity: p.opacity ?? 1,
        fills: fillsFromProps(p),
        strokes: p.strokes ?? [],
        shadows: [],
        children: [],
        constraintH: 'left', constraintV: 'top',
      };
      if (p.componentId) {
        obj.componentRef = {
          componentId: p.componentId,
          componentFile: p.componentFile ?? fileId,
        };
      }
      objects[shape.id] = obj;
    } else if (shape.type === 'design-uiblock') {
      const p = shape.props as DesignUIBlockShapeProps;
      // Represent UI blocks as plain rects
      objects[shape.id] = {
        id: shape.id,
        name: p.variant ?? 'UIBlock',
        type: 'rect',
        x: shape.x, y: shape.y,
        width: p.w, height: p.h,
        rotation: shape.rotation ?? 0,
        opacity: 1,
        fills: [{ fillType: 'plain', fillColor: '#f3f4f6', fillOpacity: 1 }],
        strokes: [{ strokeColor: '#d1d5db', strokeWidth: 1, strokeStyle: 'solid', strokeAlignment: 'center' }],
        shadows: [],
        constraintH: 'left', constraintV: 'top',
      } as any;
    }
    // TODO: handle native tldraw geo/text/draw shapes
  }

  const page: PenpotPage = {
    id: pageId,
    name: 'Page 1',
    objects,
  };

  const file: PenpotFile = {
    id: fileId,
    name: fileName,
    revn: 1,
    data: {
      pages: [pageId],
      pagesIndex: { [pageId]: page },
      components: {},
      colors: {},
      typographies: {},
    },
  };

  const zip = new JSZip();
  zip.file('file.json', JSON.stringify(file, null, 2));
  zip.file('manifest.json', JSON.stringify({ fileId, version: 3 }, null, 2));

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.penpot`;
  a.click();
  URL.revokeObjectURL(url);
}
