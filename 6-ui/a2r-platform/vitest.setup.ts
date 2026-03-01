import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock localStorage globally before any modules load
const mockLocalStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(() => null),
  length: 0,
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Polyfill URL.createObjectURL and URL.revokeObjectURL for jsdom
if (typeof window !== 'undefined') {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();
  }

  // Polyfill ResizeObserver
  if (!window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // Polyfill matchMedia
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  // Polyfill __TAURI_IPC__ to prevent aptabase/tauri errors
  if (!window.__TAURI_IPC__) {
    (window as any).__TAURI_IPC__ = vi.fn();
  }

  // Mock a2rUsageHost for Electron/Tauri shim
  if (!(window as any).a2rUsageHost) {
    (window as any).a2rUsageHost = {
      invoke: vi.fn(() => Promise.resolve(null)),
      listen: vi.fn(() => Promise.resolve(() => {})),
      setWindowSize: vi.fn(() => Promise.resolve()),
      getVersion: vi.fn(() => Promise.resolve('0.0.0-test')),
      resolveResource: vi.fn((path: string) => Promise.resolve(path)),
      setTrayIcon: vi.fn(() => Promise.resolve()),
      setTrayIconAsTemplate: vi.fn(() => Promise.resolve()),
      currentMonitor: vi.fn(() => Promise.resolve({ size: { width: 1920, height: 1080 } })),
    };
  }

  // Polyfill Pointer Events for Radix UI
  if (!window.Element.prototype.hasPointerCapture) {
    window.Element.prototype.hasPointerCapture = () => false;
  }
  if (!window.Element.prototype.setPointerCapture) {
    window.Element.prototype.setPointerCapture = () => {};
  }
  if (!window.Element.prototype.releasePointerCapture) {
    window.Element.prototype.releasePointerCapture = () => {};
  }

  // Polyfill scrollIntoView
  if (!window.Element.prototype.scrollIntoView) {
    window.Element.prototype.scrollIntoView = () => {};
  }

  // Polyfill localStorage
  if (!window.localStorage) {
    const mockLocalStorage = (() => {
      let store: Record<string, string> = {};
      return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value.toString(); }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
        key: vi.fn((index: number) => Object.keys(store)[index] || null),
        get length() { return Object.keys(store).length; },
      };
    })();
    Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true });
    (globalThis as any).localStorage = mockLocalStorage;
  }

  // Polyfill HTMLCanvasElement for tests
  if (!window.HTMLCanvasElement.prototype.getContext) {
    window.HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
      if (contextType === '2d') {
        return {
          drawImage: vi.fn(),
          getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
          putImageData: vi.fn(),
          createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
          fillRect: vi.fn(),
          clearRect: vi.fn(),
          getContextAttributes: vi.fn(() => ({})),
          canvas: { width: 0, height: 0 },
        };
      }
      return null;
    });
  }
  
  // Mock toBlob and toDataURL
  if (!window.HTMLCanvasElement.prototype.toBlob) {
    window.HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => {
      callback(new Blob(['mock'], { type: 'image/jpeg' }));
    });
  }
  if (!window.HTMLCanvasElement.prototype.toDataURL) {
    window.HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,mock');
  }
}