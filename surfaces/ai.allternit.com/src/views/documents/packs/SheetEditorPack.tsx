import React, { useEffect, useMemo, useRef, useState } from 'react';
import { editorPackStorageKey } from '../editor-packs';
import {
  cellsToCsv,
  cellsToWorkbook,
  downloadDocumentFile,
  exportDocumentFile,
  getStoredModel,
  setStoredModel,
  workbookToCells,
} from '../file-io';
import type { AllternitWorkbook, Cell, CellStyle, Merge, Sheet } from '../office-io/types';
import { registerNativeDocumentSurface } from '../document-surface';
import {
  evaluateSheetCell,
  offsetFormulaReferences,
  rewriteFormulaReferences,
  type EvalValue,
  isFormulaError,
} from './sheet-formula';
import * as XLSX from 'xlsx';

const ROWS = 30;
const COLS = 12;

function cellKey(row: number, col: number) {
  return `${row}:${col}`;
}

function colLabel(col: number) {
  let result = '';
  let n = col + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function mergeAt(row: number, col: number, merges: Merge[]): Merge | null {
  return merges.find((m) => m.top === row && m.left === col) ?? null;
}

function mergeCovering(row: number, col: number, merges: Merge[]): Merge | null {
  return merges.find((m) => row >= m.top && row <= m.bottom && col >= m.left && col <= m.right) ?? null;
}

function isMergedAway(row: number, col: number, merges: Merge[]): boolean {
  return merges.some((m) => row >= m.top && row <= m.bottom && col >= m.left && col <= m.right && !(row === m.top && col === m.left));
}

function parseInputValue(raw: string): Pick<Cell, 'value' | 'formula'> {
  if (raw.startsWith('=')) {
    return { formula: raw };
  }
  const trimmed = raw.trim();
  if (trimmed === '') return {};
  const num = Number(trimmed);
  if (Number.isFinite(num) && !Number.isNaN(num)) return { value: num };
  return { value: raw };
}

function formatEvalValue(value: EvalValue): string {
  if (value === undefined || value === null) return '';
  if (isFormulaError(value)) return value;
  if (value instanceof Date) return value.toLocaleString();
  return String(value);
}

function displayRaw(cell?: Cell): string {
  if (!cell) return '';
  if (cell.formula !== undefined) return cell.formula;
  if (cell.value !== undefined && cell.value !== null) return String(cell.value);
  return '';
}

function formatCellValue(cell: Cell | undefined, value: EvalValue): string {
  if (value === undefined || value === null) return '';
  if (isFormulaError(value)) return value;
  if (value instanceof Date) return value.toLocaleString();
  if (cell?.format) {
    try {
      const num = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(num)) {
        return XLSX.SSF.format(cell.format, num);
      }
    } catch {
      // Fall back to plain string if the format cannot be applied.
    }
  }
  return String(value);
}

function defaultColWidthPx() {
  return 112; // matches Tailwind min-w-28
}

function defaultRowHeightPx() {
  return 32; // matches h-8 input
}

function colWidthPx(sheet: Sheet | undefined, col: number) {
  const stored = sheet ? sheet.columnWidths[String(col)] : undefined;
  return stored ? stored * 8 : defaultColWidthPx();
}

function rowHeightPx(sheet: Sheet | undefined, row: number) {
  const stored = sheet ? sheet.rowHeights[String(row)] : undefined;
  return stored ? stored * 1.33 : defaultRowHeightPx();
}

function shiftCellsOnRowInsert(cells: Record<string, Cell>, row: number): Record<string, Cell> {
  const shifted: Record<string, Cell> = {};
  for (const [key, cell] of Object.entries(cells)) {
    const [rStr, cStr] = key.split(':');
    const r = parseInt(rStr, 10);
    const c = parseInt(cStr, 10);
    if (Number.isNaN(r) || Number.isNaN(c)) continue;
    if (r >= row) {
      shifted[`${r + 1}:${c}`] = cell;
    } else {
      shifted[key] = cell;
    }
  }
  return shifted;
}

function shiftCellsOnRowDelete(cells: Record<string, Cell>, row: number): Record<string, Cell> {
  const shifted: Record<string, Cell> = {};
  for (const [key, cell] of Object.entries(cells)) {
    const [rStr, cStr] = key.split(':');
    const r = parseInt(rStr, 10);
    const c = parseInt(cStr, 10);
    if (Number.isNaN(r) || Number.isNaN(c)) continue;
    if (r === row) continue;
    if (r > row) {
      shifted[`${r - 1}:${c}`] = cell;
    } else {
      shifted[key] = cell;
    }
  }
  return shifted;
}

function shiftCellsOnColumnInsert(cells: Record<string, Cell>, col: number): Record<string, Cell> {
  const shifted: Record<string, Cell> = {};
  for (const [key, cell] of Object.entries(cells)) {
    const [rStr, cStr] = key.split(':');
    const r = parseInt(rStr, 10);
    const c = parseInt(cStr, 10);
    if (Number.isNaN(r) || Number.isNaN(c)) continue;
    if (c >= col) {
      shifted[`${r}:${c + 1}`] = cell;
    } else {
      shifted[key] = cell;
    }
  }
  return shifted;
}

function shiftCellsOnColumnDelete(cells: Record<string, Cell>, col: number): Record<string, Cell> {
  const shifted: Record<string, Cell> = {};
  for (const [key, cell] of Object.entries(cells)) {
    const [rStr, cStr] = key.split(':');
    const r = parseInt(rStr, 10);
    const c = parseInt(cStr, 10);
    if (Number.isNaN(r) || Number.isNaN(c)) continue;
    if (c === col) continue;
    if (c > col) {
      shifted[`${r}:${c - 1}`] = cell;
    } else {
      shifted[key] = cell;
    }
  }
  return shifted;
}

function shiftMergesOnRowInsert(merges: Merge[], row: number): Merge[] {
  return merges
    .map((m) => {
      if (m.bottom < row) return m;
      if (m.top >= row) return { ...m, top: m.top + 1, bottom: m.bottom + 1 };
      return { ...m, bottom: m.bottom + 1 };
    })
    .filter((m) => m.top <= m.bottom);
}

function shiftMergesOnRowDelete(merges: Merge[], row: number): Merge[] {
  return merges
    .map((m) => {
      if (m.bottom < row) return m;
      if (m.top > row) return { ...m, top: m.top - 1, bottom: m.bottom - 1 };
      return null;
    })
    .filter((m): m is Merge => m !== null);
}

function shiftMergesOnColumnInsert(merges: Merge[], col: number): Merge[] {
  return merges
    .map((m) => {
      if (m.right < col) return m;
      if (m.left >= col) return { ...m, left: m.left + 1, right: m.right + 1 };
      return { ...m, right: m.right + 1 };
    })
    .filter((m) => m.left <= m.right);
}

function shiftMergesOnColumnDelete(merges: Merge[], col: number): Merge[] {
  return merges
    .map((m) => {
      if (m.right < col) return m;
      if (m.left > col) return { ...m, left: m.left - 1, right: m.right - 1 };
      return null;
    })
    .filter((m): m is Merge => m !== null);
}

function shiftRecordOnInsert(record: Record<string, number>, index: number): Record<string, number> {
  const shifted: Record<string, number> = {};
  for (const [key, value] of Object.entries(record)) {
    const n = parseInt(key, 10);
    if (Number.isNaN(n)) continue;
    if (n >= index) {
      shifted[String(n + 1)] = value;
    } else {
      shifted[key] = value;
    }
  }
  return shifted;
}

function shiftRecordOnDelete(record: Record<string, number>, index: number): Record<string, number> {
  const shifted: Record<string, number> = {};
  for (const [key, value] of Object.entries(record)) {
    const n = parseInt(key, 10);
    if (Number.isNaN(n)) continue;
    if (n === index) continue;
    if (n > index) {
      shifted[String(n - 1)] = value;
    } else {
      shifted[key] = value;
    }
  }
  return shifted;
}

function rewriteFormulasInCells(
  cells: Record<string, Cell>,
  shift: Parameters<typeof rewriteFormulaReferences>[1]
): Record<string, Cell> {
  const next: Record<string, Cell> = {};
  for (const [key, cell] of Object.entries(cells)) {
    next[key] = cell.formula ? { ...cell, formula: rewriteFormulaReferences(cell.formula, shift) } : cell;
  }
  return next;
}

export default function SheetEditorPack({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const key = editorPackStorageKey('sheets', documentId);
  const [workbook, setWorkbook] = useState<AllternitWorkbook>(() => {
    const stored = getStoredModel<AllternitWorkbook>('sheets', documentId);
    if (stored) return stored;
    const cells = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, string>;
    return cellsToWorkbook(cells, 'Untitled sheet');
  });
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [selectedRangeEnd, setSelectedRangeEnd] = useState<{ row: number; col: number } | null>(null);
  const [editing, setEditing] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [resizing, setResizing] = useState<
    | { type: 'col' | 'row'; index: number; startPos: number; startSize: number }
    | null
  >(null);
  const [revision, setRevision] = useState(0);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [renamingSheet, setRenamingSheet] = useState<number | null>(null);
  const [clipboard, setClipboard] = useState<{
    cells: Record<string, Cell>;
    sourceRow: number;
    sourceCol: number;
  } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const sheet = workbook.sheets[activeSheetIndex];

  useEffect(() => {
    setStoredModel('sheets', documentId, workbook);
    localStorage.setItem(key, JSON.stringify(workbookToCells(workbook, activeSheetIndex)));
  }, [workbook, documentId, key, activeSheetIndex]);

  useEffect(
    () =>
      registerNativeDocumentSurface({
        id: documentId,
        kind: 'sheets',
        snapshot: () => ({
          surfaceId: documentId,
          kind: 'sheets',
          title: workbook.name,
          revision,
          content: { cells: workbookToCells(workbook, activeSheetIndex) },
        }),
        apply: (mutation) => {
          if (mutation.type === 'export-office') {
            return exportDocumentFile('sheets', documentId, mutation.format).then(() => ({
              revision,
              summary: `Exported as ${mutation.format}.`,
            }));
          }
          if (mutation.type === 'set-cell-formula') {
            setWorkbook((current) => {
              const updated = { ...current };
              const sheets = [...updated.sheets];
              const s = { ...sheets[activeSheetIndex] };
              s.cells = {
                ...s.cells,
                [cellKey(mutation.row, mutation.column)]: { formula: mutation.formula.startsWith('=') ? mutation.formula : `=${mutation.formula}` },
              };
              sheets[activeSheetIndex] = s;
              updated.sheets = sheets;
              return updated;
            });
            setRevision((value) => value + 1);
            return { revision: revision + 1, summary: `Set formula in cell ${mutation.row}:${mutation.column}.` };
          }
          if (mutation.type !== 'set-cell') {
            throw new Error(`Unsupported sheet mutation: ${mutation.type}`);
          }
          setWorkbook((current) => {
            const updated = { ...current };
            const sheets = [...updated.sheets];
            const s = { ...sheets[activeSheetIndex] };
            s.cells = { ...s.cells, [cellKey(mutation.row, mutation.column)]: { value: mutation.value } };
            sheets[activeSheetIndex] = s;
            updated.sheets = sheets;
            return updated;
          });
          setRevision((value) => value + 1);
          return { revision: revision + 1, summary: `Updated cell ${mutation.row}:${mutation.column}.` };
        },
      }),
    [documentId, revision, workbook]
  );

  const computedValues = useMemo(() => {
    const values = new Map<string, EvalValue>();
    if (!sheet) return values;
    const visiting = new Set<string>();
    const getCell = (row: number, col: number) => sheet.cells[cellKey(row, col)];
    const evaluate = (row: number, col: number): EvalValue => {
      const k = cellKey(row, col);
      if (values.has(k)) return values.get(k);
      const result = evaluateSheetCell(getCell(row, col), getCell, visiting, k);
      values.set(k, result);
      return result;
    };
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        evaluate(r, c);
      }
    }
    return values;
  }, [sheet]);

  const updateSheet = (updater: (draft: NonNullable<typeof sheet>) => NonNullable<typeof sheet>) => {
    if (!sheet) return;
    setWorkbook((current) => ({
      ...current,
      sheets: current.sheets.map((s, index) => (index === activeSheetIndex ? updater({ ...s }) : s)),
    }));
    setRevision((value) => value + 1);
  };

  const updateWorkbook = (updater: (draft: AllternitWorkbook) => AllternitWorkbook) => {
    setWorkbook((current) => updater(current));
    setRevision((value) => value + 1);
  };

  const switchSheet = (index: number) => {
    setActiveSheetIndex(index);
    setSelected(null);
    setSelectedRangeEnd(null);
    setEditing(null);
    setEditValue('');
  };

  const addSheet = () => {
    updateWorkbook((current) => {
      const nextIndex = current.sheets.length + 1;
      const newSheet: Sheet = {
        id: `sheet-${nextIndex}-${Date.now()}`,
        name: `Sheet${nextIndex}`,
        cells: {},
        merges: [],
        columnWidths: {},
        rowHeights: {},
      };
      return { ...current, sheets: [...current.sheets, newSheet] };
    });
    setActiveSheetIndex((current) => current + 1);
  };

  const deleteSheet = (index: number) => {
    if (workbook.sheets.length <= 1) return;
    updateWorkbook((current) => ({ ...current, sheets: current.sheets.filter((_, i) => i !== index) }));
    setActiveSheetIndex((current) => Math.min(current, workbook.sheets.length - 2));
  };

  const renameSheet = (index: number, name: string) => {
    updateWorkbook((current) => ({
      ...current,
      sheets: current.sheets.map((s, i) => (i === index ? { ...s, name } : s)),
    }));
  };

  const copySelection = async () => {
    if (!selected || !sheet) return;
    const top = selectedRange?.top ?? selected.row;
    const left = selectedRange?.left ?? selected.col;
    const bottom = selectedRange?.bottom ?? selected.row;
    const right = selectedRange?.right ?? selected.col;

    const copied: Record<string, Cell> = {};
    const lines: string[] = [];
    for (let r = top; r <= bottom; r++) {
      const rowValues: string[] = [];
      for (let c = left; c <= right; c++) {
        const key = cellKey(r, c);
        const cell = sheet.cells[key];
        if (cell) copied[cellKey(r - top, c - left)] = cell;
        rowValues.push(displayRaw(cell));
      }
      lines.push(rowValues.join('\t'));
    }

    setClipboard({ cells: copied, sourceRow: top, sourceCol: left });
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
    } catch {
      // Clipboard may be unavailable in some contexts; the internal clipboard is still populated.
    }
  };

  const pasteSelection = async () => {
    if (!selected || !sheet) return;
    const top = selectedRange?.top ?? selected.row;
    const left = selectedRange?.left ?? selected.col;

    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      // Ignore clipboard read failures; fall back to internal clipboard if present.
    }

    const nextCells: Record<string, Cell> = {};

    if (clipboard) {
      const rowDelta = top - clipboard.sourceRow;
      const colDelta = left - clipboard.sourceCol;
      for (const [relKey, cell] of Object.entries(clipboard.cells)) {
        const [rStr, cStr] = relKey.split(':');
        const r = parseInt(rStr, 10);
        const c = parseInt(cStr, 10);
        const targetRow = top + r;
        const targetCol = left + c;
        if (targetRow >= ROWS || targetCol >= COLS || Number.isNaN(r) || Number.isNaN(c)) continue;
        const nextCell: Cell = { ...cell };
        if (cell.formula) {
          nextCell.formula = offsetFormulaReferences(cell.formula, rowDelta, colDelta);
        }
        nextCells[cellKey(targetRow, targetCol)] = nextCell;
      }
    } else if (text) {
      const rows = text.split('\n').map((line) => line.split('\t'));
      rows.forEach((rowValues, r) => {
        rowValues.forEach((raw, c) => {
          const targetRow = top + r;
          const targetCol = left + c;
          if (targetRow >= ROWS || targetCol >= COLS) return;
          nextCells[cellKey(targetRow, targetCol)] = parseInputValue(raw);
        });
      });
    }

    if (Object.keys(nextCells).length === 0) return;
    updateSheet((s) => ({ ...s, cells: { ...s.cells, ...nextCells } }));
  };

  const fillDown = () => {
    if (!selectedRange || !sheet) return;
    const { top, left, bottom, right } = selectedRange;
    const nextCells: Record<string, Cell> = {};
    for (let c = left; c <= right; c++) {
      const source = sheet.cells[cellKey(top, c)];
      for (let r = top + 1; r <= bottom; r++) {
        const nextCell: Cell = source ? { ...source } : {};
        if (source?.formula) {
          nextCell.formula = offsetFormulaReferences(source.formula, r - top, 0);
        }
        nextCells[cellKey(r, c)] = nextCell;
      }
    }
    updateSheet((s) => ({ ...s, cells: { ...s.cells, ...nextCells } }));
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editing) return;
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        void copySelection();
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        void pasteSelection();
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        fillDown();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [copySelection, pasteSelection, fillDown, editing]);

  const updateCell = (row: number, col: number, updater: (cell: Cell) => Cell) => {
    updateSheet((s) => {
      const k = cellKey(row, col);
      return { ...s, cells: { ...s.cells, [k]: updater(s.cells[k] ?? {}) } };
    });
  };

  const setCellRaw = (row: number, col: number, raw: string) => {
    updateCell(row, col, (cell) => ({ ...cell, ...parseInputValue(raw) }));
  };

  const toggleStyle = (name: keyof CellStyle) => {
    if (!selected) return;
    updateCell(selected.row, selected.col, (cell) => {
      const style = { ...(cell.style ?? {}) };
      (style as Record<string, unknown>)[name] = !(style as Record<string, unknown>)[name];
      return { ...cell, style };
    });
  };

  const setStyle = (name: keyof CellStyle, value: unknown) => {
    if (!selected) return;
    updateCell(selected.row, selected.col, (cell) => {
      const style = { ...(cell.style ?? {}) };
      (style as Record<string, unknown>)[name] = value;
      return { ...cell, style };
    });
  };

  const setFormat = (format: string | undefined) => {
    if (!selected) return;
    updateCell(selected.row, selected.col, (cell) => ({ ...cell, format }));
  };

  const selectedCell = selected && sheet ? sheet.cells[cellKey(selected.row, selected.col)] : undefined;

  const startEditing = (row: number, col: number) => {
    if (!sheet) return;
    setSelected({ row, col });
    setSelectedRangeEnd(null);
    setEditing({ row, col });
    setEditValue(displayRaw(sheet.cells[cellKey(row, col)]));
  };

  const finishEditing = () => {
    if (!editing || !sheet) return;
    setCellRaw(editing.row, editing.col, editValue);
    setEditing(null);
  };

  const selectedRange = useMemo(() => {
    if (!selected) return null;
    const end = selectedRangeEnd ?? selected;
    return {
      top: Math.min(selected.row, end.row),
      left: Math.min(selected.col, end.col),
      bottom: Math.max(selected.row, end.row),
      right: Math.max(selected.col, end.col),
    };
  }, [selected, selectedRangeEnd]);

  const isCellInRange = (row: number, col: number) => {
    if (!selectedRange) return false;
    return (
      row >= selectedRange.top &&
      row <= selectedRange.bottom &&
      col >= selectedRange.left &&
      col <= selectedRange.right
    );
  };

  const mergeSelected = () => {
    if (!selectedRange || !sheet) return;
    const { top, left, bottom, right } = selectedRange;
    if (top === bottom && left === right) return;
    const newMerge: Merge = { top, left, bottom, right };
    updateSheet((s) => {
      const withoutOverlaps = s.merges.filter(
        (m) => !(m.top <= bottom && m.bottom >= top && m.left <= right && m.right >= left)
      );
      return { ...s, merges: [...withoutOverlaps, newMerge] };
    });
  };

  const unmergeSelected = () => {
    if (!selected || !sheet) return;
    const merge = mergeCovering(selected.row, selected.col, sheet.merges);
    if (!merge) return;
    updateSheet((s) => ({ ...s, merges: s.merges.filter((m) => m !== merge) }));
  };

  const insertRow = (before: boolean) => {
    if (!selected) return;
    const row = before ? selected.row : selected.row + 1;
    updateSheet((s) => ({
      ...s,
      cells: rewriteFormulasInCells(shiftCellsOnRowInsert(s.cells, row), { type: 'row', index: row, delta: 1 }),
      merges: shiftMergesOnRowInsert(s.merges, row),
      rowHeights: shiftRecordOnInsert(s.rowHeights, row),
    }));
  };

  const deleteRow = () => {
    if (!selected) return;
    const row = selected.row;
    updateSheet((s) => ({
      ...s,
      cells: rewriteFormulasInCells(shiftCellsOnRowDelete(s.cells, row), { type: 'row', index: row, delta: -1 }),
      merges: shiftMergesOnRowDelete(s.merges, row),
      rowHeights: shiftRecordOnDelete(s.rowHeights, row),
    }));
    setSelected((current) => (current ? { ...current, row: Math.max(0, current.row - 1) } : null));
  };

  const insertColumn = (before: boolean) => {
    if (!selected) return;
    const col = before ? selected.col : selected.col + 1;
    updateSheet((s) => ({
      ...s,
      cells: rewriteFormulasInCells(shiftCellsOnColumnInsert(s.cells, col), { type: 'col', index: col, delta: 1 }),
      merges: shiftMergesOnColumnInsert(s.merges, col),
      columnWidths: shiftRecordOnInsert(s.columnWidths, col),
    }));
  };

  const deleteColumn = () => {
    if (!selected) return;
    const col = selected.col;
    updateSheet((s) => ({
      ...s,
      cells: rewriteFormulasInCells(shiftCellsOnColumnDelete(s.cells, col), { type: 'col', index: col, delta: -1 }),
      merges: shiftMergesOnColumnDelete(s.merges, col),
      columnWidths: shiftRecordOnDelete(s.columnWidths, col),
    }));
    setSelected((current) => (current ? { ...current, col: Math.max(0, current.col - 1) } : null));
  };

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e: MouseEvent) => {
      const delta = resizing.type === 'col' ? e.clientX - resizing.startPos : e.clientY - resizing.startPos;
      const newSize = Math.max(24, resizing.startSize + delta);
      updateSheet((s) => {
        if (resizing.type === 'col') {
          return { ...s, columnWidths: { ...s.columnWidths, [String(resizing.index)]: newSize / 8 } };
        }
        return { ...s, rowHeights: { ...s.rowHeights, [String(resizing.index)]: newSize / 1.33 } };
      });
    };
    const handleUp = () => setResizing(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [resizing]);

  const startColResize = (e: React.MouseEvent, col: number) => {
    e.preventDefault();
    setResizing({ type: 'col', index: col, startPos: e.clientX, startSize: colWidthPx(sheet, col) });
  };

  const startRowResize = (e: React.MouseEvent, row: number) => {
    e.preventDefault();
    setResizing({ type: 'row', index: row, startPos: e.clientY, startSize: rowHeightPx(sheet, row) });
  };

  const cellsRecord = useMemo(() => workbookToCells(workbook, activeSheetIndex), [workbook, activeSheetIndex]);

  const toolbarButton = (label: string, onClick: () => void, disabled = false) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold disabled:opacity-40"
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full flex-col bg-[var(--bg-primary)]">
      <header className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-3">
        <button type="button" onClick={onClose} className="text-xs text-[var(--text-secondary)]">
          ← Documents
        </button>
        <input
          value={workbook.name}
          onChange={(e) => setWorkbook((current) => ({ ...current, name: e.target.value }))}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
        />
        <button
          type="button"
          onClick={() => void exportDocumentFile('sheets', documentId, 'xlsx')}
          className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold"
        >
          Save as .xlsx
        </button>
        <button
          type="button"
          onClick={() => downloadDocumentFile(`${workbook.name || 'spreadsheet'}.csv`, cellsToCsv(cellsRecord), 'text/csv')}
          className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold"
        >
          Export CSV
        </button>
        <span className="text-[10px] text-[var(--text-tertiary)]">Saved locally</span>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] px-5 py-2">
        {toolbarButton('B', () => toggleStyle('bold'), !selected)}
        {toolbarButton('I', () => toggleStyle('italic'), !selected)}
        <input
          type="color"
          title="Text color"
          value={selectedCell?.style?.color || '#000000'}
          onChange={(e) => setStyle('color', e.target.value)}
          disabled={!selected}
          className="size-6 cursor-pointer rounded border border-[var(--border-subtle)] disabled:opacity-40"
        />
        <div className="flex gap-1">
          {(['left', 'center', 'right'] as const).map((align) => (
            <button
              key={align}
              type="button"
              onClick={() => setStyle('hAlign', align)}
              disabled={!selected}
              className={`rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold disabled:opacity-40 ${selectedCell?.style?.hAlign === align ? 'bg-[var(--bg-secondary)]' : ''}`}
            >
              {align[0].toUpperCase()}
            </button>
          ))}
        </div>
        <select
          value={selectedCell?.format ?? ''}
          onChange={(e) => setFormat(e.target.value || undefined)}
          disabled={!selected}
          className="rounded border border-[var(--border-subtle)] bg-transparent px-2 py-1 text-[10px] disabled:opacity-40"
        >
          <option value="">General</option>
          <option value="0.00">Number</option>
          <option value="$#,##0.00">Currency</option>
          <option value="0%">Percentage</option>
          <option value="yyyy-mm-dd">Date</option>
        </select>
        <div className="mx-2 h-4 w-px bg-[var(--border-subtle)]" />
        {toolbarButton('Merge', mergeSelected, !selectedRange || (selectedRange.top === selectedRange.bottom && selectedRange.left === selectedRange.right))}
        {toolbarButton('Unmerge', unmergeSelected, !selected || !mergeCovering(selected.row, selected.col, sheet?.merges ?? []))}
        <div className="mx-2 h-4 w-px bg-[var(--border-subtle)]" />
        {toolbarButton('Insert row', () => insertRow(true), !selected)}
        {toolbarButton('Insert col', () => insertColumn(true), !selected)}
        {toolbarButton('Delete row', deleteRow, !selected)}
        {toolbarButton('Delete col', deleteColumn, !selected)}
      </div>

      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-5 py-1">
        <span className="text-[10px] text-[var(--text-secondary)]">
          {selected ? `${colLabel(selected.col)}${selected.row + 1}` : ''}
        </span>
        <input
          value={editing && selected ? editValue : displayRaw(selectedCell)}
          onChange={(e) => setEditValue(e.target.value)}
          onFocus={() => {
            if (selected) startEditing(selected.row, selected.col);
          }}
          onBlur={() => finishEditing()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              finishEditing();
            }
          }}
          disabled={!selected}
          className="min-w-0 flex-1 bg-transparent text-xs outline-none disabled:opacity-40"
          placeholder={selected ? 'Enter value or formula' : ''}
        />
        <span className="text-[10px] text-[var(--text-tertiary)]">
          {selected ? formatCellValue(selectedCell, computedValues.get(cellKey(selected.row, selected.col))) : ''}
        </span>
      </div>

      <div className="flex items-center gap-1 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1">
        {workbook.sheets.map((s, index) => (
          <div
            key={s.id}
            className={`group flex items-center gap-1 rounded-t px-3 py-1 text-xs ${index === activeSheetIndex ? 'bg-[var(--bg-primary)] font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]/50'}`}
          >
            {renamingSheet === index ? (
              <input
                autoFocus
                value={s.name}
                onChange={(e) => renameSheet(index, e.target.value)}
                onBlur={() => setRenamingSheet(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setRenamingSheet(null);
                }}
                className="w-24 bg-transparent text-xs outline-none"
              />
            ) : (
              <button type="button" onClick={() => switchSheet(index)} onDoubleClick={() => setRenamingSheet(index)}>
                {s.name}
              </button>
            )}
            {workbook.sheets.length > 1 && (
              <button
                type="button"
                onClick={() => deleteSheet(index)}
                className="opacity-0 group-hover:opacity-100"
                title="Delete sheet"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addSheet}
          className="rounded px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]/50"
          title="Add sheet"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table ref={tableRef} className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 size-8 bg-[var(--bg-secondary)]" />
              {Array.from({ length: COLS }, (_, c) => (
                <th
                  key={c}
                  className="sticky top-0 min-w-28 border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2"
                  style={{ width: `${colWidthPx(sheet, c)}px` }}
                >
                  <div className="relative h-full w-full">
                    {colLabel(c)}
                    <div
                      onMouseDown={(e) => startColResize(e, c)}
                      className="absolute -right-2 top-0 z-10 h-full w-2 cursor-col-resize"
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, r) => (
              <tr key={r} style={{ height: `${rowHeightPx(sheet, r)}px` }}>
                <th className="sticky left-0 border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2">
                  <div className="relative h-full w-full">
                    {r + 1}
                    <div
                      onMouseDown={(e) => startRowResize(e, r)}
                      className="absolute -bottom-1 left-0 z-10 h-1 w-full cursor-row-resize"
                    />
                  </div>
                </th>
                {Array.from({ length: COLS }, (_, c) => {
                  const id = cellKey(r, c);
                  const merge = sheet ? mergeAt(r, c, sheet.merges) : null;
                  const hidden = sheet ? isMergedAway(r, c, sheet.merges) : false;
                  const cell = sheet?.cells[id];
                  if (hidden) return null;
                  const isSelected = selected?.row === r && selected?.col === c;
                  const isInRange = isCellInRange(r, c);
                  const isEditing = editing?.row === r && editing?.col === c;
                  const computed = computedValues.get(id);
                  return (
                    <td
                      key={id}
                      rowSpan={merge ? merge.bottom - merge.top + 1 : undefined}
                      colSpan={merge ? merge.right - merge.left + 1 : undefined}
                      onClick={() => {
                        setSelected({ row: r, col: c });
                        setSelectedRangeEnd(null);
                      }}
                      onMouseDown={(e) => {
                        if (e.shiftKey && selected) {
                          e.preventDefault();
                          setSelectedRangeEnd({ row: r, col: c });
                        }
                      }}
                      className={`relative border border-[var(--border-subtle)] p-0 ${isSelected ? 'ring-1 ring-green-600 ring-inset' : ''} ${isInRange && !isSelected ? 'bg-green-50/50 dark:bg-green-900/20' : ''}`}
                      style={{
                        textAlign: cell?.style?.hAlign ?? 'left',
                        verticalAlign: cell?.style?.vAlign ?? 'middle',
                        color: cell?.style?.color ?? undefined,
                        fontWeight: cell?.style?.bold ? 'bold' : undefined,
                        fontStyle: cell?.style?.italic ? 'italic' : undefined,
                        backgroundColor: cell?.style?.bgColor ?? undefined,
                        whiteSpace: cell?.style?.wrap ? 'normal' : 'nowrap',
                      }}
                    >
                      <input
                        aria-label={`Cell ${colLabel(c)}${r + 1}`}
                        value={isEditing ? editValue : formatCellValue(cell, computed)}
                        onChange={(e) => setEditValue(e.target.value)}
                        onFocus={() => startEditing(r, c)}
                        onBlur={() => finishEditing()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            finishEditing();
                            if (r < ROWS - 1) setSelected({ row: r + 1, col: c });
                          }
                        }}
                        className="h-full w-full min-w-28 bg-transparent px-2 outline-none"
                        style={{
                          textAlign: cell?.style?.hAlign ?? 'left',
                          color: cell?.style?.color ?? undefined,
                          fontWeight: cell?.style?.bold ? 'bold' : undefined,
                          fontStyle: cell?.style?.italic ? 'italic' : undefined,
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
