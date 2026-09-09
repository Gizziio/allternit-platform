/**
 * Office desktop bridge: receives office open requests from the Electron
 * preload (app menu / file associations / shell:open-office IPC, all
 * delivered to the main window by the desktop main process) and routes them
 * into the single office surface — the shell's ACI "Office & Extensions"
 * hub and its in-shell editor views.
 *
 * Routing: when the shell is mounted ("/" or "/shell") the editor opens as
 * an in-shell view via the `allternit:open-view` event ShellApp listens for;
 * on standalone routes (e.g. an editor page already full-page) it falls back
 * to router navigation. File bytes go through the file-handoff store first.
 *
 * Installed once from AppRoutes; a no-op in the browser (no preload API).
 */
import { stashFile } from './file-handoff';

interface OfficeDesktopApi {
  onOpenFile: (
    callback: (payload: { name: string; bytes: Uint8Array | number[] }) => void,
  ) => () => void;
  onOpenTarget?: (
    callback: (payload: { target: string; artifactId?: string | null }) => void,
  ) => () => void;
}

/** In-shell view types for each open target (ViewRegistry view types). */
const VIEW_BY_TARGET: Record<string, string> = {
  docs: 'docs',
  sheets: 'sheets',
  slides: 'slides',
  pdf: 'pdf',
  // Formats with no native editor open in the anydoc markdown preview.
  markdown: 'markdown-preview',
};

/** Standalone route path fallback for a target (mirrors office-programs). */
function routeForTarget(target: string, artifactId?: string | null): string {
  if (target === 'markdown') return '/markdown-preview';
  return `/${target}${artifactId ? `/${encodeURIComponent(artifactId)}` : ''}`;
}

const ROUTE_BY_EXT: Record<string, string> = {
  docx: 'docs',
  xlsx: 'sheets',
  pptx: 'slides',
  pdf: 'pdf',
  md: 'markdown-preview',
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

  // The shell mounts ShellApp (the `allternit:open-view` listener) on the
  // home and shell routes. Everywhere else, open the editor route directly.
  const shellMounted = (): boolean =>
    window.location.pathname === '/' || window.location.pathname.startsWith('/shell');

  const openInShellOrRoute = (
    viewType: string,
    context: unknown,
    fallback: () => void,
  ): void => {
    if (shellMounted()) {
      window.dispatchEvent(
        new CustomEvent('allternit:open-view', { detail: { viewType, context } }),
      );
    } else {
      fallback();
    }
  };

  api.onOpenFile(({ name, bytes }) => {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const target = ROUTE_BY_EXT[ext];
    if (!target) return;
    const u8 = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
    const handoffId = stashFile({ name, bytes: u8 });
    openInShellOrRoute(target, { handoffId }, () =>
      navigate(`/${target}`, { state: { handoffId } }),
    );
  });

  // Target opens from the desktop main process (app menu, shell:open-office,
  // ALLTERNIT_OPEN_DOCS_ON_START). 'launcher' is the retired standalone
  // launcher: its replacement is the ACI "Office & Extensions" hub.
  api.onOpenTarget?.(({ target, artifactId }) => {
    if (target === 'launcher') {
      openInShellOrRoute('browser-extensions', undefined, () => navigate('/'));
      return;
    }
    const viewType = VIEW_BY_TARGET[target];
    if (!viewType) return;
    openInShellOrRoute(viewType, artifactId ? { artifactId } : undefined, () =>
      navigate(routeForTarget(target, artifactId)),
    );
  });

  return true;
}
