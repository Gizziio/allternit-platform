/**
 * Browser Action Types
 * 
 * TypeScript definitions for BROWSER.* tool contracts.
 * Mirrors the Rust definitions in api/src/tools/browser/mod.rs
 */

export type BrowserAction =
  | { type: 'click'; target: Target; options?: ActionOptions }
  | { type: 'type'; target: Target; text: string; options?: TypeOptions }
  | { type: 'clear'; target: Target }
  | { type: 'scroll'; target?: Target; direction: ScrollDirection; amount: number; unit: ScrollUnit }
  | { type: 'hover'; target: Target }
  | { type: 'focus'; target: Target }
  | { type: 'press'; key: string; modifiers?: KeyModifier[] }
  | { type: 'select'; target: Target; value: string };

export type Target =
  | { type: 'selector'; value: string }
  | { type: 'text'; value: string; exact?: boolean }
  | { type: 'role'; role: string; name?: string }
  | { type: 'xpath'; value: string }
  | { type: 'coordinates'; x: number; y: number }
  | { type: 'index'; selector: string; index: number };

export type ScrollDirection =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'toTop'
  | 'toBottom'
  | { type: 'toPosition'; x: number; y: number };

export type ScrollUnit = 'pixels' | 'percentage' | 'lines' | 'pages';

export type KeyModifier = 'Control' | 'Alt' | 'Shift' | 'Meta';

export interface ActionOptions {
  force?: boolean;
  delayMs?: number;
  timeoutMs?: number;
}

export interface TypeOptions extends ActionOptions {
  clear?: boolean;
  submit?: boolean;
}

// Tool parameter types
export interface GetContextParams {
  tabId?: string;
  includeDom?: boolean;
  includeAccessibility?: boolean;
  includeNetworkLog?: boolean;
  includeCookies?: boolean;
}

export interface ActParams {
  actions: BrowserAction[];
  timeoutMs?: number;
  waitForNavigation?: boolean;
}

export interface NavParams {
  navType: 'navigate' | 'back' | 'forward' | 'reload';
  url?: string;
  waitFor?: WaitCondition[];
  timeoutMs?: number;
}

export interface ExtractParams {
  queries: ExtractQuery[];
  scope?: 'page' | 'activeElement' | 'viewport';
  maxResults?: number;
}

export interface ScreenshotParams {
  target?: 'viewport' | 'fullPage' | { type: 'element'; selector: string };
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  clip?: { x: number; y: number; width: number; height: number };
}

export interface WaitParams {
  conditions: WaitCondition[];
  timeoutMs?: number;
}

export type WaitCondition =
  | { type: 'time'; ms: number }
  | { type: 'element'; target: Target; state?: ElementState }
  | { type: 'navigation' }
  | { type: 'networkIdle'; idleMs?: number }
  | { type: 'custom'; script: string };

export type ElementState = 'visible' | 'hidden' | 'enabled' | 'disabled' | 'attached';

export type ExtractQuery =
  | { type: 'text'; selector: string }
  | { type: 'attribute'; selector: string; attribute: string }
  | { type: 'html'; selector: string }
  | { type: 'form'; selector: string }
  | { type: 'table'; selector: string }
  | { type: 'links'; pattern?: string }
  | { type: 'images'; selector?: string }
  | { type: 'custom'; script: string; args?: unknown[] }
  | { type: 'accessibilityTree' }
  | { type: 'computedStyles'; selector: string; properties?: string[] };

// Response types
export interface ContextResponse {
  tabId: string;
  url: string;
  title: string;
  dom?: string;
  accessibilityTree?: unknown;
  networkLog?: NetworkEntry[];
  cookies?: CookieInfo[];
  viewport: ViewportInfo;
}

export interface NetworkEntry {
  url: string;
  method: string;
  status: number;
  timestamp: number;
}

export interface CookieInfo {
  name: string;
  value: string;
  domain: string;
  path?: string;
}

export interface ViewportInfo {
  width: number;
  height: number;
  devicePixelRatio: number;
  scrollX: number;
  scrollY: number;
}

export interface ActResponse {
  success: boolean;
  actionsCompleted: number;
  actionsTotal: number;
  error?: string;
  results: ActionResult[];
}

export interface ActionResult {
  actionIndex: number;
  success: boolean;
  message?: string;
  elementFound?: boolean;
}

export interface NavResponse {
  success: boolean;
  url: string;
  title: string;
  navigationTimeMs: number;
  error?: string;
}

export interface ExtractResponse {
  results: Record<string, ExtractResult>;
  extractionTimeMs: number;
}

export interface ExtractResult {
  queryType: string;
  success: boolean;
  data?: unknown;
  error?: string;
  count: number;
}

export interface ScreenshotResponse {
  success: boolean;
  format: string;
  width: number;
  height: number;
  data: string; // base64
  error?: string;
}

export interface WaitResponse {
  success: boolean;
  conditionMet?: string;
  waitTimeMs: number;
  error?: string;
}
