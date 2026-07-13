import * as docx from 'docx';
import mammoth from 'mammoth';
import type { AllternitDocument, DocumentBlock, ImportResult, InlineRun, OfficeFileInput, TableCell, TableRow } from './types';
import { readFileArrayBuffer } from './util';

function parseInlineRuns(element: Element): InlineRun[] {
  const runs: InlineRun[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (text) runs.push({ text });
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const styles = window.getComputedStyle(el);
      const mark: Partial<InlineRun> = {};
      const tag = el.tagName.toLowerCase();
      if (tag === 'strong' || tag === 'b' || styles.fontWeight === 'bold' || styles.fontWeight === '700') mark.bold = true;
      if (tag === 'em' || tag === 'i' || styles.fontStyle === 'italic') mark.italic = true;
      if (tag === 'u' || styles.textDecorationLine.includes('underline')) mark.underline = true;
      if (tag === 's' || tag === 'del' || styles.textDecorationLine.includes('line-through')) mark.strike = true;
      if (tag === 'code') mark.code = true;
      const color = styles.color;
      if (color && color !== 'rgb(0, 0, 0)' && color !== 'rgba(0, 0, 0, 1)') {
        mark.color = rgbToHex(color);
      }
      const bg = styles.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        mark.highlight = rgbToHex(bg);
      }
      if (Object.keys(mark).length > 0) {
        const text = el.textContent ?? '';
        if (text) runs.push({ text, ...mark });
      } else {
        for (const child of Array.from(el.childNodes)) walk(child);
      }
    }
  };
  for (const child of Array.from(element.childNodes)) walk(child);
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
    return { type: 'image', src, alt };
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

function blockToDocxChild(block: DocumentBlock): docx.Paragraph | docx.Table {
  switch (block.type) {
    case 'paragraph':
      return new docx.Paragraph({
        children: runsToDocxText(block.content),
        alignment: alignmentToDocx(block.align),
      });
    case 'heading':
      return new docx.Paragraph({
        children: runsToDocxText(block.content),
        heading: block.level === 1 ? docx.HeadingLevel.HEADING_1 : block.level === 2 ? docx.HeadingLevel.HEADING_2 : docx.HeadingLevel.HEADING_3,
      });
    case 'list': {
      const text = block.items
        .map((item) => (item.type === 'paragraph' ? runsToPlaintext(item.content) : ''))
        .join('\n');
      return new docx.Paragraph({
        children: [new docx.TextRun({ text: block.style === 'numbered' ? `1. ${text}` : `• ${text}` })],
      });
    }
    case 'table': {
      const rows = block.rows.map((row) =>
        new docx.TableRow({
          children: row.cells.map((cell) => {
            const paragraphs = cell.blocks
              .map((b) => (b.type === 'paragraph' ? new docx.Paragraph({ children: runsToDocxText(b.content) }) : null))
              .filter((p): p is docx.Paragraph => p !== null);
            return new docx.TableCell({
              children: paragraphs.length > 0 ? paragraphs : [new docx.Paragraph({ text: '' })],
            });
          }),
        })
      );
      return new docx.Table({ rows });
    }
    case 'divider':
      return new docx.Paragraph({
        border: { bottom: { color: '999999', space: 1, style: docx.BorderStyle.SINGLE, size: 6 } },
        spacing: { before: 100, after: 100 },
      });
    case 'image':
      // Images require fetching the binary; for now we insert a placeholder paragraph.
      return new docx.Paragraph({ text: `[Image: ${block.alt || 'image'}]` });
    default:
      return new docx.Paragraph({ text: '' });
  }
}

export async function exportDocx(document: AllternitDocument): Promise<Blob> {
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
    children.push(blockToDocxChild(block));
  }

  const doc = new docx.Document({
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
