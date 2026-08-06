/**
 * Office program registry for the desktop shell.
 *
 * One BrowserWindow per editor type, each loading the GenOffice-backed
 * editor on the platform surface (same pattern as the /design window).
 * Kept as a pure module so the routing logic is unit-testable.
 */

export type OfficeEditor = 'docs' | 'sheets' | 'slides' | 'pdf';
/**
 * File-open targets: the four editors plus the anydoc markdown preview
 * (formats no editor owns). The markdown window loads the platform's
 * /markdown-preview route.
 */
export type OfficeFileTarget = OfficeEditor | 'markdown';
export type OfficeTarget = OfficeFileTarget | 'launcher';

export interface OfficeProgram {
  id: OfficeTarget;
  title: string;
}

export const OFFICE_PROGRAMS: readonly OfficeProgram[] = [
  { id: 'launcher', title: 'Allternit Office' },
  { id: 'docs', title: 'Allternit Docs' },
  { id: 'sheets', title: 'Allternit Sheets' },
  { id: 'slides', title: 'Allternit Slides' },
  { id: 'pdf', title: 'Allternit PDF' },
  { id: 'markdown', title: 'Markdown Preview' },
] as const;

const VALID_TARGETS = new Set<string>(OFFICE_PROGRAMS.map((p) => p.id));

export function isOfficeTarget(value: unknown): value is OfficeTarget {
  return typeof value === 'string' && VALID_TARGETS.has(value);
}

/** Platform route path for an office target. */
export function officePathFor(target: OfficeTarget, artifactId?: string): string {
  if (target === 'launcher') return '/office';
  if (target === 'markdown') return '/markdown-preview';
  return `/${target}${artifactId ? `/${encodeURIComponent(artifactId)}` : ''}`;
}

export function officeTitleFor(target: OfficeTarget): string {
  return OFFICE_PROGRAMS.find((p) => p.id === target)?.title ?? 'Allternit Office';
}

const EDITOR_BY_EXT: Record<string, OfficeFileTarget> = {
  docx: 'docs',
  xlsx: 'sheets',
  pptx: 'slides',
  pdf: 'pdf',
  // Formats with no native editor open in the anydoc markdown preview.
  doc: 'markdown',
  docm: 'markdown',
  ppt: 'markdown',
  pps: 'markdown',
  pot: 'markdown',
  pptm: 'markdown',
  ppsx: 'markdown',
  ppsm: 'markdown',
  xls: 'markdown',
  xlsm: 'markdown',
  xlsb: 'markdown',
  odt: 'markdown',
  ods: 'markdown',
  odp: 'markdown',
  rtf: 'markdown',
  epub: 'markdown',
  csv: 'markdown',
};

/** Map a file path/extension to its editor, or null when unsupported. */
export function editorForFile(filePath: string): OfficeFileTarget | null {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return EDITOR_BY_EXT[ext] ?? null;
}

/** Find the first office file path in a process argv (file-association launch). */
export function extractOfficeFileArg(argv: string[]): string | null {
  for (const value of argv) {
    if (/^--/.test(value)) continue;
    if (editorForFile(value)) return value;
  }
  return null;
}
