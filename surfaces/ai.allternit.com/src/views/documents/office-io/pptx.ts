import JSZip from 'jszip';
import type { AllternitDeck, ImportResult, OfficeFileInput, Slide, SlideBlock, TextStyle } from './types';
import { readFileArrayBuffer } from './util';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'bmp':
      return 'image/bmp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/png';
  }
}

function dataUrlToArrayBuffer(src: string): ArrayBuffer | null {
  const match = src.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  try {
    const binary = globalThis.atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch {
    return null;
  }
}

async function fetchImageAsBase64(src: string): Promise<string | null> {
  try {
    if (src.startsWith('data:')) {
      const buffer = dataUrlToArrayBuffer(src);
      if (!buffer) return null;
      const mime = src.match(/^data:([^;]+);/)?.[1] ?? 'image/png';
      return `data:${mime};base64,${arrayBufferToBase64(buffer)}`;
    }
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const mime = blob.type || 'image/png';
    return `data:${mime};base64,${arrayBufferToBase64(buffer)}`;
  } catch {
    return null;
  }
}

function parseRels(relsXml: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!relsXml) return map;
  const doc = new DOMParser().parseFromString(relsXml, 'application/xml');
  for (const rel of Array.from(doc.querySelectorAll('Relationship'))) {
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) map.set(id, target);
  }
  return map;
}

function resolveRelTarget(target: string, sourcePath: string): string {
  const sourceDir = sourcePath.split('/').slice(0, -1).join('/') + '/';
  const resolved = new URL(target, 'file:///' + sourceDir).pathname.slice(1);
  return resolved;
}

function parseShapeStyle(shape: Element, isTitle: boolean): TextStyle {
  const style: TextStyle = { align: 'left' };
  if (isTitle) {
    style.fontSize = 32;
    style.bold = true;
  }

  // Prefer the first explicit run's properties, then paragraph defaults.
  const firstRun = shape.querySelector('r');
  const rPr = firstRun?.querySelector('rPr') ?? shape.querySelector('defRPr');
  if (rPr) {
    const sz = rPr.getAttribute('sz');
    if (sz) style.fontSize = parseInt(sz, 10) / 100;
    const b = rPr.getAttribute('b');
    if (b === '1') style.bold = true;
    const solidFill = rPr.querySelector('solidFill');
    const color = solidFill?.querySelector('srgbClr')?.getAttribute('val');
    if (color) style.color = `#${color}`;
  }

  const bodyPr = shape.querySelector('bodyPr');
  if (bodyPr) {
    const anchor = bodyPr.getAttribute('anchor');
    if (anchor === 'ctr') style.align = 'center';
    else if (anchor === 'r') style.align = 'right';
  }

  return style;
}

function parseShapeText(shape: Element): string {
  const paragraphs: string[] = [];
  for (const paragraph of Array.from(shape.querySelectorAll('p'))) {
    const runs: string[] = [];
    for (const run of Array.from(paragraph.querySelectorAll('r'))) {
      const t = run.querySelector('t');
      if (t) runs.push(t.textContent || '');
    }
    if (runs.length > 0) paragraphs.push(runs.join(''));
  }
  return paragraphs.join('\n');
}

async function parseSlideXml(
  slideXml: string,
  relsXml: string | undefined,
  slidePath: string | undefined,
  zip: JSZip
): Promise<Slide> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(slideXml, 'application/xml');

  // Extract background fill.
  let background: Slide['background'] | undefined;
  const bg = doc.querySelector('cBg, bg');
  if (bg) {
    const solidFill = bg.querySelector('solidFill');
    const srgb = solidFill?.querySelector('srgbClr');
    const schemeClr = solidFill?.querySelector('schemeClr');
    if (srgb) {
      background = { type: 'color', value: `#${srgb.getAttribute('val') || 'FFFFFF'}` };
    } else if (schemeClr) {
      background = { type: 'color', value: '#FFFFFF' };
    }
  }

  const relsMap = parseRels(relsXml);

  const blocks: SlideBlock[] = [];

  // Parse text shapes.
  for (const shape of Array.from(doc.querySelectorAll('sp'))) {
    const placeholder = shape.querySelector('ph');
    const isTitle = placeholder?.getAttribute('type') === 'title' || placeholder?.getAttribute('type') === 'ctrTitle';

    const xfrm = shape.querySelector('xfrm');
    if (!xfrm) continue;
    const off = xfrm.querySelector('off');
    const ext = xfrm.querySelector('ext');
    if (!off || !ext) continue;

    const x = parseInt(off.getAttribute('x') || '0', 10) / 914400;
    const y = parseInt(off.getAttribute('y') || '0', 10) / 914400;
    const w = parseInt(ext.getAttribute('cx') || '0', 10) / 914400;
    const h = parseInt(ext.getAttribute('cy') || '0', 10) / 914400;

    const text = parseShapeText(shape);
    if (text.trim()) {
      blocks.push({ type: 'text', text, x, y, w, h, style: parseShapeStyle(shape, isTitle) });
    }
  }

  // Parse pictures.
  for (const pic of Array.from(doc.querySelectorAll('pic'))) {
    const xfrm = pic.querySelector('spPr > xfrm') || pic.querySelector('xfrm');
    if (!xfrm) continue;
    const off = xfrm.querySelector('off');
    const ext = xfrm.querySelector('ext');
    if (!off || !ext) continue;

    const x = parseInt(off.getAttribute('x') || '0', 10) / 914400;
    const y = parseInt(off.getAttribute('y') || '0', 10) / 914400;
    const w = parseInt(ext.getAttribute('cx') || '0', 10) / 914400;
    const h = parseInt(ext.getAttribute('cy') || '0', 10) / 914400;

    const blip = pic.querySelector('blip');
    const embedId = blip?.getAttribute('r:embed') || blip?.getAttribute('embed');
    if (!embedId || !slidePath) continue;

    const target = relsMap.get(embedId);
    if (!target) continue;

    const imagePath = resolveRelTarget(target, slidePath);
    const imageBuffer = await zip.file(imagePath)?.async('arraybuffer');
    if (!imageBuffer) continue;

    const mime = mimeFromPath(imagePath);
    const src = `data:${mime};base64,${arrayBufferToBase64(imageBuffer)}`;
    blocks.push({ type: 'image', src, x, y, w, h });
  }

  // Sort blocks top-to-bottom, left-to-right so title usually comes first.
  blocks.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

  return {
    id: crypto.randomUUID(),
    layout: 'custom',
    background,
    blocks,
  };
}

export async function importPptx(file: OfficeFileInput): Promise<ImportResult<AllternitDeck>> {
  const warnings: string[] = [];
  const arrayBuffer = await readFileArrayBuffer(file);
  const zip = await JSZip.loadAsync(arrayBuffer);

  const presentationXml = await zip.file('ppt/presentation.xml')?.async('text');
  if (!presentationXml) {
    throw new Error('Invalid .pptx: missing presentation.xml');
  }

  const parser = new DOMParser();
  const presDoc = parser.parseFromString(presentationXml, 'application/xml');
  const sldIdLst = presDoc.querySelector('sldIdLst');
  const slideRefs: string[] = [];

  if (sldIdLst) {
    for (const sldId of Array.from(sldIdLst.querySelectorAll('sldId'))) {
      const rId = sldId.getAttribute('r:id');
      if (rId) slideRefs.push(rId);
    }
  }

  // Read presentation relationships to map rId -> slide path.
  const presRelsXml = await zip.file('ppt/_rels/presentation.xml.rels')?.async('text');
  const slidePaths = new Map<string, string>();
  if (presRelsXml) {
    const relsDoc = parser.parseFromString(presRelsXml, 'application/xml');
    for (const rel of Array.from(relsDoc.querySelectorAll('Relationship'))) {
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target');
      const type = rel.getAttribute('Type') || '';
      if (id && target && type.includes('/slide')) {
        slidePaths.set(id, `ppt/${target}`);
      }
    }
  }

  const slides: Slide[] = [];
  for (const rId of slideRefs) {
    const path = slidePaths.get(rId);
    if (!path) continue;
    const slideXml = await zip.file(path)?.async('text');
    if (!slideXml) continue;

    const relsPath = path.replace(/\/([^/]+)\.xml$/, '/_rels/$1.xml.rels');
    const relsXml = await zip.file(relsPath)?.async('text');
    const slide = await parseSlideXml(slideXml, relsXml, path, zip);
    slides.push(slide);
  }

  if (slides.length === 0) {
    slides.push({ id: crypto.randomUUID(), layout: 'title', blocks: [] });
  }

  return {
    model: { title: file.name.replace(/\.pptx?$/i, ''), slides },
    warnings,
  };
}

export async function exportPptx(deck: AllternitDeck): Promise<Blob> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.title = deck.title;
  pptx.author = 'Allternit';

  for (const slide of deck.slides) {
    const pSlide = pptx.addSlide();

    if (slide.background?.type === 'color') {
      pSlide.background = { fill: slide.background.value.replace('#', '') };
    }

    for (const block of slide.blocks) {
      if (block.type === 'text') {
        const style = block.style || {};
        const isDark = isDarkBg(slide.background?.type === 'color' ? slide.background.value : '#FFFFFF');
        const color = style.color ? style.color.replace('#', '') : isDark ? 'FFFFFF' : '111111';
        pSlide.addText(block.text, {
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          fontSize: style.fontSize || 14,
          bold: style.bold,
          color,
          align: style.align || 'left',
          wrap: true,
        });
      } else if (block.type === 'image') {
        const imageData = await fetchImageAsBase64(block.src);
        if (imageData) {
          pSlide.addImage({
            data: imageData,
            x: block.x,
            y: block.y,
            w: block.w,
            h: block.h,
          });
        }
      }
    }
  }

  const output = await pptx.write({ outputType: 'base64' });
  const binary = Uint8Array.from(atob(output as string), (c) => c.charCodeAt(0));
  return new Blob([binary.buffer], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
}

function isDarkBg(hex: string): boolean {
  if (!hex || !hex.startsWith('#')) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}
