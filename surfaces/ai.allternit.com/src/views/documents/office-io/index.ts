import { importDocx, exportDocx } from './docx';
import { importXlsx, exportXlsx } from './xlsx';
import { importPptx, exportPptx } from './pptx';
import type { AllternitDeck, AllternitDocument, AllternitWorkbook, ImportResult, OfficeFileInput } from './types';

export type { AllternitDeck, AllternitDocument, AllternitWorkbook, ImportResult };
export * from './types';

export type OfficeFormat = 'docx' | 'xlsx' | 'pptx';

export function detectOfficeFormat(file: OfficeFileInput): OfficeFormat | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'xlsx';
  if (name.endsWith('.pptx') || name.endsWith('.ppt')) return 'pptx';
  return null;
}

export async function importOfficeFile(
  file: OfficeFileInput
): Promise<ImportResult<AllternitDocument | AllternitWorkbook | AllternitDeck>> {
  const format = detectOfficeFormat(file);
  switch (format) {
    case 'docx':
      return importDocx(file);
    case 'xlsx':
      return importXlsx(file);
    case 'pptx':
      return importPptx(file);
    default:
      throw new Error(`Unsupported Office file: ${file.name}`);
  }
}

export async function exportDocxFile(document: AllternitDocument): Promise<Blob> {
  return exportDocx(document);
}

export async function exportXlsxFile(workbook: AllternitWorkbook): Promise<Blob> {
  return exportXlsx(workbook);
}

export async function exportPptxFile(deck: AllternitDeck): Promise<Blob> {
  return exportPptx(deck);
}
