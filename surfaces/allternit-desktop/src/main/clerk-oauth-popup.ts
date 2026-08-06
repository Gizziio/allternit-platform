import { BrowserWindow } from 'electron';
import log from 'electron-log';

const OAUTH_POPUP_WIDTH = 480;
const OAUTH_POPUP_HEIGHT = 640;
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

const OAUTH_PROVIDER_HOSTS = new Set([
  'accounts.google.com',
  'github.com',
  'api.github.com',
]);

function isOAuthProviderUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return OAUTH_PROVIDER_HOSTS.has(parsed.hostname) || parsed.hostname.endsWith('.google.com');
  } catch {
    return false;
  }
}

function isClerkCallbackUrl(url: string, callbackOrigin: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === callbackOrigin && parsed.pathname.startsWith('/sign-in/sso_callback');
  } catch {
    return false;
  }
}

/**
 * Opens a modal OAuth popup window and waits for the Clerk SSO callback.
 *
 * @param startUrl The OAuth provider URL that Clerk wants to navigate to.
 * @param callbackHostnames Hostnames that are considered Clerk callbacks (e.g.
 *   `["clerk.example.com", "accounts.clerk.dev"]`). If empty, any URL whose
 *   path starts with `/sign-in/sso_callback` is treated as a callback.
 * @returns The callback URL that Clerk should complete.
 */
export function openClerkOAuthPopup(startUrl: string, callbackHostnames?: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isOAuthProviderUrl(startUrl)) {
      reject(new Error('Refusing to open non-OAuth URL in auth popup'));
      return;
    }

    const popup = new BrowserWindow({
      width: OAUTH_POPUP_WIDTH,
      height: OAUTH_POPUP_HEIGHT,
      show: true,
      modal: true,
      parent: BrowserWindow.getFocusedWindow() || undefined,
      title: 'Allternit — Sign in',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const timeout = setTimeout(() => {
      if (!popup.isDestroyed()) popup.destroy();
      reject(new Error('OAuth sign-in timed out. Please try again.'));
    }, OAUTH_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timeout);
      if (!popup.isDestroyed()) popup.destroy();
    }

    function isCallbackUrl(url: string): boolean {
      try {
        const parsed = new URL(url);
        const pathMatches = parsed.pathname.startsWith('/sign-in/sso_callback') ||
          parsed.pathname.startsWith('/sign-up/sso_callback') ||
          parsed.pathname.startsWith('/oauth_callback');
        if (!callbackHostnames || callbackHostnames.length === 0) return pathMatches;
        return pathMatches && callbackHostnames.includes(parsed.hostname);
      } catch {
        return false;
      }
    }

    popup.webContents.on('will-redirect', (_event, url) => {
      log.info('[OAuthPopup] will-redirect:', url);
      if (isCallbackUrl(url)) {
        cleanup();
        resolve(url);
      }
    });

    popup.webContents.on('did-navigate', (_event, url) => {
      log.info('[OAuthPopup] did-navigate:', url);
      if (isCallbackUrl(url)) {
        cleanup();
        resolve(url);
      }
    });

    popup.on('closed', () => {
      clearTimeout(timeout);
      reject(new Error('Sign-in window was closed before completing.'));
    });

    popup.loadURL(startUrl).catch((err) => {
      log.error('[OAuthPopup] Failed to load OAuth URL:', err);
      cleanup();
      reject(err);
    });
  });
}
