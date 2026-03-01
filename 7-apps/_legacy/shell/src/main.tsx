import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ShellStateProvider } from './runtime/ShellState';
import { BrainProvider } from './runtime/BrainContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { proofRecorder } from './proof/ProofRecorder'; // Import ProofRecorder

console.log('[FPRINT] main.tsx loaded');

// Initialize ProofRecorder
proofRecorder.mark('app:init');

window.addEventListener('error', (e) => {
  console.error('[Global Error Handler]', e);
  const stack = e.error?.stack || 'No stack trace available';
  const message = e.error?.message || e.message || 'Unknown error';
  const errorInfo = `
========================================
REACT RENDER ERROR
========================================
Message: ${message}
File: ${e.filename}
Line: ${e.lineno}, Column: ${e.colno}
========================================
Stack Trace:
${stack}
========================================
  `.trim();
  document.body.innerHTML = `<pre style="white-space:pre-wrap; padding: 20px; background: #fee; color: #c00; font-family: monospace; font-size: 12px;">${errorInfo}</pre>`;
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[Global Rejection Handler]', e);
  const reason = String(e.reason);
  const stack = e.reason?.stack || 'No stack trace available';
  const rejectionInfo = `
========================================
UNHANDLED PROMISE REJECTION
========================================
Reason: ${reason}
========================================
Stack Trace:
${stack}
========================================
  `.trim();
  document.body.innerHTML = `<pre style="white-space:pre-wrap; padding: 20px; background: #fee; color: #c00; font-family: monospace; font-size: 12px;">${rejectionInfo}</pre>`;
});

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app root');

const reactRoot = createRoot(root);
reactRoot.render(
  <ErrorBoundary>
    <ShellStateProvider>
      <BrainProvider>
        <App />
      </BrainProvider>
    </ShellStateProvider>
  </ErrorBoundary>
);

console.log('[FPRINT] main.tsx App mounted');
