import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { AgentRunnerWindow, useRunnerStore } from '@a2r/platform';
import './index.css';

// Agent Runner Window Entry Point
function App() {
  useEffect(() => {
    // Reset to compact mode and open fresh
    const store = useRunnerStore.getState();
    store.close(); // Close any existing state
    store.openCompact(); // Open fresh in compact mode
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden">
      <AgentRunnerWindow />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
