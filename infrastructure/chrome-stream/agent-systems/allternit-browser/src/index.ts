/**
 * Allternit Browser Module
 * 
 * Complete browser automation and canvas hosting system.
 * Ported from OpenClaw architecture.
 * 
 * @module @allternit/browser
 */

// Types
export * from './types/index.js';

// Browser Server
export {
  startBrowserServer,
  stopBrowserServer,
  getBrowserState,
} from './browser/server.js';
export { createBrowserRouteContext } from './browser/server-context.js';

// Browser Routes
export { registerBrowserRoutes } from './browser/routes/index.js';
export { registerBrowserBasicRoutes } from './browser/routes/basic.js';
export { registerBrowserTabRoutes } from './browser/routes/tabs.js';
export { registerBrowserAgentRoutes } from './browser/routes/agent.js';

// CDP (Chrome DevTools Protocol)
export { CDPClient } from './browser/cdp/client.js';
export {
  getTabs,
  openTab,
  focusTab,
  closeTab,
  getTabAction,
} from './browser/cdp/tabs.js';
export {
  captureScreenshot,
  normalizeScreenshot,
} from './browser/cdp/screenshot.js';
export {
  snapshotAria,
  snapshotAi,
  snapshotRole,
} from './browser/cdp/snapshot.js';

// Playwright Integration
export {
  launchBrowser,
  connectViaCDP,
} from './browser/playwright/launcher.js';
export {
  clickViaPlaywright,
  typeViaPlaywright,
  navigateViaPlaywright,
  takeScreenshotViaPlaywright,
  hoverViaPlaywright,
  pressKeyViaPlaywright,
  evaluateViaPlaywright,
  waitForViaPlaywright,
} from './browser/playwright/actions.js';
export {
  snapshotAiViaPlaywright,
  snapshotRoleViaPlaywright,
  snapshotAriaViaPlaywright,
} from './browser/playwright/snapshot.js';
export { pdfViaPlaywright } from './browser/playwright/pdf.js';

// Canvas Host
export {
  A2UI_PATH,
  CANVAS_HOST_PATH,
  CANVAS_WS_PATH,
  handleA2uiHttpRequest,
  injectCanvasLiveReload,
} from './canvas-host/a2ui.js';
export {
  createCanvasHostHandler,
  startCanvasHost,
} from './canvas-host/server.js';

// Version
export const VERSION = '0.1.0';
