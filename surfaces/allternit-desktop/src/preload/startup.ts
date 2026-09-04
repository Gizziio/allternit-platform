/**
 * Allternit Desktop — Startup Window Preload
 *
 * Minimal bridge for the onboarding/loading splash. The startup window loads
 * a data: URL document, so it historically ran with nodeIntegration on and
 * contextIsolation off just to reach ipcRenderer. This preload exposes
 * exactly the channels the splash uses, letting the window run with
 * contextIsolation + sandbox enabled.
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('startup', {
  /** Welcome step: the user clicked "Get started" — begin sign-in. */
  startLogin: (): void => {
    ipcRenderer.send('auth:start-login');
  },
  /** Main-process push: backend service states for the loading step. */
  onServices: (callback: (services: unknown) => void) => subscribe('services', callback),
  /** Main-process push: status line text. */
  onStatus: (callback: (message: string) => void) => subscribe('status', callback),
  /** Main-process push: startup progress percent. */
  onProgress: (callback: (percent: number) => void) => subscribe('progress', callback),
  /** Main-process push: local backend connected. */
  onComplete: (callback: () => void) => subscribe<unknown>('complete', callback),
  /** Main-process push: startup failure message. */
  onError: (callback: (message: string) => void) => subscribe('error', callback),
});
