import JSZip from 'jszip';
import { createShapeId, type Editor } from 'tldraw';
import type {
  PenpotFile, PenpotPage, PenpotShape, PenpotFrame, PenpotFill, PenpotStroke,
} from './schema';
import { walkShapes, isFrame } from './schema';
import type { DesignComponentShapeProps, DesignFrameShapeProps } from '@/lib/tldraw/custom-shapes';

// Inline prop shapes to avoid circular dep on DesignTldrawCanvas
function firstFillColor(fills?: PenpotFill[]): string {
  return fills?.[0]?.fillColor ?? '#ffffff';
}

function buildFrameProps(shape: PenpotFrame): DesignFrameShapeProps {
  return {
    w: shape.width, h: shape.height,
    label: shape.name,
    fill: firstFillColor(shape.fills),
    fills: shape.fills ?? [],
    strokes: shape.strokes ?? [],
    shadows: [],
    blur: null,
    opacity: shape.opacity ?? 1,
    rx: shape.rx ?? 0, ry: shape.ry ?? 0,
    clipContent: shape.clipContent ?? true,
    constraintH: shape.constraintH ?? 'left',
    constraintV: shape.constraintV ?? 'top',
    layout: null,
    exports: [],
  };
}

async function parsePenpotZip(source: File | ArrayBuffer): Promise<PenpotFile | null> {
  const zip = await JSZip.loadAsync(source);

  // Try flat file.json first, then manifest → page approach
  const fileEntry = zip.file('file.json');
  if (fileEntry) {
    const text = await fileEntry.async('text');
    return JSON.parse(text) as PenpotFile;
  }

  // Try manifest.json → pages/<id>.json
  const manifestEntry = zip.file('manifest.json');
  if (!manifestEntry) return null;
  const manifest = JSON.parse(await manifestEntry.async('text')) as { fileId: string };
  const fileId = manifest.fileId;
  const pageEntry = zip.file(`${fileId}.json`) ?? zip.file('export.json');
  if (!pageEntry) return null;
  return JSON.parse(await pageEntry.async('text')) as PenpotFile;
}

function getFirstPage(file: PenpotFile): PenpotPage | null {
  const pageId = file.data.pages?.[0];
  if (!pageId) return null;
  return file.data.pagesIndex?.[pageId] ?? null;
}

export async function importPenpotFile(
  source: File | ArrayBuffer,
  editor: Editor,
): Promise<{ pageId: string; pageName: string; count: number }> {
  const file = await parsePenpotZip(source);
  if (!file) throw new Error('Could not parse Penpot file — unsupported format');

  const page = getFirstPage(file);
  if (!page) throw new Error('No pages found in Penpot file');

  const shapesToCreate: Parameters<typeof editor.createShapes>[0] = [];

  walkShapes(page, (shape) => {
    if (shape.type === 'frame') {
      shapesToCreate.push({
        id: createShapeId(shape.id),
        type: 'design-frame',
        x: shape.x, y: shape.y,
        props: buildFrameProps(shape as PenpotFrame),
      });
    } else if (
      (shape.type === 'rect' || shape.type === 'ellipse' || shape.type === 'group') &&
      shape.componentRef?.componentId
    ) {
      const props: DesignComponentShapeProps = {
        w: shape.width, h: shape.height,
        label: shape.name,
        componentType: 'custom',
        fill: firstFillColor(shape.fills),
        stroke: shape.strokes?.[0]?.strokeColor ?? '#818cf8',
        radius: (shape as any).rx ?? 8,
        fills: shape.fills ?? [],
        strokes: shape.strokes ?? [],
        opacity: shape.opacity ?? 1,
        componentId: shape.componentRef.componentId,
        componentFile: shape.componentRef.componentFile,
      };
      shapesToCreate.push({
        id: createShapeId(shape.id),
        type: 'design-component',
        x: shape.x, y: shape.y,
        props,
      });
    }
    // TODO: PenpotText → tldraw text shape once text ShapeUtil is added
    // TODO: PenpotPath → tldraw geo shape
  });

  if (shapesToCreate.length > 0) {
    editor.createShapes(shapesToCreate);
    editor.zoomToFit({ animation: { duration: 300 } });
  }

  return { pageId: page.id, pageName: page.name, count: shapesToCreate.length };
}
