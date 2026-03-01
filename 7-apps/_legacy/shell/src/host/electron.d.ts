/**
 * Type declarations for Electron IPC APIs exposed via contextBridge
 */

import type { DidNavigateEvent, TitleUpdatedEvent, DidFailLoadEvent, DidFinishLoadEvent, NewTabRequestedEvent, StageAttachedEvent } from './types';

interface ElectronBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface A2BrowserAPI {
  createTab(url?: string): Promise<{ tabId: string; success: boolean }>;
  closeTab(tabId: string): Promise<void>;
  navigate(tabId: string, url: string): Promise<void>;
  goBack(tabId: string): Promise<void>;
  goForward(tabId: string): Promise<void>;
  reload(tabId: string): Promise<void>;
  attachStage(tabId: string, bounds: ElectronBounds): Promise<void>;
  detachStage(tabId: string): Promise<void>;
  setStageBounds(tabId: string, bounds: ElectronBounds): Promise<void>;
  getTabs(): Promise<{ id: string; url: string; title: string }[]>;
  getStageTabId(): Promise<string | null>;
  onDidNavigate(callback: (event: DidNavigateEvent) => void): () => void;
  onTitleUpdated(callback: (event: TitleUpdatedEvent) => void): () => void;
  onDidFailLoad(callback: (event: DidFailLoadEvent) => void): () => void;
  onDidFinishLoad(callback: (event: DidFinishLoadEvent) => void): () => void;
  onNewTabRequested(callback: (event: NewTabRequestedEvent) => void): () => void;
  onStageAttached(callback: (event: StageAttachedEvent) => void): () => void;
  onStageDetached(callback: (event: { tabId: string }) => void): () => void;
  onStageBoundsChanged(callback: (event: StageAttachedEvent) => void): () => void;
  onTabClosed(callback: (event: { tabId: string }) => void): () => void;
}

export interface A2ShellAPI {
  getVersion(): Promise<string>;
  quit(): Promise<void>;
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  onThemeChanged(callback: (theme: 'light' | 'dark' | 'system') => void): () => void;
}

export interface WindowWithA2Browser {
  a2Browser: A2BrowserAPI;
  a2Shell: A2ShellAPI;
}

declare global {
  interface Window extends WindowWithA2Browser {}
}

export {};
