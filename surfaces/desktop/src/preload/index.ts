/**
 * A2R Desktop - Preload Script
 *
 * Exposes APIs for self-hosted backend connection and SDK URL resolution.
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export interface A2RDesktopAPI {
  // Connection
  connection: {
    test: () => Promise<{ mode: string; url: string; status: string; lastError?: string }>;
    getBackend: () => Promise<{ mode: 'vps' | 'local'; vpsUrl: string; localPort: number }>;
    setBackend: (config: { mode: 'vps' | 'local'; vpsUrl: string; localPort: number }) => Promise<any>;
    discover: () => Promise<string | null>;
    onStateChange: (callback: (state: any) => void) => () => void;
  };

  // SDK — exposes the resolved backend URL so the renderer can create an A2RClient
  sdk: {
    getBackendUrl: () => Promise<string>;
  };

  // Store
  store: {
    get: <T>(key: string) => Promise<T>;
    set: <T>(key: string, value: T) => Promise<void>;
  };

  // App
  app: {
    getInfo: () => Promise<{ version: string; platform: string; isPackaged: boolean }>;
  };

  // Shell
  shell: {
    openExternal: (url: string) => Promise<void>;
  };

  // Dialog
  dialog: {
    showSave: (options: any) => Promise<any>;
    showOpen: (options: any) => Promise<any>;
  };
}

const api: A2RDesktopAPI = {
  connection: {
    test: () => ipcRenderer.invoke('connection:test'),
    getBackend: () => ipcRenderer.invoke('connection:get-backend'),
    setBackend: (config) => ipcRenderer.invoke('connection:set-backend', config),
    discover: () => ipcRenderer.invoke('connection:discover'),
    onStateChange: (callback) => {
      const handler = (_event: IpcRendererEvent, state: any) => callback(state);
      ipcRenderer.on('connection:state', handler);
      return () => ipcRenderer.off('connection:state', handler);
    },
  },

  sdk: {
    getBackendUrl: () => ipcRenderer.invoke('sdk:get-backend-url'),
  },

  store: {
    get: <T>(key: string) => ipcRenderer.invoke('store:get', key) as Promise<T>,
    set: <T>(key: string, value: T) => ipcRenderer.invoke('store:set', key, value),
  },

  app: {
    getInfo: () => ipcRenderer.invoke('app:get-info'),
  },

  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  },

  dialog: {
    showSave: (options) => ipcRenderer.invoke('dialog:show-save', options),
    showOpen: (options) => ipcRenderer.invoke('dialog:show-open', options),
  },
};

contextBridge.exposeInMainWorld('a2rDesktop', api);

declare global {
  interface Window {
    a2rDesktop: A2RDesktopAPI;
  }
}
