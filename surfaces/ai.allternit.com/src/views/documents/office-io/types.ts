// Canonical document models used by Allternit's native editors and the Office I/O engine.
// These models are intentionally smaller than the Office Open XML spec but large enough
// to represent the content users edit in Allternit while preserving unsupported features
// as `officeAnnotations` for round-trip fidelity.

export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  color?: string;
  highlight?: string;
}

export type DocumentBlock =
  | { type: 'paragraph'; content: InlineRun[]; align?: 'left' | 'center' | 'right' | 'justify' }
  | { type: 'heading'; level: 1 | 2 | 3; content: InlineRun[] }
  | { type: 'list'; style: 'bulleted' | 'numbered'; items: DocumentBlock[] }
  | { type: 'table'; rows: TableRow[] }
  | { type: 'image'; src: string; alt?: string; width?: number; height?: number }
  | { type: 'divider' };

export interface TableRow {
  cells: TableCell[];
}

export interface TableCell {
  blocks: DocumentBlock[];
}

export interface AllternitDocument {
  title: string;
  blocks: DocumentBlock[];
  officeAnnotations?: unknown;
}

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  bgColor?: string;
  hAlign?: 'left' | 'center' | 'right';
  vAlign?: 'top' | 'middle' | 'bottom';
  wrap?: boolean;
}

export interface Cell {
  value?: string | number | boolean | Date;
  formula?: string;
  format?: string;
  style?: CellStyle;
}

export interface Merge {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface Sheet {
  id: string;
  name: string;
  cells: Record<string, Cell>;
  merges: Merge[];
  columnWidths: Record<string, number>;
  rowHeights: Record<string, number>;
}

export interface AllternitWorkbook {
  name: string;
  sheets: Sheet[];
  officeAnnotations?: unknown;
}

export interface TextStyle {
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export type SlideBlock =
  | { type: 'text'; text: string; x: number; y: number; w: number; h: number; style?: TextStyle }
  | { type: 'image'; src: string; x: number; y: number; w: number; h: number };

export interface Slide {
  id: string;
  layout: string;
  background?: { type: 'color'; value: string } | { type: 'image'; src: string };
  blocks: SlideBlock[];
}

export interface AllternitDeck {
  title: string;
  slides: Slide[];
  officeAnnotations?: unknown;
}

export type AllternitOfficeModel = AllternitDocument | AllternitWorkbook | AllternitDeck;

export interface ImportResult<T extends AllternitOfficeModel> {
  model: T;
  warnings: string[];
}

export interface OfficeFileInput {
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}
