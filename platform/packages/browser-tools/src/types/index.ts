/**
 * Browser Tools Types
 * 
 * Core type definitions for browser automation tools.
 * Provides type-safe interfaces for browser control, DOM extraction,
 * and action execution.
 */

// ============================================================================
// Browser Control Types
// ============================================================================

export interface BrowserSession {
  id: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  url?: string;
  title?: string;
  viewport: Viewport;
  createdAt: Date;
  lastActivity: Date;
}

export interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
}

export interface BrowserCapabilities {
  canScreenshot: boolean;
  canInteract: boolean;
  canNavigate: boolean;
  canExtractDOM: boolean;
  supportedActions: ActionType[];
}

// ============================================================================
// DOM Types
// ============================================================================

export interface DOMElement {
  id: string;
  tag: string;
  text?: string;
  attributes: Record<string, string>;
  bounds: DOMRect;
  isVisible: boolean;
  isInteractive: boolean;
  selector: string;
  children?: DOMElement[];
}

export interface DOMRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedContent {
  text: string;
  links: LinkInfo[];
  images: ImageInfo[];
  forms: FormInfo[];
  tables: TableInfo[];
}

export interface LinkInfo {
  text: string;
  href: string;
  selector: string;
}

export interface ImageInfo {
  src: string;
  alt?: string;
  dimensions?: { width: number; height: number };
  selector: string;
}

export interface FormInfo {
  id?: string;
  action?: string;
  method?: string;
  fields: FormField[];
  selector: string;
}

export interface FormField {
  name: string;
  type: string;
  label?: string;
  value?: string;
  required: boolean;
  selector: string;
}

export interface TableInfo {
  headers: string[];
  rows: string[][];
  selector: string;
}

// ============================================================================
// Action Types
// ============================================================================

export type ActionType = 
  | 'click'
  | 'type'
  | 'clear'
  | 'select'
  | 'scroll'
  | 'hover'
  | 'focus'
  | 'press'
  | 'navigate'
  | 'back'
  | 'forward'
  | 'reload'
  | 'screenshot'
  | 'wait';

export interface ActionRequest {
  type: ActionType;
  selector?: string;
  value?: string;
  options?: ActionOptions;
  timeout?: number;
}

export interface ActionOptions {
  delay?: number;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  modifiers?: ('alt' | 'ctrl' | 'meta' | 'shift')[];
  scrollBehavior?: 'smooth' | 'auto';
  waitForNavigation?: boolean;
}

export interface ActionResult {
  success: boolean;
  action: ActionType;
  selector?: string;
  newUrl?: string;
  screenshot?: string; // base64 encoded
  error?: ActionError;
  duration: number;
}

export interface ActionError {
  code: string;
  message: string;
  recoverable: boolean;
  suggestion?: string;
}

// ============================================================================
// Safety & Quarantine Types
// ============================================================================

export interface SafetyPolicy {
  allowedHosts: string[];
  blockedHosts: string[];
  allowedSchemes: string[];
  maxNavigationDepth: number;
  requireApprovalFor: ActionType[];
  dataSensitivity: 'low' | 'medium' | 'high';
}

export interface QuarantineSession {
  id: string;
  isolationLevel: 'none' | 'incognito' | 'container' | 'vm';
  networkPolicy: NetworkPolicy;
  dataRetention: DataRetentionPolicy;
  auditLog: AuditEvent[];
}

export interface NetworkPolicy {
  allowOutbound: boolean;
  allowedDomains: string[];
  blockedDomains: string[];
  requireProxy: boolean;
}

export interface DataRetentionPolicy {
  screenshotRetention: number; // hours
  dataRetention: number; // hours
  autoPurge: boolean;
}

export interface AuditEvent {
  timestamp: Date;
  action: string;
  target?: string;
  result: 'allowed' | 'blocked' | 'warned';
  reason?: string;
}

// ============================================================================
// Event Stream Types
// ============================================================================

export interface BrowserEvent {
  id: string;
  sessionId: string;
  timestamp: Date;
  type: BrowserEventType;
  payload: unknown;
}

export type BrowserEventType =
  | 'navigation'
  | 'dom_change'
  | 'click'
  | 'input'
  | 'scroll'
  | 'error'
  | 'screenshot'
  | 'action_complete';

export interface NavigationEvent {
  from?: string;
  to: string;
  title?: string;
  timestamp: Date;
}

export interface DOMChangeEvent {
  selector: string;
  changeType: 'added' | 'removed' | 'modified';
  previousText?: string;
  currentText?: string;
}

// ============================================================================
// Tool Result Types
// ============================================================================

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    duration: number;
    timestamp: Date;
    sessionId: string;
  };
}

export interface ScreenshotResult {
  base64: string;
  format: 'png' | 'jpeg';
  dimensions: { width: number; height: number };
  fullPage: boolean;
}

export interface NavigationResult {
  url: string;
  title: string;
  loadTime: number;
  status: number;
}
