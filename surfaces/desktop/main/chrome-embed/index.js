/**
 * Chrome Embed Module
 *
 * Manages an external Chrome/Chromium window positioned alongside the Electron
 * shell so that browsing happens in a real Chrome instance rather than a webview.
 *
 * On macOS this uses `open -a "Google Chrome"` with remote-debugging flags so
 * we can drive the window via CDP. The Chrome window is resized/repositioned
 * whenever the Electron main window moves or resizes.
 */

const { exec, spawn } = require('child_process');
const path = require('path');

let chromeProcess = null;
let chromeDebugPort = 9222;
let isChromeLaunched = false;

/**
 * Launch a real Chrome window alongside the Electron host window.
 *
 * @param {string} url - The initial URL to open.
 * @param {Electron.BrowserWindow} hostWindow - The Electron host window.
 * @returns {Promise<{pid: number, debugPort: number}>}
 */
async function launchChromeApp(url, hostWindow) {
  if (isChromeLaunched) {
    await navigateChrome(url);
    return { pid: chromeProcess?.pid ?? 0, debugPort: chromeDebugPort };
  }

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const userDataDir = path.join(
    require('os').homedir(),
    '.a2r',
    'chrome-embed-profile',
  );

  const args = [
    `--remote-debugging-port=${chromeDebugPort}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-default-apps',
    url || 'about:blank',
  ];

  return new Promise((resolve, reject) => {
    try {
      chromeProcess = spawn(chromePath, args, {
        detached: true,
        stdio: 'ignore',
      });

      chromeProcess.unref();
      isChromeLaunched = true;

      // Give Chrome a moment to start
      setTimeout(() => {
        if (hostWindow && !hostWindow.isDestroyed()) {
          resizeChrome(hostWindow);
        }
        resolve({ pid: chromeProcess.pid, debugPort: chromeDebugPort });
      }, 1500);

      chromeProcess.on('exit', () => {
        isChromeLaunched = false;
        chromeProcess = null;
      });
    } catch (err) {
      console.error('[Chrome Embed] Failed to spawn Chrome:', err.message);
      reject(err);
    }
  });
}

/**
 * Navigate the embedded Chrome window to a new URL via CDP.
 *
 * @param {string} url - Target URL.
 */
async function navigateChrome(url) {
  if (!isChromeLaunched) {
    console.warn('[Chrome Embed] Chrome not launched, cannot navigate');
    return;
  }

  try {
    // Use CDP to navigate
    const listRes = await fetch(`http://127.0.0.1:${chromeDebugPort}/json`);
    const targets = await listRes.json();
    const page = targets.find((t) => t.type === 'page');
    if (!page) {
      console.warn('[Chrome Embed] No page target found');
      return;
    }

    // Send navigate command via CDP HTTP endpoint
    await fetch(
      `http://127.0.0.1:${chromeDebugPort}/json/navigate?${page.id}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      },
    );
  } catch (err) {
    console.error('[Chrome Embed] Navigate failed:', err.message);
  }
}

/**
 * Reposition/resize the Chrome window to sit beside the Electron host window.
 *
 * @param {Electron.BrowserWindow} hostWindow
 */
function resizeChrome(hostWindow) {
  if (!isChromeLaunched || !hostWindow || hostWindow.isDestroyed()) return;

  // On macOS we use AppleScript to reposition Google Chrome
  const bounds = hostWindow.getBounds();
  const chromeX = bounds.x + bounds.width;
  const chromeY = bounds.y;
  const chromeW = 800;
  const chromeH = bounds.height;

  const script = `
    tell application "Google Chrome"
      if (count of windows) > 0 then
        set bounds of front window to {${chromeX}, ${chromeY}, ${chromeX + chromeW}, ${chromeY + chromeH}}
      end if
    end tell
  `;

  exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err) => {
    if (err) {
      // Silently ignore — Chrome may not be focused or may not have windows
    }
  });
}

/**
 * Close the embedded Chrome instance.
 */
function closeChrome() {
  if (chromeProcess) {
    try {
      chromeProcess.kill('SIGTERM');
    } catch {
      // Already exited
    }
    chromeProcess = null;
  }
  isChromeLaunched = false;
}

module.exports = {
  launchChromeApp,
  navigateChrome,
  resizeChrome,
  closeChrome,
};
