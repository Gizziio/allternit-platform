/**
 * Electron Browser Host Types
 *
 * Type definitions for the Electron Browser Host module.
 */

export type NavIntent = "user" | "agent";

export interface DidNavigateEvent {
  tabId: string;
  url: string;
}

export interface TitleUpdatedEvent {
  tabId: string;
  title: string;
}

export interface DidFailLoadEvent {
  tabId: string;
  errorCode: number;
  errorDescription: string;
}

export interface DidFinishLoadEvent {
  tabId: string;
  url: string;
}

export interface NewTabRequestedEvent {
  openerTabId: string;
  url: string;
  target: string;
}

export interface StageAttachedEvent {
  tabId: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface StageBoundsChangedEvent {
  tabId: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface TabClosedEvent {
  tabId: string;
}

export interface BrowserHostConfig {
  defaultUrl?: string;
  debug?: boolean;
}

export interface CreateTabResult {
  tabId: string;
  success: boolean;
  error?: string;
}

export interface TabInfo {
  id: string;
  url: string;
  title: string;
}
