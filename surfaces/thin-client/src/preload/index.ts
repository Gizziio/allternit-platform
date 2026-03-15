/**
 * Preload Script
 * 
 * Exposes safe APIs to the renderer process via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Define the API type
export interface ThinClientAPI {
  // Connection
  getConnectionStatus: () => Promise<any>;
  sendMessage: (message: any) => Promise<any>;
  onConnectionStatus: (callback: (status: any) => void) => void;
  onBackendChanged: (callback: (backend: 'cloud' | 'desktop') => void) => void;

  // App Discovery
  getDiscoveredApps: () => Promise<any[]>;
  connectToApp: (appId: string) => Promise<boolean>;
  onDiscoveredApps: (callback: (apps: any[]) => void) => void;

  // Settings
  getSettings: () => Promise<any>;
  updateSettings: (settings: any) => Promise<boolean>;

  // Window
  hideWindow: () => void;
  openExternal: (url: string) => void;

  // Updates
  onUpdateAvailable: (callback: () => void) => void;
  onUpdateDownloaded: (callback: () => void) => void;

  // Platform info
  platform: string;
}

const api: ThinClientAPI = {
  // Connection
  getConnectionStatus: () => ipcRenderer.invoke('get-connection-status'),
  sendMessage: (message) => ipcRenderer.invoke('send-message', message),
  onConnectionStatus: (callback) => {
    ipcRenderer.on('connection-status', (_, status) => callback(status));
  },
  onBackendChanged: (callback) => {
    ipcRenderer.on('backend-changed', (_, backend) => callback(backend));
  },

  // App Discovery
  getDiscoveredApps: () => ipcRenderer.invoke('get-discovered-apps'),
  connectToApp: (appId) => ipcRenderer.invoke('connect-to-app', appId),
  onDiscoveredApps: (callback) => {
    ipcRenderer.on('discovered-apps', (_, apps) => callback(apps));
  },

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),

  // Window
  hideWindow: () => ipcRenderer.send('hide-window'),
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // Updates
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', () => callback());
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', () => callback());
  },

  // Platform info
  platform: process.platform,
};

// Expose the API
contextBridge.exposeInMainWorld('thinClient', api);

// Type declarations for the renderer
declare global {
  interface Window {
    thinClient: ThinClientAPI;
  }
}
