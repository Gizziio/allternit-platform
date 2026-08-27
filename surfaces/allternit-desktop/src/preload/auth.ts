/**
 * Narrow preload for the desktop auth renderer window.
 *
 * The auth renderer runs with contextIsolation enabled and only receives the
 * IPC channels needed to hand the Clerk session token to the main process and
 * to request OAuth popup handling.
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export interface ClerkTokenPayload {
  token: string;
  userId: string;
  email: string;
}

const authAPI = {
  onClerkToken: (payload: ClerkTokenPayload): Promise<void> =>
    ipcRenderer.invoke('auth:clerk-token', payload),
  onClerkError: (message: string): Promise<void> =>
    ipcRenderer.invoke('auth:clerk-error', message),
  startOAuth: (startUrl: string): Promise<string> =>
    ipcRenderer.invoke('auth:oauth-start', startUrl),
  onStatus: (handler: (message: string) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, message: string) => handler(message);
    ipcRenderer.on('auth:renderer-status', listener);
    return () => ipcRenderer.removeListener('auth:renderer-status', listener);
  },
};

declare global {
  interface Window {
    allternitAuth: typeof authAPI;
  }
}

contextBridge.exposeInMainWorld('allternitAuth', authAPI);
