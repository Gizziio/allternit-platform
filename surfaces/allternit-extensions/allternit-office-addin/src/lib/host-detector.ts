/**
 * Office host detection — pattern from DocuPilotAI/DocuPilot (MIT)
 * Detects which Microsoft Office application is hosting the add-in.
 */

export type OfficeHostType = 'excel' | 'word' | 'powerpoint' | 'unknown'

export function getOfficeHost(): OfficeHostType {
  if (typeof Office === 'undefined' || !Office.context) return 'unknown'

  switch (Office.context.host) {
    case Office.HostType.Excel:       return 'excel'
    case Office.HostType.Word:        return 'word'
    case Office.HostType.PowerPoint:  return 'powerpoint'
    default:                          return 'unknown'
  }
}

export function isExcelHost():       boolean { return getOfficeHost() === 'excel' }
export function isWordHost():        boolean { return getOfficeHost() === 'word' }
export function isPowerPointHost():  boolean { return getOfficeHost() === 'powerpoint' }
export function isOfficeHost():      boolean { return getOfficeHost() !== 'unknown' }

export function getOfficeHostDisplayName(): string {
  switch (getOfficeHost()) {
    case 'excel':       return 'Excel Workbook'
    case 'word':        return 'Word Document'
    case 'powerpoint':  return 'PowerPoint Presentation'
    default:            return 'Office Document'
  }
}

export function getOfficeHostPlaceholder(): string {
  switch (getOfficeHost()) {
    case 'excel':       return 'Analyze this sheet, generate a formula, summarize data…'
    case 'word':        return 'Rewrite this paragraph, summarize the document, fix grammar…'
    case 'powerpoint':  return 'Suggest slide content, rewrite this slide, create an outline…'
    default:            return 'Enter a task…'
  }
}
