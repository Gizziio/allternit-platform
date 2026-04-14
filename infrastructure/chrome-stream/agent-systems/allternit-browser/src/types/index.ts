/**
 * A2R Browser & Canvas Types
 * Ported from OpenClaw dist/browser/ and dist/canvas-host/
 */

// ============================================================================
// Browser Types
// ============================================================================

export interface BrowserConfig {
  enabled: boolean;
  controlPort: number;
  headless: boolean;
  noSandbox: boolean;
  executablePath?: string;
  attachOnly: boolean;
  profiles: Record<string, BrowserProfile>;
}

export interface BrowserProfile {
  name: string;
  color?: string;
  cdpPort: number;
  cdpUrl: string;
  driver?: 'chromium' | 'extension';
  userDataDir?: string;
}

export interface BrowserState {
  server?: any;
  port: number;
  resolved: BrowserConfig;
  profiles: Map<string, ProfileState>;
}

export interface ProfileState {
  running?: {
    pid: number;
    exe: { kind: string; path: string };
    userDataDir: string;
  };
}

export interface BrowserTab {
  targetId: string;
  url: string;
  title: string;
  type: 'page' | 'background_page' | 'service_worker';
  wsUrl?: string;
}

export interface SnapshotOptions {
  format: 'ai' | 'aria';
  targetId?: string;
  limit?: number;
  maxChars?: number;
  refs?: 'aria' | 'role';
  interactive?: boolean;
  compact?: boolean;
  depth?: number;
  selector?: string;
  frame?: string;
  labels?: boolean;
  mode?: 'efficient';
  profile?: string;
}

export interface SnapshotResult {
  ok: true;
  format: 'ai' | 'aria';
  targetId: string;
  url: string;
  snapshot?: string;
  refs?: Record<string, string>;
  labels?: boolean;
  labelsCount?: number;
  labelsSkipped?: number;
  imagePath?: string;
  imageType?: string;
}

export interface ScreenshotOptions {
  targetId?: string;
  fullPage?: boolean;
  ref?: string;
  element?: string;
  type: 'png' | 'jpeg';
}

export interface ScreenshotResult {
  ok: true;
  path: string;
  targetId: string;
  url: string;
}

export type ActKind = 
  | 'click' 
  | 'type' 
  | 'press' 
  | 'hover' 
  | 'scrollIntoView'
  | 'drag'
  | 'select'
  | 'fill'
  | 'resize'
  | 'wait'
  | 'evaluate'
  | 'close';

export interface ActRequest {
  kind: ActKind;
  targetId?: string;
  ref?: string;
  text?: string;
  submit?: boolean;
  slowly?: boolean;
  doubleClick?: boolean;
  button?: 'left' | 'right' | 'middle';
  modifiers?: string[];
  key?: string;
  delayMs?: number;
  startRef?: string;
  endRef?: string;
  values?: string[];
  fields?: Array<{ ref: string; type: string; value?: unknown }>;
  width?: number;
  height?: number;
  timeMs?: number;
  textGone?: string;
  selector?: string;
  url?: string;
  loadState?: 'load' | 'domcontentloaded' | 'networkidle';
  fn?: string;
  timeoutMs?: number;
}

// ============================================================================
// Canvas Types
// ============================================================================

export interface CanvasHostConfig {
  rootDir: string;
  basePath: string;
  liveReload: boolean;
  port?: number;
  listenHost?: string;
}

export interface CanvasHostHandler {
  rootDir: string;
  basePath: string;
  handleHttpRequest: (req: any, res: any) => Promise<boolean>;
  handleUpgrade: (req: any, socket: any, head: any) => boolean;
  close: () => Promise<void>;
}

export interface CanvasPlacement {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface CanvasPresentParams {
  url?: string;
  placement?: CanvasPlacement;
}

export interface CanvasNavigateParams {
  url: string;
}

export interface CanvasEvalParams {
  javaScript: string;
}

export interface CanvasSnapshotParams {
  format: 'png' | 'jpeg';
  maxWidth?: number;
  quality?: number;
  delayMs?: number;
}

export interface CanvasA2UIPushParams {
  jsonl: string;
}

export type CanvasAction = 
  | 'present'
  | 'hide'
  | 'navigate'
  | 'eval'
  | 'snapshot'
  | 'a2ui_push'
  | 'a2ui_reset';

// ============================================================================
// Gateway Command Types
// ============================================================================

export interface NodeInvokeRequest {
  nodeId: string;
  command: string;
  params?: unknown;
  idempotencyKey?: string;
}

export interface NodeInvokeResponse {
  payload?: unknown;
  error?: string;
}

export interface GatewayToolContext {
  gatewayUrl?: string;
  gatewayToken?: string;
  timeoutMs?: number;
}

// ============================================================================
// Tool Types
// ============================================================================

export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  optional?: boolean;
}

export interface ToolDefinition {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, ToolParameter>;
}

export interface ToolResult {
  content?: Array<{ type: string; text?: string; image_url?: { url: string } }>;
  details?: unknown;
}
