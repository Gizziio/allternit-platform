/**
 * Cross-surface API capture adapter interface.
 *
 * Desktop, extension, and web surfaces each expose a different native capture
 * capability (Electron webRequest, chrome.debugger, or none). The UI uses this
 * adapter to start/stop capture without caring which host is available.
 */

export interface CaptureAdapter {
  readonly mode: 'desktop' | 'extension' | 'upload';
  readonly canRecord: boolean;
  isAvailable(): Promise<boolean>;
  start(options?: { filterUrls?: string[] }): Promise<{ sessionId: string }>;
  stop(sessionId: string): Promise<{ har: string }>;
  getHelpText(): string;
}

export interface AdapterChoice {
  adapter: CaptureAdapter;
  fallback?: CaptureAdapter;
}

function getDesktopAdapter(): CaptureAdapter | undefined {
  if (typeof window === 'undefined') return undefined;
  const desktop = (window as any).allternit as { browserCapture?: {
    isAvailable: () => Promise<boolean>;
    start: (options?: { filterUrls?: string[] }) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
    stop: (sessionId: string) => Promise<{ success: boolean; har?: string; error?: string }>;
  } } | undefined;
  if (!desktop?.browserCapture) return undefined;
  const api = desktop.browserCapture;
  return {
    mode: 'desktop',
    get canRecord() { return true; },
    isAvailable: () => api.isAvailable(),
    start: async (options) => {
      const result = await api.start(options);
      if (!result.success || !result.sessionId) {
        throw new Error(result.error || 'Failed to start desktop capture');
      }
      return { sessionId: result.sessionId };
    },
    stop: async (sessionId) => {
      const result = await api.stop(sessionId);
      if (!result.success || !result.har) {
        throw new Error(result.error || 'Failed to stop desktop capture');
      }
      return { har: result.har };
    },
    getHelpText: () => 'Desktop recording is active. Perform your workflow, then stop to derive the API contract.',
  };
}

function getExtensionAdapter(): CaptureAdapter | undefined {
  if (typeof window === 'undefined') return undefined;
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return undefined;

  const sendMessage = <T>(message: unknown): Promise<T> => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as T);
      }
    });
  });

  return {
    mode: 'extension',
    get canRecord() { return true; },
    isAvailable: async () => {
      try {
        const res = await sendMessage<{ available: boolean }>({ type: 'API_CAPTURE_AVAILABLE' });
        return res.available ?? false;
      } catch {
        return false;
      }
    },
    start: async (options) => {
      const activeTab = await new Promise<chrome.tabs.Tab | undefined>((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]));
      });
      const res = await sendMessage<{ ok: boolean; sessionId?: string; error?: string }>({
        type: 'API_CAPTURE_START',
        tabId: activeTab?.id,
        filterUrls: options?.filterUrls,
      });
      if (!res.ok || !res.sessionId) {
        throw new Error(res.error || 'Failed to start extension capture');
      }
      return { sessionId: res.sessionId };
    },
    stop: async (sessionId) => {
      const res = await sendMessage<{ ok: boolean; har?: string; error?: string }>({
        type: 'API_CAPTURE_STOP',
        sessionId,
      });
      if (!res.ok || !res.har) {
        throw new Error(res.error || 'Failed to stop extension capture');
      }
      return { har: res.har };
    },
    getHelpText: () => 'Extension recording uses Chrome debugger. A "Remote debugging" bar will appear in the target tab.',
  };
}

const uploadAdapter: CaptureAdapter = {
  mode: 'upload',
  canRecord: false,
  isAvailable: async () => true,
  start: async () => { throw new Error('Upload adapter cannot record live traffic'); },
  stop: async () => { throw new Error('Upload adapter cannot record live traffic'); },
  getHelpText: () => 'Upload a HAR file exported from browser DevTools to derive API contracts.',
};

/**
 * Pick the best available capture adapter.
 *
 * Order: desktop shell > Chrome extension > upload-only fallback.
 */
export function getCaptureAdapter(): AdapterChoice {
  const desktop = getDesktopAdapter();
  if (desktop) return { adapter: desktop, fallback: getExtensionAdapter() ?? uploadAdapter };

  const extension = getExtensionAdapter();
  if (extension) return { adapter: extension, fallback: uploadAdapter };

  return { adapter: uploadAdapter };
}
