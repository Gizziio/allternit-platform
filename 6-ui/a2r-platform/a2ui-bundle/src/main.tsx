/**
 * A2UI Bundle Entry Point
 * Ported from OpenClaw dist/canvas-host/a2ui/a2ui.bundle.js
 * 
 * This is the compiled entry point for the A2UI bundle.
 * It mounts the A2UI renderer and provides the action bridge.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { A2UIBundleApp } from './A2UIBundleApp';
import './styles.css';

// Mount A2UI to the DOM
function mountA2UI(containerId: string = 'a2r-root') {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`[A2UI] Container #${containerId} not found`);
    return null;
  }

  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <A2UIBundleApp />
    </React.StrictMode>
  );

  return root;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Check if we're in a host environment
  const hasHost = typeof window.a2rSendUserAction === 'function' ||
                  typeof window.webkit?.messageHandlers?.a2rCanvasA2UIAction !== 'undefined' ||
                  typeof window.a2rCanvasA2UIAction !== 'undefined';

  console.log('[A2UI] Bundle loaded. Bridge available:', hasHost);

  // Mount the app
  mountA2UI();
});

// Export global API
(window as any).A2R = {
  mount: mountA2UI,
  unmount: () => {
    const root = document.getElementById('a2r-root');
    if (root) {
      ReactDOM.createRoot(root).unmount();
    }
  },
  // Action handlers (set by host)
  onAction: null as ((action: any) => void) | null,
  // Send action to host
  sendAction: (action: any) => {
    if (typeof window.a2rSendUserAction === 'function') {
      return window.a2rSendUserAction(action);
    }
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'A2R_ACTION', payload: action }, '*');
      return true;
    }
    return false;
  },
};
