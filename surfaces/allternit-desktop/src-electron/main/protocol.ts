/**
 * Protocol Handler
 *
 * Handles custom protocol (allternit://) and deep links.
 * Routes incoming URLs to appropriate handlers and window navigation.
 */

import { app, ipcMain } from 'electron';
import { getWindowManager } from './window-manager';

const PROTOCOL_SCHEME = 'allternit';

interface ParsedDeepLink {
  protocol: string;
  host: string;
  pathname: string;
  searchParams: URLSearchParams;
  hash: string;
}

interface DeepLinkRoute {
  pattern: RegExp;
  handler: (link: ParsedDeepLink) => void;
}

type DeepLinkHandler = (link: ParsedDeepLink) => void;

const routes: DeepLinkRoute[] = [];
const pendingUrls: string[] = [];
let isProtocolRegistered = false;

/**
 * Register the custom protocol
 */
export function registerProtocol(): void {
  if (isProtocolRegistered) {
    return;
  }

  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [
        process.argv[1],
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
  }

  isProtocolRegistered = true;
}

/**
 * Check if protocol is registered
 */
export function isProtocolHandlerRegistered(): boolean {
  return app.isDefaultProtocolClient(PROTOCOL_SCHEME);
}

/**
 * Unregister the custom protocol
 */
export function unregisterProtocol(): void {
  app.removeAsDefaultProtocolClient(PROTOCOL_SCHEME);
  isProtocolRegistered = false;
}

/**
 * Parse a deep link URL
 */
export function parseDeepLink(url: string): ParsedDeepLink | null {
  try {
    const parsed = new URL(url);

    return {
      protocol: parsed.protocol.replace(':', ''),
      host: parsed.host,
      pathname: parsed.pathname,
      searchParams: parsed.searchParams,
      hash: parsed.hash,
    };
  } catch {
    return null;
  }
}

/**
 * Register a route handler for deep links
 */
export function registerDeepLinkRoute(
  pattern: string | RegExp,
  handler: DeepLinkHandler
): () => void {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

  const route: DeepLinkRoute = { pattern: regex, handler };
  routes.push(route);

  return () => {
    const index = routes.indexOf(route);
    if (index > -1) {
      routes.splice(index, 1);
    }
  };
}

/**
 * Handle an incoming deep link URL
 */
export function handleDeepLink(url: string): boolean {
  const parsed = parseDeepLink(url);

  if (!parsed || parsed.protocol !== PROTOCOL_SCHEME) {
    return false;
  }

  const windowManager = getWindowManager();

  if (!windowManager) {
    pendingUrls.push(url);
    return true;
  }

  windowManager.focusMainWindow();

  for (const route of routes) {
    if (route.pattern.test(parsed.pathname)) {
      try {
        route.handler(parsed);
        return true;
      } catch (error) {
        console.error('Error handling deep link:', error);
        return false;
      }
    }
  }

  handleDefaultRoute(parsed);
  return true;
}

/**
 * Default route handler
 */
function handleDefaultRoute(link: ParsedDeepLink): void {
  const windowManager = getWindowManager();
  const mainWindow = windowManager?.getMainWindow();

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const path = link.pathname.replace(/^\//, '');
  const segments = path.split('/');

  if (segments.length >= 2) {
    const [mode, id] = segments;

    mainWindow.webContents.send('protocol:navigate', {
      mode,
      id,
      params: Object.fromEntries(link.searchParams),
      hash: link.hash,
    });
  } else if (segments.length === 1 && segments[0]) {
    mainWindow.webContents.send('protocol:switchMode', {
      mode: segments[0],
      params: Object.fromEntries(link.searchParams),
    });
  }
}

/**
 * Process pending URLs (called after window manager is ready)
 */
export function processPendingUrls(): void {
  while (pendingUrls.length > 0) {
    const url = pendingUrls.shift();
    if (url) {
      handleDeepLink(url);
    }
  }
}

/**
 * Get pending URLs
 */
export function getPendingUrls(): string[] {
  return [...pendingUrls];
}

/**
 * Clear pending URLs
 */
export function clearPendingUrls(): void {
  pendingUrls.length = 0;
}

/**
 * Setup protocol handlers for the app
 */
export function setupProtocolHandlers(): void {
  registerProtocol();

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  if (process.platform === 'win32') {
    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
      app.quit();
      return;
    }

    app.on('second-instance', (_, argv) => {
      const url = argv.find((arg) => arg.startsWith(`${PROTOCOL_SCHEME}://`));

      if (url) {
        handleDeepLink(url);
      } else {
        const windowManager = getWindowManager();
        windowManager?.focusMainWindow();
      }
    });

    const initialUrl = process.argv.find((arg) =>
      arg.startsWith(`${PROTOCOL_SCHEME}://`)
    );

    if (initialUrl) {
      pendingUrls.push(initialUrl);
    }
  }
}

/**
 * Register default deep link routes
 */
export function registerDefaultRoutes(): void {
  registerDeepLinkRoute(/^\/chat\/.+/, (link) => {
    const sessionId = link.pathname.replace('/chat/', '');
    const windowManager = getWindowManager();
    const mainWindow = windowManager?.getMainWindow();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('protocol:openChat', {
        sessionId,
        params: Object.fromEntries(link.searchParams),
      });
    }
  });

  registerDeepLinkRoute(/^\/workflow\/.+/, (link) => {
    const workflowId = link.pathname.replace('/workflow/', '');
    const windowManager = getWindowManager();
    const mainWindow = windowManager?.getMainWindow();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('protocol:openWorkflow', {
        workflowId,
        params: Object.fromEntries(link.searchParams),
      });
    }
  });

  registerDeepLinkRoute(/^\/thread\/.+/, (link) => {
    const threadId = link.pathname.replace('/thread/', '');
    const windowManager = getWindowManager();
    const mainWindow = windowManager?.getMainWindow();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('protocol:openThread', {
        threadId,
        params: Object.fromEntries(link.searchParams),
      });
    }
  });

  registerDeepLinkRoute(/^\/settings/, (link) => {
    const section = link.pathname.replace('/settings/', '') || 'general';
    const windowManager = getWindowManager();
    const mainWindow = windowManager?.getMainWindow();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('protocol:openSettings', {
        section,
        params: Object.fromEntries(link.searchParams),
      });
    }
  });
}

/**
 * Build a deep link URL
 */
export function buildDeepLink(
  path: string,
  params?: Record<string, string>
): string {
  const url = new URL(`${PROTOCOL_SCHEME}://${path}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return url.toString();
}

/**
 * Open a deep link (for testing)
 */
export function openDeepLink(url: string): boolean {
  return handleDeepLink(url);
}

/**
 * Register IPC handlers for protocol
 */
export function registerProtocolIpcHandlers(): void {
  ipcMain.handle('protocol:buildUrl', (_, path: string, params?: Record<string, string>) => {
    return buildDeepLink(path, params);
  });

  ipcMain.handle('protocol:open', (_, url: string) => {
    return handleDeepLink(url);
  });

  ipcMain.handle('protocol:isRegistered', () => {
    return isProtocolHandlerRegistered();
  });

  ipcMain.handle('protocol:parse', (_, url: string) => {
    return parseDeepLink(url);
  });
}

/**
 * Initialize protocol handling
 */
export function initializeProtocol(): void {
  setupProtocolHandlers();
  registerDefaultRoutes();
}
