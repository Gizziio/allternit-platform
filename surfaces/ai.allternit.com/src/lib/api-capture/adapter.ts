/**
 * Cross-surface API capture adapter.
 *
 * Picks the best available capture source for the current runtime:
 *   1. Electron desktop shell (`window.allternit.browserCapture`)
 *   2. Browser extension (`chrome.runtime.sendMessage`)
 *   3. Direct HAR upload (no-op live capture)
 */

export interface CaptureAdapter {
  name: string;
  isAvailable(): boolean;
  start(options?: CaptureStartOptions): Promise<{ sessionId: string }>;
  stop(sessionId: string): Promise<{ har: string }>;
}

export interface CaptureStartOptions {
  domain?: string;
  filterUrls?: string[];
  tabId?: number;
}

interface DesktopCaptureResult {
  success?: boolean;
  sessionId?: string;
  har?: string;
  error?: string;
}

interface DesktopCaptureAPI {
  start?: (options?: { filterUrls?: string[] }) => Promise<DesktopCaptureResult>;
  stop?: (sessionId: string) => Promise<DesktopCaptureResult>;
  isAvailable?: () => Promise<boolean>;
}

interface ExtensionCaptureResult {
  sessionId?: string;
  har?: string;
  error?: string;
}

function getDesktopAPI(): DesktopCaptureAPI | undefined {
  if (typeof window === 'undefined') return undefined;
  return ((window as any).allternit as { browserCapture?: DesktopCaptureAPI } | undefined)?.browserCapture;
}

function getExtensionRuntime(): { sendMessage: (message: unknown) => Promise<ExtensionCaptureResult> } | undefined {
  if (typeof window === 'undefined') return undefined;
  const chrome = (window as any).chrome as { runtime?: { sendMessage?: (message: unknown) => Promise<ExtensionCaptureResult> } } | undefined;
  if (!chrome?.runtime?.sendMessage) return undefined;
  return { sendMessage: chrome.runtime.sendMessage.bind(chrome.runtime) };
}

function getDesktopAdapter(): CaptureAdapter {
  return {
    name: 'desktop',
    isAvailable() {
      return !!getDesktopAPI();
    },
    async start(options) {
      const api = getDesktopAPI();
      if (!api?.start) {
        throw new Error('Desktop capture API is not available');
      }
      const filterUrls = options?.domain ? [`*://${options.domain}/*`] : options?.filterUrls;
      const result = await api.start({ filterUrls });
      if (!result.success || !result.sessionId) {
        throw new Error(result.error || 'Failed to start desktop capture');
      }
      return { sessionId: result.sessionId };
    },
    async stop(sessionId) {
      const api = getDesktopAPI();
      if (!api?.stop) {
        throw new Error('Desktop capture API is not available');
      }
      const result = await api.stop(sessionId);
      if (!result.success || !result.har) {
        throw new Error(result.error || 'Failed to stop desktop capture');
      }
      return { har: result.har };
    },
  };
}

function getExtensionAdapter(): CaptureAdapter {
  return {
    name: 'extension',
    isAvailable() {
      return !!getExtensionRuntime();
    },
    async start(options) {
      const runtime = getExtensionRuntime();
      if (!runtime) {
        throw new Error('Browser extension capture is not available');
      }
      const result = await runtime.sendMessage({
        type: 'API_CAPTURE_START',
        tabId: options?.tabId,
        filterUrls: options?.domain ? [`*://${options.domain}/*`] : options?.filterUrls,
      });
      if (!result.sessionId) {
        throw new Error(result.error || 'Failed to start extension capture');
      }
      return { sessionId: result.sessionId };
    },
    async stop(sessionId) {
      const runtime = getExtensionRuntime();
      if (!runtime) {
        throw new Error('Browser extension capture is not available');
      }
      const result = await runtime.sendMessage({
        type: 'API_CAPTURE_STOP',
        sessionId,
      });
      if (!result.har) {
        throw new Error(result.error || 'Failed to stop extension capture');
      }
      return { har: result.har };
    },
  };
}

function getUploadAdapter(): CaptureAdapter {
  return {
    name: 'upload',
    isAvailable: () => true,
    async start() {
      return { sessionId: 'upload' };
    },
    async stop() {
      throw new Error('Upload adapter does not record network traffic. Use the HAR file upload option.');
    },
  };
}

export function getCaptureAdapter(): CaptureAdapter {
  const desktop = getDesktopAdapter();
  if (desktop.isAvailable()) return desktop;
  const extension = getExtensionAdapter();
  if (extension.isAvailable()) return extension;
  return getUploadAdapter();
}
