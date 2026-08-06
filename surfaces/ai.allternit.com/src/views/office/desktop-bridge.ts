/**
 * Office desktop bridge: receives file-association payloads ("Open with
 * Allternit") from the Electron preload and routes them into the office
 * editors via the launcher's file-handoff store.
 *
 * Installed once from AppRoutes; a no-op in the browser (no preload API).
 */
import { stashFile } from './file-handoff';

interface OfficeDesktopApi {
  onOpenFile: (
    callback: (payload: { name: string; bytes: Uint8Array | number[] }) => void,
  ) => () => void;
}

const ROUTE_BY_EXT: Record<string, string> = {
  docx: 'docs',
  xlsx: 'sheets',
  pptx: 'slides',
  pdf: 'pdf',
  // Formats with no native editor open in the anydoc markdown preview
  // (mirrors OfficeSuiteSection.ROUTE_BY_EXT).
  doc: 'markdown-preview',
  docm: 'markdown-preview',
  ppt: 'markdown-preview',
  pps: 'markdown-preview',
  pot: 'markdown-preview',
  pptm: 'markdown-preview',
  ppsx: 'markdown-preview',
  ppsm: 'markdown-preview',
  xls: 'markdown-preview',
  xlsm: 'markdown-preview',
  xlsb: 'markdown-preview',
  odt: 'markdown-preview',
  ods: 'markdown-preview',
  odp: 'markdown-preview',
  rtf: 'markdown-preview',
  epub: 'markdown-preview',
  csv: 'markdown-preview',
};

export function installOfficeDesktopBridge(
  navigate: (path: string, options?: { state?: unknown }) => void,
): boolean {
  const api = (window as { allternit?: { office?: OfficeDesktopApi } }).allternit?.office;
  if (!api?.onOpenFile) return false;

  api.onOpenFile(({ name, bytes }) => {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const target = ROUTE_BY_EXT[ext];
    if (!target) return;
    const u8 = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
    const handoffId = stashFile({ name, bytes: u8 });
    navigate(`/${target}`, { state: { handoffId } });
  });
  return true;
}
