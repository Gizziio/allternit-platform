
// Configure API URL before app loads
const API_URL = import.meta.env.VITE_A2R_GATEWAY_URL || 'http://127.0.0.1:3000';
(window as any).__A2R_API_URL__ = API_URL;
(window as any).__A2R_GATEWAY_URL__ = API_URL;

window.onerror = (msg, url, line, col, error) => {
  console.log('[RENDERER ERROR] ' + msg + ' at ' + url + ':' + line + ':' + col);
};
window.onunhandledrejection = (event) => {
  console.log('[RENDERER REJECTION] ' + event.reason);
};
console.log('[FPRINT] main.tsx start');
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ShellApp, A2RHotkeysProvider, HOTKEY_SCOPES } from '@a2r/platform';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <A2RHotkeysProvider initiallyActiveScopes={[HOTKEY_SCOPES.GLOBAL]}>
      <ShellApp />
    </A2RHotkeysProvider>
  </React.StrictMode>
);
