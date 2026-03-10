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
import { ClerkProvider } from '@clerk/clerk-react';
import { ShellApp, A2RHotkeysProvider, HOTKEY_SCOPES, GlobalDropzoneProvider } from '@a2r/platform';
import { TerminalClerkBridgeApp } from './terminal-clerk-bridge';
import { AgentCommunicationDemo } from './components/AgentCommunicationDemo';

if (!(window as any).Buffer && (globalThis as any).Buffer) {
  (window as any).Buffer = (globalThis as any).Buffer;
}

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
    >
      {window.location.pathname === '/terminal/clerk' || window.location.pathname === '/terminal/clerk/' ? (
        <TerminalClerkBridgeApp />
      ) : window.location.pathname === '/demo/agent-communication' || window.location.pathname === '/demo/agent-communication/' ? (
        <AgentCommunicationDemo />
      ) : (
        <A2RHotkeysProvider initiallyActiveScopes={[HOTKEY_SCOPES.GLOBAL]}>
          <GlobalDropzoneProvider>
            <ShellApp />
          </GlobalDropzoneProvider>
        </A2RHotkeysProvider>
      )}
    </ClerkProvider>
  </React.StrictMode>
);
