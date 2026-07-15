import * as docx from 'docx';
import mammoth from 'mammoth';
import type {
  AllternitDocument,
  DocumentBlock,
  ImportResult,
  InlineRun,
  OfficeFileInput,
  TableCell,
  TableRow,
} from './types';
import { readFileArrayBuffer } from './util';

export function parseInlineRuns(element: Element): InlineRun[] {
  const runs: InlineRun[] = [];
  const walk = (node: Node, inherited: Partial<InlineRun>) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (text) runs.push({ text, ...inherited });
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const styles = window.getComputedStyle(el);
      const mark: Partial<InlineRun> = { ...inherited };
      const tag = el.tagName.toLowerCase();
      if (tag === 'strong' || tag === 'b' || styles.fontWeight === 'bold' || styles.fontWeight === '700') mark.bold = true;
      if (tag === 'em' || tag === 'i' || styles.fontStyle === 'italic') mark.italic = true;
      if (tag === 'u' || styles.textDecorationLine.includes('underline')) mark.underline = true;
      if (tag === 's' || tag === 'del' || styles.textDecorationLine.includes('line-through')) mark.strike = true;
      if (tag === 'code') mark.code = true;
      const color = styles.color;
      if (color && color !== 'rgb(0, 0, 0)' && color !== 'rgba(0, 0, 0, 1)') {
        mark.color = rgbToHex(color);
      } else {
        delete mark.color;
      }
      const bg = styles.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        mark.highlight = rgbToHex(bg);
      } else {
        delete mark.highlight;
      }
      for (const child of Array.from(el.childNodes)) walk(child, mark);
    }
  };
  for (const child of Array.from(element.childNodes)) walk(child, {});
  return mergeRuns(runs);
}

function mergeRuns(runs: InlineRun[]): InlineRun[] {
  const merged: InlineRun[] = [];
  for (const run of runs) {
    if (run.text === '') continue;
    const last = merged[merged.length - 1];
    if (
      last &&
      last.bold === run.bold &&
      last.italic === run.italic &&
      last.underline === run.underline &&
      last.strike === run.strike &&
      last.code === run.code &&
      last.color === run.color &&
      last.highlight === run.highlight
    ) {
      last.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

function rgbToHex(rgb: string): string | undefined {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return undefined;
  const toHex = (n: string) => parseInt(n, 10).toString(16).padStart(2, '0');
  return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
}

function parseBlock(element: Element): DocumentBlock | null {
  const tag = element.tagName.toLowerCase();

  if (tag === 'p') {
    const images = element.querySelectorAll('img');
    const text = element.textContent ?? '';
    if (images.length === 1 && text.trim() === '') {
      return parseBlock(images[0]);
    }
    const align = (element.getAttribute('align') as 'left' | 'center' | 'right' | 'justify') || 'left';
    const content = parseInlineRuns(element);
    return { type: 'paragraph', content, align };
  }

  if (/^h[1-6]$/.test(tag)) {
    const level = Math.min(parseInt(tag[1], 10), 3) as 1 | 2 | 3;
    return { type: 'heading', level, content: parseInlineRuns(element) };
  }

  if (tag === 'ul' || tag === 'ol') {
    const items: DocumentBlock[] = [];
    for (const li of Array.from(element.querySelectorAll(':scope > li'))) {
      const parsed = parseBlock(li);
      if (parsed) items.push(parsed);
    }
    return { type: 'list', style: tag === 'ul' ? 'bulleted' : 'numbered', items };
  }

  if (tag === 'li') {
    const content = parseInlineRuns(element);
    return { type: 'paragraph', content };
  }

  if (tag === 'table') {
    const rows: TableRow[] = [];
    for (const tr of Array.from(element.querySelectorAll('tr'))) {
      const cells: TableCell[] = [];
      for (const td of Array.from(tr.querySelectorAll('td, th'))) {
        const blocks: DocumentBlock[] = [];
        for (const child of Array.from(td.children)) {
          const parsed = parseBlock(child);
          if (parsed) blocks.push(parsed);
        }
        cells.push({ blocks });
      }
      rows.push({ cells });
    }
    return { type: 'table', rows };
  }

  if (tag === 'hr') {
    return { type: 'divider' };
  }

  if (tag === 'img') {
    const src = element.getAttribute('src') || '';
    const alt = element.getAttribute('alt') || undefined;
    const htmlEl = element as HTMLElement;
    const widthAttr = element.getAttribute('width') || htmlEl.style?.width;
    const heightAttr = element.getAttribute('height') || htmlEl.style?.height;
    const widthMatch = widthAttr?.match(/^(\d+)/);
    const heightMatch = heightAttr?.match(/^(\d+)/);
    const width = widthMatch ? parseInt(widthMatch[1], 10) : undefined;
    const height = heightMatch ? parseInt(heightMatch[1], 10) : undefined;
    return { type: 'image', src, alt, width, height };
  }

  // Fallback: treat unknown block-level elements as paragraphs.
  if (element.textContent && element.textContent.trim()) {
    return { type: 'paragraph', content: parseInlineRuns(element) };
  }

  return null;
}

export async function importDocx(file: OfficeFileInput): Promise<ImportResult<AllternitDocument>> {
  const warnings: string[] = [];
  const arrayBuffer = await readFileArrayBuffer(file);
  const result = await mammoth.convertToHtml({ buffer: arrayBuffer as any }, {
    styleMap: [
      'p[style-name="Heading 1"] => h1:fresh',
      'p[style-name="Heading 2"] => h2:fresh',
      'p[style-name="Heading 3"] => h3:fresh',
      'p[style-name="Heading 4"] => h4:fresh',
      'p[style-name="Heading 5"] => h5:fresh',
      'p[style-name="Heading 6"] => h6:fresh',
    ],
  });

  if (result.messages.length > 0) {
    warnings.push(...result.messages.map((m) => m.message));
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${result.value}</body>`, 'text/html');
  const blocks: DocumentBlock[] = [];

  for (const child of Array.from(doc.body.children)) {
    const parsed = parseBlock(child);
    if (parsed) blocks.push(parsed);
  }

  return { model: { title: file.name.replace(/\.docx?$/i, ''), blocks }, warnings };
}

function runsToPlaintext(runs: InlineRun[]): string {
  return runs.map((r) => r.text).join('');
}

function makeNumbering(): docx.INumberingOptions {
  return {
    config: [
      {
        reference: 'bullet',
        levels: [
          {
            level: 0,
            format: docx.LevelFormat.BULLET,
            text: '\u2022',
            alignment: docx.AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: { left: 720, hanging: 360 },
              },
            },
          },
        ],
      },
      {
        reference: 'numbered',
        levels: [
          {
            level: 0,
            format: docx.LevelFormat.DECIMAL,
            text: '%1.',
            alignment: docx.AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: { left: 720, hanging: 360 },
              },
            },
          },
        ],
      },
    ],
  };
}

function collectImageBlocks(blocks: DocumentBlock[]): Extract<DocumentBlock, { type: 'image' }>[] {
  const images: Extract<DocumentBlock, { type: 'image' }>[] = [];
  const walk = (block: DocumentBlock) => {
    if (block.type === 'image') {
      images.push(block);
      return;
    }
    if (block.type === 'table') {
      for (const row of block.rows) {
        for (const cell of row.cells) {
          cell.blocks.forEach(walk);
        }
      }
    }
    if (block.type === 'list') {
      block.items.forEach(walk);
    }
  };
  blocks.forEach(walk);
  return images;
}

function imageType(src: string): 'png' | 'jpg' | 'gif' | 'bmp' {
  const dataMatch = src.match(/^data:image\/(\w+);/);
  if (dataMatch) {
    const mime = dataMatch[1].toLowerCase();
    if (mime === 'jpeg' || mime === 'jpg') return 'jpg';
    if (mime === 'gif') return 'gif';
    if (mime === 'bmp') return 'bmp';
    return 'png';
  }
  const ext = src.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
  if (ext === 'gif') return 'gif';
  if (ext === 'bmp') return 'bmp';
  return 'png';
}

function dataUrlToArrayBuffer(src: string): ArrayBuffer | null {
  const match = src.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  try {
    const base64 = match[2];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch {
    return null;
  }
}

async function fetchImageBuffers(
  images: Extract<DocumentBlock, { type: 'image' }>[]
): Promise<{ buffers: Map<string, ArrayBuffer>; warnings: string[] }> {
  const buffers = new Map<string, ArrayBuffer>();
  const warnings: string[] = [];
  await Promise.all(
    images.map(async (block) => {
      if (buffers.has(block.src)) return;
      try {
        if (block.src.startsWith('data:')) {
          const decoded = dataUrlToArrayBuffer(block.src);
          if (!decoded) throw new Error('Invalid data URL');
          buffers.set(block.src, decoded);
          return;
        }
        const response = await fetch(block.src);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        buffers.set(block.src, arrayBuffer);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(`Could not embed image ${block.src}: ${message}`);
      }
    })
  );
  return { buffers, warnings };
}

function alignmentToDocx(
  align?: 'left' | 'center' | 'right' | 'justify'
): (typeof docx.AlignmentType)[keyof typeof docx.AlignmentType] | undefined {
  switch (align) {
    case 'center':
      return docx.AlignmentType.CENTER;
    case 'right':
      return docx.AlignmentType.END;
    case 'justify':
      return docx.AlignmentType.BOTH;
    case 'left':
      return docx.AlignmentType.START;
    default:
      return undefined;
  }
}

function runsToDocxText(runs: InlineRun[]): docx.TextRun[] {
  return runs.map(
    (run) =>
      new docx.TextRun({
        text: run.text,
        ...(run.bold ? { bold: true } : {}),
        ...(run.italic ? { italics: true } : {}),
        ...(run.underline ? { underline: { type: docx.UnderlineType.SINGLE } } : {}),
        ...(run.strike ? { strike: true } : {}),
        ...(run.code ? { font: 'Courier New' } : {}),
        ...(run.color ? { color: run.color.replace('#', '') } : {}),
        ...(run.highlight ? { highlight: run.highlight.replace('#', '') as any } : {}),
      })
  );
}

function blockToDocxChildren(
  block: DocumentBlock,
  imageBuffers: Map<string, ArrayBuffer>
): (docx.Paragraph | docx.Table)[] {
  switch (block.type) {
    case 'paragraph':
      return [
        new docx.Paragraph({
          children: runsToDocxText(block.content),
          alignment: alignmentToDocx(block.align),
        }),
      ];
    case 'heading':
      return [
        new docx.Paragraph({
          children: runsToDocxText(block.content),
          heading:
            block.level === 1
              ? docx.HeadingLevel.HEADING_1
              : block.level === 2
                ? docx.HeadingLevel.HEADING_2
              : docx.HeadingLevel.HEADING_3,
        }),
      ];
    case 'list': {
      const reference = block.style === 'numbered' ? 'numbered' : 'bullet';
      return block.items
        .filter((item): item is Extract<DocumentBlock, { type: 'paragraph' }> => item.type === 'paragraph')
        .map(
          (item) =>
            new docx.Paragraph({
              children: runsToDocxText(item.content),
              numbering: { reference, level: 0 },
            })
        );
    }
    case 'table': {
      const rows = block.rows.map(
        (row) =>
          new docx.TableRow({
            children: row.cells.map((cell) => {
              const paragraphs: docx.Paragraph[] = [];
              for (const child of cell.blocks) {
                if (child.type === 'paragraph') {
                  paragraphs.push(new docx.Paragraph({ children: runsToDocxText(child.content) }));
                } else if (child.type === 'heading') {
                  paragraphs.push(
                    new docx.Paragraph({
                      children: runsToDocxText(child.content),
                      heading:
                        child.level === 1
                          ? docx.HeadingLevel.HEADING_1
                          : child.level === 2
                            ? docx.HeadingLevel.HEADING_2
                          : docx.HeadingLevel.HEADING_3,
                    })
                  );
                } else {
                  // Flatten nested blocks into paragraphs so the cell is never empty.
                  paragraphs.push(...blockToDocxChildren(child, imageBuffers).filter((c): c is docx.Paragraph => c instanceof docx.Paragraph));
                }
              }
              return new docx.TableCell({
                children: paragraphs.length > 0 ? paragraphs : [new docx.Paragraph({ text: '' })],
              });
            }),
          })
      );
      return [
        new docx.Table({
          rows,
          width: { size: 100, type: docx.WidthType.PERCENTAGE },
        }),
      ];
    }
    case 'divider':
      return [
        new docx.Paragraph({
          border: { bottom: { color: '999999', space: 1, style: docx.BorderStyle.SINGLE, size: 6 } },
          spacing: { before: 100, after: 100 },
        }),
      ];
    case 'image': {
      const buffer = imageBuffers.get(block.src);
      if (!buffer) {
        return [new docx.Paragraph({ text: `[Image: ${block.alt || 'image'}]` })];
      }
      const width = block.width ?? 400;
      const height = block.height ?? 300;
      return [
        new docx.Paragraph({
          children: [
            new docx.ImageRun({
              type: imageType(block.src),
              data: buffer,
              transformation: { width, height },
              ...(block.alt ? { altText: { name: block.alt } } : {}),
            }),
          ],
        }),
      ];
    }
    default:
      return [new docx.Paragraph({ text: '' })];
  }
}

export async function exportDocx(document: AllternitDocument): Promise<Blob> {
  const images = collectImageBlocks(document.blocks);
  const { buffers: imageBuffers, warnings } = await fetchImageBuffers(images);

  const children: (docx.Paragraph | docx.Table)[] = [];

  if (document.title) {
    children.push(
      new docx.Paragraph({
        text: document.title,
        heading: docx.HeadingLevel.TITLE,
        spacing: { after: 200 },
      })
    );
  }

  for (const block of document.blocks) {
    children.push(...blockToDocxChildren(block, imageBuffers));
  }

  const doc = new docx.Document({
    numbering: makeNumbering(),
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const nodeBuffer = await docx.Packer.toBuffer(doc);
  const arrayBuffer = Uint8Array.from(nodeBuffer).buffer;
  return new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
