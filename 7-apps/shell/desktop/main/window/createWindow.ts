/**
 * Window Creation Factory
 * 
 * Creates different types of windows with appropriate configurations.
 * Supports: main, settings, about, popout window types.
 * 
 * @module window/createWindow
 */

import { app, BrowserWindow, Rectangle } from 'electron';
import { join } from 'path';
import { windowManager } from './WindowManager';
import { getLastWindowState, getCenterPosition } from './window-state';

/** Window types supported by the factory */
export type WindowType = 'main' | 'settings' | 'about' | 'popout';

/** Options for creating a window */
export interface CreateWindowOptions {
  /** Type of window to create */
  type?: WindowType;
  /** URL to load in the window */
  url?: string;
  /** Parent window (for modal windows) */
  parent?: BrowserWindow;
  /** Whether window is modal */
  modal?: boolean;
  /** Initial window bounds */
  bounds?: Rectangle;
  /** Window title */
  title?: string;
  /** Whether to show window immediately */
  show?: boolean;
  /** Additional web preferences */
  webPreferences?: Electron.WebPreferences;
}

/** Default dimensions for different window types */
const DEFAULT_DIMENSIONS: Record<WindowType, { width: number; height: number; minWidth: number; minHeight: number }> = {
  main: { width: 1280, height: 850, minWidth: 800, minHeight: 600 },
  settings: { width: 800, height: 600, minWidth: 600, minHeight: 400 },
  about: { width: 400, height: 300, minWidth: 400, minHeight: 300 },
  popout: { width: 600, height: 400, minWidth: 400, minHeight: 300 },
};

/** Development server URL */
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5177';

/** Check if running in development mode */
const isDev = !app.isPackaged || !!process.env.VITE_DEV_SERVER_URL;

/**
 * Get the default URL for a window type
 * @param type - Window type
 * @param customUrl - Optional custom URL override
 * @returns URL string
 */
function getWindowUrl(type: WindowType, customUrl?: string): string {
  if (customUrl) return customUrl;

  switch (type) {
    case 'settings':
      return isDev ? `${DEV_URL}/settings` : `file://${join(__dirname, '../renderer/settings.html')}`;
    case 'about':
      return isDev ? `${DEV_URL}/about` : `file://${join(__dirname, '../renderer/about.html')}`;
    case 'popout':
      return isDev ? DEV_URL : `file://${join(__dirname, '../renderer/index.html')}`;
    case 'main':
    default:
      return isDev ? DEV_URL : `file://${join(__dirname, '../renderer/index.html')}`;
  }
}

/**
 * Create a window of the specified type
 * @param options - Window creation options
 * @returns Promise resolving to the created BrowserWindow
 */
export async function createWindow(options: CreateWindowOptions = {}): Promise<BrowserWindow> {
  const { type = 'main' } = options;

  switch (type) {
    case 'main':
      return createMainWindow(options);
    case 'settings':
      return createSettingsWindow(options);
    case 'about':
      return createAboutWindow(options);
    case 'popout':
      return createPopoutWindow(options);
    default:
      throw new Error(`Unknown window type: ${type}`);
  }
}

/**
 * Create a main application window
 */
async function createMainWindow(options: CreateWindowOptions): Promise<BrowserWindow> {
  const lastState = await getLastWindowState();
  const dims = DEFAULT_DIMENSIONS.main;

  return windowManager.createWindow({
    url: getWindowUrl('main', options.url),
    bounds: options.bounds || lastState.bounds,
    maximized: lastState.maximized,
    fullscreen: lastState.fullscreen,
    title: options.title || 'A2rchitect Shell',
    windowOptions: {
      minWidth: dims.minWidth,
      minHeight: dims.minHeight,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      trafficLightPosition: process.platform === 'darwin' ? { x: 24, y: 28 } : undefined,
      webPreferences: {
        contextIsolation: true,
        preload: join(__dirname, '../../preload/index.js'),
        webviewTag: true,
        allowRunningInsecureContent: isDev,
        ...options.webPreferences,
      },
    },
  });
}

/**
 * Create a settings window
 */
async function createSettingsWindow(options: CreateWindowOptions): Promise<BrowserWindow> {
  const dims = DEFAULT_DIMENSIONS.settings;
  const position = getCenterPosition(dims.width, dims.height);

  const window = new BrowserWindow({
    width: dims.width,
    height: dims.height,
    x: position.x,
    y: position.y,
    minWidth: dims.minWidth,
    minHeight: dims.minHeight,
    parent: options.parent,
    modal: options.modal ?? false,
    title: options.title || 'Settings',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    webPreferences: {
      contextIsolation: true,
      preload: join(__dirname, '../../preload/index.js'),
      ...options.webPreferences,
    },
  });

  const url = getWindowUrl('settings', options.url);
  await window.loadURL(url);

  window.once('ready-to-show', () => {
    window.show();
    window.focus();
  });

  return window;
}

/**
 * Create an about window
 */
async function createAboutWindow(options: CreateWindowOptions): Promise<BrowserWindow> {
  const dims = DEFAULT_DIMENSIONS.about;
  const position = getCenterPosition(dims.width, dims.height);

  const window = new BrowserWindow({
    width: dims.width,
    height: dims.height,
    x: position.x,
    y: position.y,
    minWidth: dims.minWidth,
    minHeight: dims.minHeight,
    maxWidth: dims.width,
    maxHeight: dims.height,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: options.title || 'About A2rchitect Shell',
    titleBarStyle: 'hidden',
    show: false,
    webPreferences: {
      contextIsolation: true,
      preload: join(__dirname, '../../preload/index.js'),
      ...options.webPreferences,
    },
  });

  const url = getWindowUrl('about', options.url);
  await window.loadURL(url);

  window.once('ready-to-show', () => {
    window.show();
  });

  return window;
}

/**
 * Create a popout window
 */
async function createPopoutWindow(options: CreateWindowOptions): Promise<BrowserWindow> {
  const dims = DEFAULT_DIMENSIONS.popout;
  const position = getCenterPosition(dims.width, dims.height);

  const window = new BrowserWindow({
    width: options.bounds?.width || dims.width,
    height: options.bounds?.height || dims.height,
    x: options.bounds?.x || position.x,
    y: options.bounds?.y || position.y,
    minWidth: dims.minWidth,
    minHeight: dims.minHeight,
    title: options.title || 'Popout',
    show: false,
    webPreferences: {
      contextIsolation: true,
      preload: join(__dirname, '../../preload/index.js'),
      ...options.webPreferences,
    },
  });

  if (options.url) {
    await window.loadURL(options.url);
  } else {
    const url = getWindowUrl('popout');
    await window.loadURL(url);
  }

  window.once('ready-to-show', () => {
    window.show();
    window.focus();
  });

  return window;
}

/**
 * Create a special Agent Runner window (compact/expanded floating window)
 */
export async function createAgentRunnerWindow(): Promise<BrowserWindow> {
  const COMPACT_SIZE = { width: 720, height: 213 };
  const { x, y } = getCenterPosition(COMPACT_SIZE.width, COMPACT_SIZE.height);

  const window = new BrowserWindow({
    width: COMPACT_SIZE.width,
    height: COMPACT_SIZE.height,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    movable: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      preload: join(__dirname, '../../preload/index.js'),
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5177';
  await window.loadURL(`${devUrl}/agent-runner.html`);

  window.once('ready-to-show', () => {
    window.show();
    window.focus();
  });

  return window;
}

/**
 * Get default dimensions for a window type
 * @param type - Window type
 * @returns Default dimensions
 */
export function getDefaultDimensions(type: WindowType): { width: number; height: number; minWidth: number; minHeight: number } {
  return { ...DEFAULT_DIMENSIONS[type] };
}

/**
 * Check if a window type supports state persistence
 * @param type - Window type
 * @returns True if state is persisted
 */
export function isStatePersistent(type: WindowType): boolean {
  return type === 'main';
}
