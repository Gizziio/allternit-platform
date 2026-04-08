/**
 * Browser Tools Package
 * 
 * Browser automation toolkit for A2R agent task execution.
 * Provides type-safe browser control, DOM extraction, and action execution.
 * 
 * @example
 * ```typescript
 * import { 
 *   createSession, 
 *   navigate, 
 *   takeScreenshot,
 *   quarantineManager 
 * } from '@allternit/browser-tools';
 * 
 * // Create isolated browser session
 * const session = await createSession({
 *   viewport: { width: 1280, height: 720 },
 *   headless: true
 * });
 * 
 * // Navigate with safety checks
 * const result = await navigate(session.id, {
 *   url: 'https://example.com'
 * });
 * 
 * // Take screenshot
 * const screenshot = await takeScreenshot(session.id, {
 *   fullPage: true
 * });
 * ```
 */

// Types
export * from './types/index.js';

// Tools - Browser Control
export {
  createSession,
  closeSession,
  getSessionInfo,
  navigate,
  goBack,
  goForward,
  reload,
  takeScreenshot,
  setViewport,
  browserControlTools,
} from './tools/browser_control.js';

// Tools - DOM Extraction
export {
  extractContent,
  findElement,
  domExtractionTools,
} from './tools/dom_extraction.js';

// Tools - Actions
export {
  click,
  type,
  clear,
  select,
  scroll,
  hover,
  press,
  wait,
  actionTools,
} from './tools/action_tools.js';

// Playwright Driver
export {
  sessionRegistry,
  navigateWithPlaywright,
  takeScreenshotWithPlaywright,
} from './playwright/driver.js';

// Event Stream
export {
  eventStreamManager,
  sseEventStream,
  DEFAULT_STREAM_CONFIG,
} from './playwright/event-stream.js';

// Safety & Quarantine
export {
  DEFAULT_SAFETY_POLICY,
  STRICT_SAFETY_POLICY,
  checkNavigationSafety,
  checkActionSafety,
  quarantineManager,
  approvalQueue,
  QuarantineManager,
  ApprovalQueue,
} from './safety/quarantine.js';

// Version
export const VERSION = '0.1.0';
