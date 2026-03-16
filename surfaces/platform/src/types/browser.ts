/**
 * BrowserView Types
 * 
 * Ported from: 6-ui/shell-ui/src/views/browserview/src/lib.rs
 * 
 * Provides native browser view component types for ShellUI with agentic browsing capabilities.
 * Supports deterministic, policy-gated browser automation integrated with A2R DAG/WIH workflows.
 */

// ============================================================================
// Core BrowserView Types
// ============================================================================

/** Browser view configuration */
export interface BrowserViewConfig {
  /** Initial URL to load */
  initial_url?: string;
  /** Enable JavaScript */
  enable_javascript: boolean;
  /** Enable cookies */
  enable_cookies: boolean;
  /** User agent string */
  user_agent?: string;
  /** Proxy settings */
  proxy?: ProxyConfig;
  /** Viewport size */
  viewport: ViewportSize;
  /** Enable ad blocking */
  enable_adblock: boolean;
  /** Enable agent mode */
  enable_agent_mode: boolean;
}

/** Default browser configuration */
export const defaultBrowserConfig: BrowserViewConfig = {
  enable_javascript: true,
  enable_cookies: true,
  viewport: { width: 1920, height: 1080 },
  enable_adblock: false,
  enable_agent_mode: true,
};

/** Proxy configuration */
export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

/** Viewport size */
export interface ViewportSize {
  width: number;
  height: number;
}

/** Default viewport */
export const defaultViewport: ViewportSize = {
  width: 1920,
  height: 1080,
};

/** Browser session state */
export interface BrowserState {
  /** Current URL */
  current_url: string;
  /** Page title */
  title: string;
  /** Loading state */
  loading: boolean;
  /** Navigation history */
  history: HistoryEntry[];
  /** Current history index */
  history_index: number;
  /** Session ID */
  session_id: string;
  /** Agent mode active */
  agent_mode_active: boolean;
  /** Last capture result */
  last_capture?: CaptureResult;
}

/** History entry */
export interface HistoryEntry {
  url: string;
  title: string;
  timestamp: string; // ISO 8601
  renderer: RendererType;
}

/** Renderer type (HUMAN vs AGENT) */
export enum RendererType {
  Human = 'human',
  Agent = 'agent',
}

// ============================================================================
// Browser Actions
// ============================================================================

/** Navigate action */
export interface NavigateAction {
  action: 'navigate';
  url: string;
  renderer: RendererType;
}

/** Screenshot action */
export interface ScreenshotAction {
  action: 'screenshot';
  full_page: boolean;
}

/** Extract action */
export interface ExtractAction {
  action: 'extract';
  selector: string;
}

/** Click action */
export interface ClickAction {
  action: 'click';
  selector: string;
}

/** Type text action */
export interface TypeTextAction {
  action: 'type_text';
  selector: string;
  text: string;
}

/** Scroll action */
export interface ScrollAction {
  action: 'scroll';
  x: number;
  y: number;
}

/** Wait for element action */
export interface WaitForAction {
  action: 'wait_for';
  selector: string;
  timeout_ms: number;
}

/** Evaluate script action */
export interface EvaluateAction {
  action: 'evaluate';
  script: string;
}

/** Simple actions with no params */
export type SimpleAction = 
  | { action: 'back' }
  | { action: 'forward' }
  | { action: 'reload' }
  | { action: 'stop' };

/** Union of all browser actions */
export type BrowserAction =
  | NavigateAction
  | ScreenshotAction
  | ExtractAction
  | ClickAction
  | TypeTextAction
  | ScrollAction
  | WaitForAction
  | EvaluateAction
  | SimpleAction;

/** Browser action result */
export interface BrowserActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  receipt_id?: string;
}

// ============================================================================
// Capture Types
// ============================================================================

/** Capture size preset */
export enum CaptureSize {
  Viewport = 'viewport',
  FullPage = 'full_page',
  Element = 'element',
}

/** Capture result */
export interface CaptureResult {
  /** Base64-encoded image data */
  data: string;
  /** Image format */
  format: 'png' | 'jpeg' | 'webp';
  /** Image width */
  width: number;
  /** Image height */
  height: number;
  /** Capture timestamp */
  timestamp: string;
  /** Captured URL */
  url: string;
}

// ============================================================================
// Playwright Integration Types
// ============================================================================

/** Playwright browser configuration */
export interface PlaywrightConfig {
  /** Browser to use (chrome, firefox, edge, safari) */
  browser: 'chrome' | 'firefox' | 'edge' | 'safari';
  /** Headless mode */
  headless: boolean;
  /** WebDriver URL */
  webdriver_url: string;
  /** Default timeout in seconds */
  timeout_secs: number;
  /** Enable extensions */
  enable_extensions: boolean;
  /** User data directory */
  user_data_dir?: string;
}

/** Production Playwright config */
export const productionPlaywrightConfig: PlaywrightConfig = {
  browser: 'chrome',
  headless: true,
  webdriver_url: 'http://localhost:4444',
  timeout_secs: 30,
  enable_extensions: false,
};

/** Development Playwright config */
export const developmentPlaywrightConfig: PlaywrightConfig = {
  browser: 'chrome',
  headless: false,
  webdriver_url: 'http://localhost:4444',
  timeout_secs: 60,
  enable_extensions: true,
};

/** Page information */
export interface PageInfo {
  url: string;
  title: string;
  html: string;
}

/** Screenshot result from Playwright */
export interface ScreenshotResult {
  data: Uint8Array;
  format: string;
  width: number;
  height: number;
}

/** Cookie information */
export interface CookieInfo {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  http_only: boolean;
  secure: boolean;
  same_site: 'strict' | 'lax' | 'none';
}

// ============================================================================
// Session Types
// ============================================================================

/** Session configuration */
export interface SessionConfig {
  /** Session timeout in seconds */
  timeout_secs: number;
  /** Maximum history entries */
  max_history: number;
  /** Enable receipt generation */
  enable_receipts: boolean;
  /** Policy tier for this session */
  policy_tier: string;
}

/** Session metadata */
export interface SessionMetadata {
  session_id: string;
  created_at: string;
  last_activity: string;
  request_count: number;
  policy_tier: string;
}
