/**
 * Allternit Extension MCP Module
 * 
 * Provides browser automation through the Allternit Computer Use service.
 * This integrates with the Allternit Chrome Extension and Computer Use gateway.
 * 
 * Architecture:
 *   GIZZI -> Allternit Extension -> Computer Use Gateway -> Chrome Extension
 * 
 * Unlike Anthropic's claude-for-chrome-mcp, this uses the Allternit Computer Use
 * service which supports multiple adapters (Playwright, browser-use, CDP, desktop).
 */

import { homedir, platform, tmpdir, userInfo } from 'os';
import { join, resolve } from 'path';
import { stat, readFile, mkdir, writeFile, access } from 'fs/promises';
import { constants } from 'fs';

// ============================================================================
// Type Definitions
// ============================================================================

export type AllternitExtensionTool = 
  | 'browser_navigate'
  | 'browser_click'
  | 'browser_type'
  | 'browser_screenshot'
  | 'browser_get_content'
  | 'browser_find_element'
  | 'browser_evaluate'
  | 'browser_get_tabs'
  | 'browser_switch_tab'
  | 'browser_close_tab'
  | 'browser_go_back'
  | 'browser_go_forward'
  | 'browser_reload'
  | 'browser_scroll'
  | 'browser_wait'
  | 'browser_execute'  // Allternit-specific: LLM-powered automation
  | 'browser_extract'  // Allternit-specific: structured data extraction
  | 'browser_inspect'; // Allternit-specific: page structure analysis

export type ChromiumBrowser = 
  | 'chrome'
  | 'brave'
  | 'arc'
  | 'chromium'
  | 'edge'
  | 'vivaldi'
  | 'opera';

export type Platform = 'macos' | 'linux' | 'wsl' | 'windows';

export interface BrowserConfig {
  name: string;
  macos: {
    appName: string;
    dataPath: string[];
    nativeMessagingPath: string[];
  };
  linux: {
    binaries: string[];
    dataPath: string[];
    nativeMessagingPath: string[];
  };
  windows: {
    dataPath: string[];
    registryKey: string;
    useRoaming?: boolean;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ComputerUseConfig {
  gatewayUrl: string;
  token?: string;
  adapterPreference?: 'browser' | 'desktop' | 'hybrid';
  autoStart?: boolean;
}

export interface ExtensionConfig {
  extensionId: string;
  nativeHostName: string;
  enabled: boolean;
}

export interface BrowserTab {
  id: number;
  url: string;
  title: string;
  active: boolean;
}

export interface BrowserElement {
  tagName: string;
  text?: string;
  attributes: Record<string, string>;
  selector: string;
}

// ============================================================================
// Constants
// ============================================================================

export const ALLTERNIT_EXTENSION_MCP_SERVER_NAME = 'allternit-extension';

export const DEFAULT_EXTENSION_ID = 'fcoeoabgfenejglbffodgkkbkcdhcgfn';
export const DEV_EXTENSION_ID = 'dihbgbndebgnbjfmelmegjepbnkhlgni';
export const ANT_EXTENSION_ID = 'dngcpimnedloihjnnfngkgjoidhnaolf';

export const NATIVE_HOST_IDENTIFIER = 'com.allternit.gizzi_browser_extension';

// ============================================================================
// Platform Detection
// ============================================================================

function getPlatform(): Platform {
  const plat = platform();
  if (plat === 'darwin') return 'macos';
  if (plat === 'win32') return 'windows';
  if (plat === 'linux') {
    try {
      const { readFileSync } = require('fs');
      const release = readFileSync('/proc/version', 'utf8');
      if (release.toLowerCase().includes('microsoft')) {
        return 'wsl';
      }
    } catch {}
    return 'linux';
  }
  return 'linux';
}

// ============================================================================
// Browser Configuration
// ============================================================================

export const CHROMIUM_BROWSERS: Record<ChromiumBrowser, BrowserConfig> = {
  chrome: {
    name: 'Google Chrome',
    macos: {
      appName: 'Google Chrome',
      dataPath: ['Library', 'Application Support', 'Google', 'Chrome'],
      nativeMessagingPath: [
        'Library',
        'Application Support',
        'Google',
        'Chrome',
        'NativeMessagingHosts',
      ],
    },
    linux: {
      binaries: ['google-chrome', 'google-chrome-stable'],
      dataPath: ['.config', 'google-chrome'],
      nativeMessagingPath: ['.config', 'google-chrome', 'NativeMessagingHosts'],
    },
    windows: {
      dataPath: ['Google', 'Chrome', 'User Data'],
      registryKey: 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts',
    },
  },
  brave: {
    name: 'Brave',
    macos: {
      appName: 'Brave Browser',
      dataPath: [
        'Library',
        'Application Support',
        'BraveSoftware',
        'Brave-Browser',
      ],
      nativeMessagingPath: [
        'Library',
        'Application Support',
        'BraveSoftware',
        'Brave-Browser',
        'NativeMessagingHosts',
      ],
    },
    linux: {
      binaries: ['brave-browser', 'brave'],
      dataPath: ['.config', 'BraveSoftware', 'Brave-Browser'],
      nativeMessagingPath: [
        '.config',
        'BraveSoftware',
        'Brave-Browser',
        'NativeMessagingHosts',
      ],
    },
    windows: {
      dataPath: ['BraveSoftware', 'Brave-Browser', 'User Data'],
      registryKey:
        'HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts',
    },
  },
  arc: {
    name: 'Arc',
    macos: {
      appName: 'Arc',
      dataPath: ['Library', 'Application Support', 'Arc', 'User Data'],
      nativeMessagingPath: [
        'Library',
        'Application Support',
        'Arc',
        'User Data',
        'NativeMessagingHosts',
      ],
    },
    linux: {
      binaries: [],
      dataPath: [],
      nativeMessagingPath: [],
    },
    windows: {
      dataPath: ['Arc', 'User Data'],
      registryKey: 'HKCU\\Software\\ArcBrowser\\Arc\\NativeMessagingHosts',
    },
  },
  chromium: {
    name: 'Chromium',
    macos: {
      appName: 'Chromium',
      dataPath: ['Library', 'Application Support', 'Chromium'],
      nativeMessagingPath: [
        'Library',
        'Application Support',
        'Chromium',
        'NativeMessagingHosts',
      ],
    },
    linux: {
      binaries: ['chromium', 'chromium-browser'],
      dataPath: ['.config', 'chromium'],
      nativeMessagingPath: ['.config', 'chromium', 'NativeMessagingHosts'],
    },
    windows: {
      dataPath: ['Chromium', 'User Data'],
      registryKey: 'HKCU\\Software\\Chromium\\NativeMessagingHosts',
    },
  },
  edge: {
    name: 'Microsoft Edge',
    macos: {
      appName: 'Microsoft Edge',
      dataPath: ['Library', 'Application Support', 'Microsoft Edge'],
      nativeMessagingPath: [
        'Library',
        'Application Support',
        'Microsoft Edge',
        'NativeMessagingHosts',
      ],
    },
    linux: {
      binaries: ['microsoft-edge', 'microsoft-edge-stable'],
      dataPath: ['.config', 'microsoft-edge'],
      nativeMessagingPath: [
        '.config',
        'microsoft-edge',
        'NativeMessagingHosts',
      ],
    },
    windows: {
      dataPath: ['Microsoft', 'Edge', 'User Data'],
      registryKey: 'HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts',
    },
  },
  vivaldi: {
    name: 'Vivaldi',
    macos: {
      appName: 'Vivaldi',
      dataPath: ['Library', 'Application Support', 'Vivaldi'],
      nativeMessagingPath: [
        'Library',
        'Application Support',
        'Vivaldi',
        'NativeMessagingHosts',
      ],
    },
    linux: {
      binaries: ['vivaldi', 'vivaldi-stable'],
      dataPath: ['.config', 'vivaldi'],
      nativeMessagingPath: ['.config', 'vivaldi', 'NativeMessagingHosts'],
    },
    windows: {
      dataPath: ['Vivaldi', 'User Data'],
      registryKey: 'HKCU\\Software\\Vivaldi\\NativeMessagingHosts',
    },
  },
  opera: {
    name: 'Opera',
    macos: {
      appName: 'Opera',
      dataPath: ['Library', 'Application Support', 'com.operasoftware.Opera'],
      nativeMessagingPath: [
        'Library',
        'Application Support',
        'com.operasoftware.Opera',
        'NativeMessagingHosts',
      ],
    },
    linux: {
      binaries: ['opera'],
      dataPath: ['.config', 'opera'],
      nativeMessagingPath: ['.config', 'opera', 'NativeMessagingHosts'],
    },
    windows: {
      dataPath: ['Opera Software', 'Opera Stable'],
      registryKey:
        'HKCU\\Software\\Opera Software\\Opera Stable\\NativeMessagingHosts',
      useRoaming: true,
    },
  },
};

export const BROWSER_DETECTION_ORDER: ChromiumBrowser[] = [
  'chrome',
  'brave',
  'arc',
  'edge',
  'chromium',
  'vivaldi',
  'opera',
];

// ============================================================================
// Browser Detection
// ============================================================================

export async function detectAvailableBrowser(): Promise<ChromiumBrowser | null> {
  const plat = getPlatform();

  for (const browserId of BROWSER_DETECTION_ORDER) {
    const config = CHROMIUM_BROWSERS[browserId];

    switch (plat) {
      case 'macos': {
        const appPath = `/Applications/${config.macos.appName}.app`;
        try {
          const stats = await stat(appPath);
          if (stats.isDirectory()) {
            return browserId;
          }
        } catch {}
        break;
      }
      case 'wsl':
      case 'linux': {
        for (const binary of config.linux.binaries) {
          if (await which(binary).catch(() => null)) {
            return browserId;
          }
        }
        break;
      }
      case 'windows': {
        const home = homedir();
        if (config.windows.dataPath.length > 0) {
          const appDataBase = config.windows.useRoaming
            ? join(home, 'AppData', 'Roaming')
            : join(home, 'AppData', 'Local');
          const dataPath = join(appDataBase, ...config.windows.dataPath);
          try {
            const stats = await stat(dataPath);
            if (stats.isDirectory()) {
              return browserId;
            }
          } catch {}
        }
        break;
      }
    }
  }

  return null;
}

async function which(command: string): Promise<string> {
  const { execFile } = require('child_process');
  const { promisify } = require('util');
  const execFileAsync = promisify(execFile);
  
  try {
    const { stdout } = await execFileAsync('which', [command]);
    return stdout.trim();
  } catch {
    throw new Error(`Command not found: ${command}`);
  }
}

// ============================================================================
// Extension Detection
// ============================================================================

const MAX_TRACKED_TABS = 200;
const trackedTabIds = new Set<number>();

export function trackAllternitExtensionTabId(tabId: number): void {
  if (trackedTabIds.size >= MAX_TRACKED_TABS && !trackedTabIds.has(tabId)) {
    trackedTabIds.clear();
  }
  trackedTabIds.add(tabId);
}

export function isTrackedAllternitExtensionTabId(tabId: number): boolean {
  return trackedTabIds.has(tabId);
}

export async function isAllternitExtensionInstalled(): Promise<boolean> {
  const browserPaths = getAllBrowserDataPaths();
  
  for (const { path } of browserPaths) {
    try {
      const extensionDir = join(path, 'Default', 'Extensions');
      const entries = await readDirSafe(extensionDir);
      
      const knownExtensionIds = [
        DEFAULT_EXTENSION_ID,
        ...(process.env.USER_TYPE === 'ant' || process.env.DEBUG ? [DEV_EXTENSION_ID, ANT_EXTENSION_ID] : []),
      ];
      
      for (const id of knownExtensionIds) {
        if (entries.includes(id)) {
          return true;
        }
      }
    } catch {}
  }
  
  return false;
}

async function readDirSafe(path: string): Promise<string[]> {
  try {
    const { readdir } = require('fs/promises');
    return await readdir(path);
  } catch {
    return [];
  }
}

// ============================================================================
// Browser Paths
// ============================================================================

export function getAllBrowserDataPaths(): Array<{ browser: ChromiumBrowser; path: string }> {
  const plat = getPlatform();
  const home = homedir();
  const paths: Array<{ browser: ChromiumBrowser; path: string }> = [];

  for (const browserId of BROWSER_DETECTION_ORDER) {
    const config = CHROMIUM_BROWSERS[browserId];
    let dataPath: string[] | undefined;

    switch (plat) {
      case 'macos':
        dataPath = config.macos.dataPath;
        break;
      case 'linux':
      case 'wsl':
        dataPath = config.linux.dataPath;
        break;
      case 'windows': {
        if (config.windows.dataPath.length > 0) {
          const appDataBase = config.windows.useRoaming
            ? join(home, 'AppData', 'Roaming')
            : join(home, 'AppData', 'Local');
          paths.push({
            browser: browserId,
            path: join(appDataBase, ...config.windows.dataPath),
          });
        }
        continue;
      }
    }

    if (dataPath && dataPath.length > 0) {
      paths.push({
        browser: browserId,
        path: join(home, ...dataPath),
      });
    }
  }

  return paths;
}

export function getAllNativeMessagingHostsDirs(): Array<{ browser: ChromiumBrowser; path: string }> {
  const plat = getPlatform();
  const home = homedir();
  const paths: Array<{ browser: ChromiumBrowser; path: string }> = [];

  for (const browserId of BROWSER_DETECTION_ORDER) {
    const config = CHROMIUM_BROWSERS[browserId];

    switch (plat) {
      case 'macos':
        if (config.macos.nativeMessagingPath.length > 0) {
          paths.push({
            browser: browserId,
            path: join(home, ...config.macos.nativeMessagingPath),
          });
        }
        break;
      case 'linux':
      case 'wsl':
        if (config.linux.nativeMessagingPath.length > 0) {
          paths.push({
            browser: browserId,
            path: join(home, ...config.linux.nativeMessagingPath),
          });
        }
        break;
      case 'windows':
        break;
    }
  }

  return paths;
}

export function getAllWindowsRegistryKeys(): Array<{ browser: ChromiumBrowser; key: string }> {
  const keys: Array<{ browser: ChromiumBrowser; key: string }> = [];

  for (const browserId of BROWSER_DETECTION_ORDER) {
    const config = CHROMIUM_BROWSERS[browserId];
    if (config.windows.registryKey) {
      keys.push({
        browser: browserId,
        key: config.windows.registryKey,
      });
    }
  }

  return keys;
}

// ============================================================================
// Computer Use Gateway
// ============================================================================

export function getComputerUseGatewayUrl(): string {
  return process.env.ALLTERNIT_COMPUTER_USE_URL || 'http://localhost:3010';
}

export function getComputerUseToken(): string | undefined {
  return process.env.ALLTERNIT_COMPUTER_USE_TOKEN || process.env.ALLTERNIT_OPERATOR_API_KEY;
}

export async function checkComputerUseGatewayHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${getComputerUseGatewayUrl()}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// MCP Tool Definitions (Allternit Computer Use)
// ============================================================================

export const BROWSER_TOOLS: MCPTool[] = [
  {
    name: 'browser_navigate',
    description: 'Navigate the browser to a URL using the Allternit Computer Use service',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to navigate to',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'browser_click',
    description: 'Click an element on the page',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the element to click',
        },
        x: {
          type: 'number',
          description: 'X coordinate (alternative to selector)',
        },
        y: {
          type: 'number',
          description: 'Y coordinate (alternative to selector)',
        },
      },
      required: [],
    },
  },
  {
    name: 'browser_type',
    description: 'Type text into an input field',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the input field',
        },
        text: {
          type: 'string',
          description: 'Text to type',
        },
        clear: {
          type: 'boolean',
          description: 'Whether to clear the field first',
          default: true,
        },
      },
      required: ['selector', 'text'],
    },
  },
  {
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current page',
    inputSchema: {
      type: 'object',
      properties: {
        fullPage: {
          type: 'boolean',
          description: 'Whether to capture the full page',
          default: false,
        },
        selector: {
          type: 'string',
          description: 'CSS selector for a specific element to capture',
        },
      },
      required: [],
    },
  },
  {
    name: 'browser_get_content',
    description: 'Get the text content of the page',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector to get content from (default: body)',
          default: 'body',
        },
      },
      required: [],
    },
  },
  {
    name: 'browser_find_element',
    description: 'Find elements matching a selector',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector to search for',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of elements to return',
          default: 10,
        },
      },
      required: ['selector'],
    },
  },
  {
    name: 'browser_evaluate',
    description: 'Execute JavaScript in the browser context',
    inputSchema: {
      type: 'object',
      properties: {
        script: {
          type: 'string',
          description: 'JavaScript code to execute',
        },
        args: {
          type: 'array',
          description: 'Arguments to pass to the script',
          default: [],
        },
      },
      required: ['script'],
    },
  },
  {
    name: 'browser_get_tabs',
    description: 'Get list of open tabs',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'browser_switch_tab',
    description: 'Switch to a different tab',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'The ID of the tab to switch to',
        },
        index: {
          type: 'number',
          description: 'The index of the tab to switch to (alternative to tabId)',
        },
      },
      required: [],
    },
  },
  {
    name: 'browser_close_tab',
    description: 'Close a tab',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'The ID of the tab to close',
        },
      },
      required: [],
    },
  },
  {
    name: 'browser_go_back',
    description: 'Navigate back in browser history',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'browser_go_forward',
    description: 'Navigate forward in browser history',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'browser_reload',
    description: 'Reload the current page',
    inputSchema: {
      type: 'object',
      properties: {
        ignoreCache: {
          type: 'boolean',
          description: 'Whether to bypass cache',
          default: false,
        },
      },
      required: [],
    },
  },
  {
    name: 'browser_scroll',
    description: 'Scroll the page',
    inputSchema: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description: 'Pixels to scroll horizontally',
          default: 0,
        },
        y: {
          type: 'number',
          description: 'Pixels to scroll vertically',
          default: 0,
        },
        selector: {
          type: 'string',
          description: 'Element to scroll into view',
        },
      },
      required: [],
    },
  },
  {
    name: 'browser_wait',
    description: 'Wait for a condition or duration',
    inputSchema: {
      type: 'object',
      properties: {
        duration: {
          type: 'number',
          description: 'Time to wait in milliseconds',
        },
        selector: {
          type: 'string',
          description: 'Wait for element to appear',
        },
        state: {
          type: 'string',
          enum: ['visible', 'hidden', 'attached', 'detached'],
          description: 'State to wait for',
        },
        timeout: {
          type: 'number',
          description: 'Maximum time to wait in milliseconds',
          default: 5000,
        },
      },
      required: [],
    },
  },
  // Allternit-specific tools
  {
    name: 'browser_execute',
    description: 'Execute an LLM-powered browser automation task via the Allternit Computer Use service',
    inputSchema: {
      type: 'object',
      properties: {
        goal: {
          type: 'string',
          description: 'The high-level goal to accomplish (e.g., "Book a flight from NYC to London")',
        },
        target: {
          type: 'string',
          description: 'The starting URL or scope',
        },
        target_scope: {
          type: 'string',
          enum: ['browser', 'desktop', 'hybrid'],
          description: 'Whether to use browser automation, desktop automation, or hybrid',
          default: 'browser',
        },
        mode: {
          type: 'string',
          enum: ['assist', 'execute', 'inspect', 'parallel', 'crawl'],
          description: 'Execution mode: assist (asks for confirmation), execute (autonomous), inspect (read-only), parallel (multiple tasks), crawl (systematic exploration)',
          default: 'execute',
        },
      },
      required: ['goal'],
    },
  },
  {
    name: 'browser_extract',
    description: 'Extract structured data from the current page using the Allternit Computer Use service',
    inputSchema: {
      type: 'object',
      properties: {
        schema: {
          type: 'object',
          description: 'JSON schema describing the data to extract',
        },
        prompt: {
          type: 'string',
          description: 'Natural language description of what to extract',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'browser_inspect',
    description: 'Get detailed page structure and accessibility information',
    inputSchema: {
      type: 'object',
      properties: {
        includeAccessibility: {
          type: 'boolean',
          description: 'Include accessibility tree information',
          default: true,
        },
        includeStyles: {
          type: 'boolean',
          description: 'Include computed styles',
          default: false,
        },
      },
      required: [],
    },
  },
];

// ============================================================================
// Native Host Configuration
// ============================================================================

export interface NativeHostManifest {
  name: string;
  description: string;
  path: string;
  type: 'stdio';
  allowed_origins: string[];
}

export function generateNativeHostManifest(binaryPath: string): NativeHostManifest {
  const extensionIds = [
    `chrome-extension://${DEFAULT_EXTENSION_ID}/`,
  ];
  
  if (process.env.USER_TYPE === 'ant' || process.env.DEBUG) {
    extensionIds.push(
      `chrome-extension://${DEV_EXTENSION_ID}/`,
      `chrome-extension://${ANT_EXTENSION_ID}/`
    );
  }
  
  return {
    name: NATIVE_HOST_IDENTIFIER,
    description: 'Allternit GIZZI Browser Extension Native Host',
    path: binaryPath,
    type: 'stdio',
    allowed_origins: extensionIds,
  };
}

// ============================================================================
// Browser Control
// ============================================================================

export async function openInBrowser(url: string): Promise<boolean> {
  const plat = getPlatform();
  const browser = await detectAvailableBrowser();

  if (!browser) {
    return false;
  }

  const config = CHROMIUM_BROWSERS[browser];

  try {
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);

    switch (plat) {
      case 'macos': {
        await execFileAsync('open', ['-a', config.macos.appName, url]);
        return true;
      }
      case 'windows': {
        await execFileAsync('rundll32', ['url,OpenURL', url]);
        return true;
      }
      case 'wsl':
      case 'linux': {
        for (const binary of config.linux.binaries) {
          try {
            await execFileAsync(binary, [url]);
            return true;
          } catch {}
        }
        return false;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}

// ============================================================================
// Socket Utilities
// ============================================================================

function getUsername(): string {
  try {
    return userInfo().username || 'default';
  } catch {
    return process.env.USER || process.env.USERNAME || 'default';
  }
}

export function getSocketDir(): string {
  return `/tmp/allternit-extension-bridge-${getUsername()}`;
}

export function getSocketName(): string {
  return `allternit-extension-bridge-${getUsername()}`;
}

export function getSecureSocketPath(): string {
  if (platform() === 'win32') {
    return `\\\\.\\pipe\\${getSocketName()}`;
  }
  return join(getSocketDir(), `${process.pid}.sock`);
}

// ============================================================================
// Tool Name Normalization
// ============================================================================

export function normalizeNameForMCP(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function isAllternitExtensionMCPServer(name: string): boolean {
  return normalizeNameForMCP(name) === ALLTERNIT_EXTENSION_MCP_SERVER_NAME;
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  ALLTERNIT_EXTENSION_MCP_SERVER_NAME,
  DEFAULT_EXTENSION_ID,
  DEV_EXTENSION_ID,
  ANT_EXTENSION_ID,
  NATIVE_HOST_IDENTIFIER,
  CHROMIUM_BROWSERS,
  BROWSER_DETECTION_ORDER,
  BROWSER_TOOLS,
  detectAvailableBrowser,
  isAllternitExtensionInstalled,
  trackAllternitExtensionTabId,
  isTrackedAllternitExtensionTabId,
  getAllBrowserDataPaths,
  getAllNativeMessagingHostsDirs,
  getAllWindowsRegistryKeys,
  getComputerUseGatewayUrl,
  getComputerUseToken,
  checkComputerUseGatewayHealth,
  generateNativeHostManifest,
  openInBrowser,
  getSocketDir,
  getSocketName,
  getSecureSocketPath,
  normalizeNameForMCP,
  isAllternitExtensionMCPServer,
};
