import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { AgentRunner, useRunnerStore } from '@a2r/platform';
import './index.css';

// Force transparent background - override any CSS
const style = document.createElement('style');
style.textContent = `
  html, body, #root {
    background: transparent !important;
  }
`;
document.head.appendChild(style);

// Agent Runner Window Entry Point
function App() {
  useEffect(() => {
    // Open fresh in compact mode (don't call close() here - it would close the window!)
    const store = useRunnerStore.getState();
    store.openCompact();
  }, []);

  return (
    <div 
      className="h-screen w-screen overflow-hidden"
      style={{ background: '#2B2520', borderRadius: '16px' }}
    >
      <AgentRunner />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
