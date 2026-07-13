import { editorPackStorageKey, type EditorPackId } from './editor-packs';

export interface ImportedDocument {
  pack: EditorPackId;
  documentId: string;
  title: string;
}

function id() {
  return globalThis.crypto?.randomUUID?.() ?? `document-${Date.now()}`;
}

export function downloadDocumentFile(name: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvToCells(csv: string): Record<string, string> {
  const cells: Record<string, string> = {};
  csv.split(/\r?\n/).forEach((row, rowIndex) => {
    // Lightweight CSV support. Quoted commas remain intact; full XLSX fidelity belongs to the optional compatibility engine.
    const values = row.match(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)?.map((value) => value.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')) ?? [];
    values.forEach((value, columnIndex) => { if (value) cells[`${rowIndex}:${columnIndex}`] = value; });
  });
  return cells;
}

export async function importDocumentFile(file: File): Promise<ImportedDocument> {
  const documentId = id();
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  const text = await file.text();
  if (extension === 'csv' || extension === 'altsheet') {
    const cells = extension === 'csv' ? csvToCells(text) : JSON.parse(text);
    localStorage.setItem(editorPackStorageKey('sheets', documentId), JSON.stringify(cells));
    return { pack: 'sheets', documentId, title: file.name };
  }
  if (extension === 'altdeck') {
    localStorage.setItem(editorPackStorageKey('presentations', documentId), text);
    return { pack: 'presentations', documentId, title: file.name };
  }
  if (extension === 'altdoc') {
    const parsed = JSON.parse(text) as { title?: string; body?: string };
    localStorage.setItem(editorPackStorageKey('documents', documentId), parsed.body ?? '');
    localStorage.setItem(`${editorPackStorageKey('documents', documentId)}.title`, parsed.title ?? file.name);
    return { pack: 'documents', documentId, title: parsed.title ?? file.name };
  }
  localStorage.setItem(editorPackStorageKey('documents', documentId), text);
  localStorage.setItem(`${editorPackStorageKey('documents', documentId)}.title`, file.name);
  return { pack: 'documents', documentId, title: file.name };
}

export function cellsToCsv(cells: Record<string, string>, rows = 30, columns = 12): string {
  return Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => {
    const value = cells[`${row}:${column}`] ?? '';
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }).join(',')).join('\n');
}
