// Browser Runtime API Types

export interface BrowserConfig {
  headless?: boolean;
  viewport?: {
    width: number;
    height: number;
  };
  userAgent?: string;
  timeout?: number;
}

export interface CreateSessionRequest {
  url?: string;
  width?: number;
  height?: number;
}

export interface CreateSessionResponse {
  sessionId: string;
}

export interface NavigateRequest {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface ClickRequest {
  selector?: string;
  x?: number;
  y?: number;
  button?: 'left' | 'right' | 'middle';
  delay?: number;
}

export interface TypeRequest {
  text: string;
  selector?: string;
  delay?: number;
}

export interface ScrollRequest {
  deltaX: number;
  deltaY: number;
}

export interface GotoRequest {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface ScreenshotResponse {
  contentType: string;
  data: Buffer;
}

export interface DOMResponse {
  url: string;
  title: string;
  html: string;
  text: string;
}

export interface ErrorResponse {
  error: string;
}

// WebSocket Event Types
export interface WSEvent {
  type: 'dom-change' | 'console' | 'network' | 'error' | 'load' | 'frame';
  sessionId: string;
  data: any;
  timestamp: number;
}

export interface ConsoleEvent {
  type: 'log' | 'error' | 'warn' | 'info';
  text: string;
  location?: {
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
}

export interface NetworkEvent {
  id: string;
  type: 'request' | 'response';
  url: string;
  method: string;
  status?: number;
  timestamp: number;
}

export interface DOMChangeEvent {
  type: 'added' | 'removed' | 'modified';
  selector: string;
}

// Default configuration
export const DEFAULT_CONFIG: BrowserConfig = {
  headless: true,
  viewport: { width: 1280, height: 720 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  timeout: 30000,
};

// ============================================
// GOLD STANDARD BROWSER TYPES
// ============================================

// Unified input event types for INSPECT/LIVE modes
export type InputEventType =
  | 'mousemove'
  | 'mousedown'
  | 'mouseup'
  | 'wheel'
  | 'keydown'
  | 'keyup'
  | 'text';

export interface UnifiedInputEvent {
  type: InputEventType;
  x?: number;
  y?: number;
  button?: string;
  deltaX?: number;
  deltaY?: number;
  key?: string;
  text?: string;
}

// Input request from frontend
export interface InputRequest {
  type: InputEventType;
  x?: number;
  y?: number;
  button?: string;
  deltaX?: number;
  deltaY?: number;
  key?: string;
  text?: string;
}

// Popup event from browser (for popup interception)
export interface PopupEvent {
  event: 'popup_created';
  openerPageId?: string;
  popupPageId: string;
  url: string;
  title: string;
  timestamp: number;
}

// Performance metrics
export interface PerformanceMetrics {
  fps: number;
  latency: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

// Tab info for multi-tab support
export interface TabInfo {
  id: string;
  url: string;
  title: string;
  isActive: boolean;
}
