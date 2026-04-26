/**
 * Allternit Gateway Commands
 * 
 * Gateway commands for canvas and browser control.
 */

// Canvas Commands
export {
  createCanvasCommands,
  CANVAS_COMMANDS,
  type CanvasPresentParams,
  type CanvasNavigateParams,
  type CanvasEvalParams,
  type CanvasSnapshotParams,
  type CanvasA2UIPushParams,
  type CanvasCommandContext,
} from './canvas.js';

// Browser Commands
export {
  createBrowserCommands,
  BROWSER_COMMANDS,
  type BrowserProxyParams,
  type BrowserCommandContext,
} from './browser.js';
