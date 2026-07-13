import { editorPackStorageKey, type EditorPackId } from './editor-packs';
import {
  detectOfficeFormat,
  exportDocxFile,
  exportPptxFile,
  exportXlsxFile,
  importOfficeFile,
} from './office-io';
import type {
  AllternitDeck,
  AllternitDocument,
  AllternitWorkbook,
  DocumentBlock,
  InlineRun,
  SlideBlock,
} from './office-io';

interface EditorSlide {
  id: string;
  title: string;
  body: string;
  layout?: string;
  background?: { type: 'color'; value: string } | { type: 'image'; src: string };
}

export interface ImportedDocument {
  pack: EditorPackId;
  documentId: string;
  title: string;
  warnings: string[];
}

function id() {
  return globalThis.crypto?.randomUUID?.() ?? `document-${Date.now()}`;
}

export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadDocumentFile(name: string, content: string, type = 'text/plain') {
  downloadBlob(name, new Blob([content], { type }));
}

// ── Simple editor format ↔ Office model conversions ──────────────────────────

function runsToPlaintext(runs: InlineRun[]): string {
  return runs.map((r) => r.text).join('');
}

function blockToPlaintext(block: DocumentBlock): string {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
      return runsToPlaintext(block.content);
    case 'list':
      return block.items.map((item) => `- ${blockToPlaintext(item)}`).join('\n');
    case 'table':
      return block.rows
        .map((row) => row.cells.map((cell) => cell.blocks.map(blockToPlaintext).join(' ')).join(' | '))
        .join('\n');
    case 'image':
      return `[Image]`;
    case 'divider':
      return '---';
    default:
      return '';
  }
}

export function documentToPlaintext(document: AllternitDocument): string {
  return document.blocks.map(blockToPlaintext).join('\n\n');
}

export function plaintextToDocument(title: string, body: string): AllternitDocument {
  const blocks: DocumentBlock[] = body
    .split(/\n\n+/)
    .filter((paragraph) => paragraph.trim())
    .map((paragraph) => {
      const text = paragraph.trim();
      if (text.startsWith('# ')) {
        return { type: 'heading', level: 1, content: [{ text: text.slice(2) }] };
      }
      if (text.startsWith('## ')) {
        return { type: 'heading', level: 2, content: [{ text: text.slice(3) }] };
      }
      if (text.startsWith('### ')) {
        return { type: 'heading', level: 3, content: [{ text: text.slice(4) }] };
      }
      return { type: 'paragraph', content: [{ text }] };
    });
  return { title, blocks };
}

function cellsToWorkbook(cells: Record<string, string>, name: string): AllternitWorkbook {
  const sheetCells: AllternitWorkbook['sheets'][0]['cells'] = {};
  for (const [key, value] of Object.entries(cells)) {
    const num = Number(value);
    sheetCells[key] = { value: Number.isFinite(num) && value.trim() !== '' ? num : value };
  }
  return {
    name,
    sheets: [{ id: 'Sheet1', name: 'Sheet1', cells: sheetCells, merges: [], columnWidths: {}, rowHeights: {} }],
  };
}

function workbookToCells(workbook: AllternitWorkbook): Record<string, string> {
  const sheet = workbook.sheets[0];
  if (!sheet) return {};
  const cells: Record<string, string> = {};
  for (const [key, cell] of Object.entries(sheet.cells)) {
    if (cell.value !== undefined && cell.value !== null) {
      cells[key] = String(cell.value);
    }
  }
  return cells;
}

function slideBlocksToTitleBody(blocks: SlideBlock[]): { title: string; body: string } {
  const sorted = [...blocks].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
  const title = sorted[0]?.type === 'text' ? sorted[0].text : '';
  const body = sorted
    .slice(1)
    .map((b) => (b.type === 'text' ? b.text : ''))
    .filter(Boolean)
    .join('\n');
  return { title, body };
}

function slidesToDeck(slides: EditorSlide[], title: string): AllternitDeck {
  return {
    title,
    slides: slides.map((slide) => ({
      id: slide.id,
      layout: slide.layout || 'title',
      background: slide.background,
      blocks: [
        { type: 'text', text: slide.title, x: 0.5, y: 0.5, w: 9, h: 1, style: { fontSize: 32, bold: true } },
        { type: 'text', text: slide.body, x: 0.5, y: 1.75, w: 9, h: 4, style: { fontSize: 16 } },
      ],
    })),
  };
}

function deckToSlides(deck: AllternitDeck): EditorSlide[] {
  return deck.slides.map((slide) => {
    const { title, body } = slideBlocksToTitleBody(slide.blocks);
    return { id: slide.id, title, body, layout: slide.layout, background: slide.background };
  });
}

// ── CSV helpers ──────────────────────────────────────────────────────────────

function csvToCells(csv: string): Record<string, string> {
  const cells: Record<string, string> = {};
  csv.split(/\r?\n/).forEach((row, rowIndex) => {
    const values = row.match(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)?.map((value) => value.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')) ?? [];
    values.forEach((value, columnIndex) => { if (value) cells[`${rowIndex}:${columnIndex}`] = value; });
  });
  return cells;
}

export function cellsToCsv(cells: Record<string, string>, rows = 30, columns = 12): string {
  return Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => {
    const value = cells[`${row}:${column}`] ?? '';
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }).join(',')).join('\n');
}

// ── Storage helpers ──────────────────────────────────────────────────────────

function modelStorageKey(pack: EditorPackId, documentId: string) {
  return `${editorPackStorageKey(pack, documentId)}.office-model`;
}

function getStoredModel<T>(pack: EditorPackId, documentId: string): T | null {
  const raw = localStorage.getItem(modelStorageKey(pack, documentId));
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function setStoredModel<T>(pack: EditorPackId, documentId: string, model: T) {
  localStorage.setItem(modelStorageKey(pack, documentId), JSON.stringify(model));
}

// ── Import ───────────────────────────────────────────────────────────────────

export async function importDocumentFile(file: File): Promise<ImportedDocument> {
  const documentId = id();
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  const title = file.name.replace(/\.[^.]+$/, '');

  const officeFormat = detectOfficeFormat(file);
  if (officeFormat) {
    const { model, warnings } = await importOfficeFile(file);

    if (officeFormat === 'docx') {
      const doc = model as AllternitDocument;
      setStoredModel('documents', documentId, doc);
      localStorage.setItem(editorPackStorageKey('documents', documentId), documentToPlaintext(doc));
      localStorage.setItem(`${editorPackStorageKey('documents', documentId)}.title`, doc.title || title);
      return { pack: 'documents', documentId, title: doc.title || title, warnings };
    }

    if (officeFormat === 'xlsx') {
      const workbook = model as AllternitWorkbook;
      setStoredModel('sheets', documentId, workbook);
      localStorage.setItem(editorPackStorageKey('sheets', documentId), JSON.stringify(workbookToCells(workbook)));
      return { pack: 'sheets', documentId, title: workbook.name || title, warnings };
    }

    if (officeFormat === 'pptx') {
      const deck = model as AllternitDeck;
      setStoredModel('presentations', documentId, deck);
      localStorage.setItem(editorPackStorageKey('presentations', documentId), JSON.stringify(deckToSlides(deck)));
      return { pack: 'presentations', documentId, title: deck.title || title, warnings };
    }
  }

  const text = await file.text();

  if (extension === 'csv' || extension === 'altsheet') {
    const cells = extension === 'csv' ? csvToCells(text) : JSON.parse(text);
    localStorage.setItem(editorPackStorageKey('sheets', documentId), JSON.stringify(cells));
    return { pack: 'sheets', documentId, title, warnings: [] };
  }
  if (extension === 'altdeck') {
    localStorage.setItem(editorPackStorageKey('presentations', documentId), text);
    return { pack: 'presentations', documentId, title, warnings: [] };
  }
  if (extension === 'altdoc') {
    const parsed = JSON.parse(text) as { title?: string; body?: string };
    localStorage.setItem(editorPackStorageKey('documents', documentId), parsed.body ?? '');
    localStorage.setItem(`${editorPackStorageKey('documents', documentId)}.title`, parsed.title ?? title);
    return { pack: 'documents', documentId, title: parsed.title ?? title, warnings: [] };
  }
  localStorage.setItem(editorPackStorageKey('documents', documentId), text);
  localStorage.setItem(`${editorPackStorageKey('documents', documentId)}.title`, title);
  return { pack: 'documents', documentId, title, warnings: [] };
}

// ── Export ───────────────────────────────────────────────────────────────────

export async function exportDocumentFile(
  pack: EditorPackId,
  documentId: string,
  format: 'docx' | 'xlsx' | 'pptx' | 'md' | 'csv' | 'altdeck' | 'altdoc' | 'altsheet'
): Promise<void> {
  const key = editorPackStorageKey(pack, documentId);
  const title = localStorage.getItem(`${key}.title`) || 'Untitled';

  if (pack === 'documents') {
    const body = localStorage.getItem(key) || '';
    const model = getStoredModel<AllternitDocument>('documents', documentId);
    if (format === 'docx') {
      const document = model || plaintextToDocument(title, body);
      const blob = await exportDocxFile({ ...document, title });
      downloadBlob(`${title || 'document'}.docx`, blob);
      return;
    }
    if (format === 'md') {
      downloadDocumentFile(`${title || 'document'}.md`, body, 'text/markdown');
      return;
    }
    if (format === 'altdoc') {
      downloadDocumentFile(`${title || 'document'}.altdoc`, JSON.stringify({ title, body }), 'application/json');
      return;
    }
  }

  if (pack === 'sheets') {
    const cells = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, string>;
    const model = getStoredModel<AllternitWorkbook>('sheets', documentId);
    if (format === 'xlsx') {
      const workbook = model || cellsToWorkbook(cells, title);
      const blob = await exportXlsxFile(workbook);
      downloadBlob(`${title || 'spreadsheet'}.xlsx`, blob);
      return;
    }
    if (format === 'csv') {
      downloadDocumentFile(`${title || 'spreadsheet'}.csv`, cellsToCsv(cells), 'text/csv');
      return;
    }
    if (format === 'altsheet') {
      downloadDocumentFile(`${title || 'spreadsheet'}.altsheet`, JSON.stringify(cells), 'application/json');
      return;
    }
  }

  if (pack === 'presentations') {
    const slides = JSON.parse(localStorage.getItem(key) || '[]') as EditorSlide[];
    const model = getStoredModel<AllternitDeck>('presentations', documentId);
    if (format === 'pptx') {
      const deck = model || slidesToDeck(slides, title);
      const blob = await exportPptxFile(deck);
      downloadBlob(`${title || 'presentation'}.pptx`, blob);
      return;
    }
    if (format === 'altdeck') {
      downloadDocumentFile(`${title || 'presentation'}.altdeck`, JSON.stringify(slides), 'application/json');
      return;
    }
  }

  throw new Error(`Unsupported export format ${format} for ${pack}`);
}
