import * as XLSX from 'xlsx';
import type { AllternitWorkbook, Cell, CellStyle, ImportResult, Merge, OfficeFileInput, Sheet } from './types';
import { readFileArrayBuffer } from './util';

const cellKey = (row: number, col: number) => `${row}:${col}`;

function decodeCellRef(ref: string): { row: number; col: number } {
  const match = ref.match(/([A-Z]+)(\d+)/);
  if (!match) return { row: 0, col: 0 };
  let col = 0;
  for (const ch of match[1]) {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }
  return { row: parseInt(match[2], 10) - 1, col: col - 1 };
}

function encodeRange(top: number, left: number, bottom: number, right: number): string {
  const encodeCol = (c: number): string => {
    let result = '';
    let n = c + 1;
    while (n > 0) {
      const rem = (n - 1) % 26;
      result = String.fromCharCode(65 + rem) + result;
      n = Math.floor((n - 1) / 26);
    }
    return result;
  };
  return `${encodeCol(left)}${top + 1}:${encodeCol(right)}${bottom + 1}`;
}

function xlsxStyleToCellStyle(xlsxCell: XLSX.CellObject): CellStyle | undefined {
  const style: CellStyle = {};
  if (!xlsxCell.s) return undefined;
  const s = xlsxCell.s;
  if (s.font) {
    if (s.font.bold) style.bold = true;
    if (s.font.italic) style.italic = true;
    if (s.font.color?.rgb) style.color = `#${s.font.color.rgb.slice(-6)}`;
  }
  if (s.fill?.fgColor?.rgb) {
    style.bgColor = `#${s.fill.fgColor.rgb.slice(-6)}`;
  }
  if (s.alignment) {
    if (s.alignment.horizontal) {
      const h = s.alignment.horizontal;
      style.hAlign = h === 'left' || h === 'center' || h === 'right' ? h : 'left';
    }
    if (s.alignment.vertical) {
      const v = s.alignment.vertical;
      style.vAlign = v === 'top' || v === 'middle' || v === 'bottom' ? v : 'middle';
    }
    if (typeof s.alignment.wrapText === 'boolean') style.wrap = s.alignment.wrapText;
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

function cellStyleToXlsx(style?: CellStyle): Partial<XLSX.CellObject>['s'] {
  if (!style) return undefined;
  const s: Record<string, any> = {};
  const font: Record<string, any> = {};
  if (style.bold) font.bold = true;
  if (style.italic) font.italic = true;
  if (style.color) font.color = { rgb: style.color.replace('#', '') };
  if (Object.keys(font).length > 0) s.font = font;
  if (style.bgColor) {
    s.fill = { patternType: 'solid', fgColor: { rgb: style.bgColor.replace('#', '') } };
  }
  const alignment: Record<string, any> = {};
  if (style.hAlign) alignment.horizontal = style.hAlign;
  if (style.vAlign) alignment.vertical = style.vAlign;
  if (typeof style.wrap === 'boolean') alignment.wrapText = style.wrap;
  if (Object.keys(alignment).length > 0) s.alignment = alignment;
  return s;
}

export async function importXlsx(file: OfficeFileInput): Promise<ImportResult<AllternitWorkbook>> {
  const warnings: string[] = [];
  const arrayBuffer = await readFileArrayBuffer(file);
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellFormula: true, cellNF: true });

  const sheets: Sheet[] = workbook.SheetNames.map((name) => {
    const ws = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    const cells: Record<string, Cell> = {};

    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const ref = XLSX.utils.encode_cell({ r: row, c: col });
        const xlsxCell = ws[ref];
        if (!xlsxCell) continue;
        const cell: Cell = {};
        if (xlsxCell.f) {
          cell.formula = xlsxCell.f;
        }
        if (xlsxCell.v !== undefined && xlsxCell.v !== null) {
          cell.value = xlsxCell.v;
        }
        if (xlsxCell.z && xlsxCell.z !== 'General') {
          cell.format = xlsxCell.z;
        }
        const style = xlsxStyleToCellStyle(xlsxCell);
        if (style) cell.style = style;
        cells[cellKey(row, col)] = cell;
      }
    }

    const merges: Merge[] =
      ws['!merges']?.map((m) => ({
        top: m.s.r,
        left: m.s.c,
        bottom: m.e.r,
        right: m.e.c,
      })) ?? [];

    const columnWidths: Record<string, number> = {};
    if (ws['!cols']) {
      ws['!cols'].forEach((col, index) => {
        if (!col) return;
        const width = col.wch ?? col.width ?? col.wpx;
        if (width) columnWidths[String(index)] = width;
      });
    }

    const rowHeights: Record<string, number> = {};
    if (ws['!rows']) {
      ws['!rows'].forEach((row, index) => {
        if (!row) return;
        const height = row.hpt ?? row.hpx;
        if (height) rowHeights[String(index)] = height;
      });
    }

    return {
      id: name,
      name,
      cells,
      merges,
      columnWidths,
      rowHeights,
    };
  });

  if (sheets.length === 0) {
    sheets.push({ id: 'Sheet1', name: 'Sheet1', cells: {}, merges: [], columnWidths: {}, rowHeights: {} });
  }

  return {
    model: { name: file.name.replace(/\.xlsx?$/i, ''), sheets, officeAnnotations: workbook },
    warnings,
  };
}

export async function exportXlsx(workbook: AllternitWorkbook): Promise<Blob> {
  const wb = XLSX.utils.book_new();

  for (const sheet of workbook.sheets) {
    // Determine used range.
    let maxRow = 0;
    let maxCol = 0;
    for (const key of Object.keys(sheet.cells)) {
      const [rowStr, colStr] = key.split(':');
      const row = parseInt(rowStr, 10);
      const col = parseInt(colStr, 10);
      if (row > maxRow) maxRow = row;
      if (col > maxCol) maxCol = col;
    }

    // Build value grid preserving native types.
    const data: (string | number | boolean | Date | null)[][] = [];
    for (let row = 0; row <= maxRow; row++) {
      const rowData: (string | number | boolean | Date | null)[] = [];
      for (let col = 0; col <= maxCol; col++) {
        rowData.push(sheet.cells[cellKey(row, col)]?.value ?? null);
      }
      data.push(rowData);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Apply formulas, formats, and styles on top of the typed values.
    for (let row = 0; row <= maxRow; row++) {
      for (let col = 0; col <= maxCol; col++) {
        const cell = sheet.cells[cellKey(row, col)];
        if (!cell) continue;
        const ref = XLSX.utils.encode_cell({ r: row, c: col });
        if (cell.formula) ws[ref].f = cell.formula;
        if (cell.format) ws[ref].z = cell.format;
        const style = cellStyleToXlsx(cell.style);
        if (style) ws[ref].s = style;
      }
    }

    if (sheet.merges.length > 0) {
      ws['!merges'] = sheet.merges.map((m) => ({
        s: { r: m.top, c: m.left },
        e: { r: m.bottom, c: m.right },
      }));
    }

    if (Object.keys(sheet.columnWidths).length > 0) {
      ws['!cols'] = [];
      for (const [index, width] of Object.entries(sheet.columnWidths)) {
        const idx = parseInt(index, 10);
        ws['!cols'][idx] = { wch: width };
      }
    }

    if (Object.keys(sheet.rowHeights).length > 0) {
      ws['!rows'] = [];
      for (const [index, height] of Object.entries(sheet.rowHeights)) {
        const idx = parseInt(index, 10);
        ws['!rows'][idx] = { hpt: height };
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
