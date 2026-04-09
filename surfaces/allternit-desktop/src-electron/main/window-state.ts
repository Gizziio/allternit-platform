import { screen, BrowserWindow, Rectangle } from 'electron';
import Store from 'electron-store';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayBounds {
  width: number;
  height: number;
}

export interface WindowState {
  bounds: WindowBounds;
  isMaximized: boolean;
  isFullScreen: boolean;
  displayBounds: DisplayBounds;
}

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;

const store = new Store<WindowState>({
  name: 'window-state',
  defaults: {
    bounds: {
      x: undefined as unknown as number,
      y: undefined as unknown as number,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    },
    isMaximized: false,
    isFullScreen: false,
    displayBounds: {
      width: 1920,
      height: 1080,
    },
  },
});

function getDefaultBounds(): WindowBounds {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  return {
    x: Math.round((width - DEFAULT_WIDTH) / 2),
    y: Math.round((height - DEFAULT_HEIGHT) / 2),
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  };
}

function intersectsDisplay(bounds: Rectangle, display: Electron.Display): boolean {
  const displayBounds = display.bounds;

  return !(
    bounds.x + bounds.width < displayBounds.x ||
    bounds.x > displayBounds.x + displayBounds.width ||
    bounds.y + bounds.height < displayBounds.y ||
    bounds.y > displayBounds.y + displayBounds.height
  );
}

export function ensureVisible(bounds: Rectangle): WindowBounds {
  const displays = screen.getAllDisplays();
  const isVisible = displays.some((display) => intersectsDisplay(bounds, display));

  if (isVisible) {
    return {
      x: bounds.x,
      y: bounds.y,
      width: Math.max(bounds.width, MIN_WIDTH),
      height: Math.max(bounds.height, MIN_HEIGHT),
    };
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: displayWidth, height: displayHeight } = primaryDisplay.workAreaSize;

  const width = Math.min(bounds.width, displayWidth);
  const height = Math.min(bounds.height, displayHeight);

  return {
    x: Math.round((displayWidth - width) / 2),
    y: Math.round((displayHeight - height) / 2),
    width,
    height,
  };
}

export function getWindowState(): WindowState {
  const savedState = store.get('bounds') ? (store.store as WindowState) : null;

  if (!savedState) {
    const defaultBounds = getDefaultBounds();
    const primaryDisplay = screen.getPrimaryDisplay();

    return {
      bounds: defaultBounds,
      isMaximized: false,
      isFullScreen: false,
      displayBounds: {
        width: primaryDisplay.size.width,
        height: primaryDisplay.size.height,
      },
    };
  }

  const currentDisplays = screen.getAllDisplays();
  const savedDisplayChanged = currentDisplays.every(
    (display) =>
      display.size.width !== savedState.displayBounds.width ||
      display.size.height !== savedState.displayBounds.height
  );

  if (savedDisplayChanged) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: displayWidth, height: displayHeight } = primaryDisplay.workAreaSize;

    const width = Math.min(savedState.bounds.width, displayWidth * 0.9);
    const height = Math.min(savedState.bounds.height, displayHeight * 0.9);

    return {
      bounds: {
        x: Math.round((displayWidth - width) / 2),
        y: Math.round((displayHeight - height) / 2),
        width,
        height,
      },
      isMaximized: false,
      isFullScreen: false,
      displayBounds: {
        width: primaryDisplay.size.width,
        height: primaryDisplay.size.height,
      },
    };
  }

  const visibleBounds = ensureVisible(savedState.bounds);

  return {
    ...savedState,
    bounds: visibleBounds,
  };
}

export function saveWindowState(window: BrowserWindow): void {
  if (!window || window.isDestroyed()) {
    return;
  }

  const isMaximized = window.isMaximized();
  const isFullScreen = window.isFullScreen();

  if (!isMaximized && !isFullScreen) {
    const bounds = window.getBounds();
    const primaryDisplay = screen.getPrimaryDisplay();

    store.set({
      bounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      },
      isMaximized,
      isFullScreen,
      displayBounds: {
        width: primaryDisplay.size.width,
        height: primaryDisplay.size.height,
      },
    });
  } else {
    store.set('isMaximized', isMaximized);
    store.set('isFullScreen', isFullScreen);
  }
}

export function restoreWindowState(window: BrowserWindow): void {
  const state = getWindowState();

  window.setBounds(state.bounds);

  if (state.isMaximized) {
    window.maximize();
  }

  if (state.isFullScreen) {
    window.setFullScreen(true);
  }
}

export function createWindowOptions(): Electron.BrowserWindowConstructorOptions {
  const state = getWindowState();

  return {
    width: state.bounds.width,
    height: state.bounds.height,
    x: state.bounds.x,
    y: state.bounds.y,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    transparent: true,
    backgroundColor: undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: '',
    },
  };
}

export function clearWindowState(): void {
  store.clear();
}
