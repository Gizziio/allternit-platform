/**
 * Agent Runner Window Entry Point
 * 
 * This is loaded in a separate Electron BrowserWindow.
 * It renders only the Agent Runner UI without the shell chrome.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { AgentRunner } from "./runner/AgentRunner";
import { TooltipProvider } from "./components/ui/tooltip";
import { SessionProvider } from "./providers/session-provider";
import { VoiceProvider } from "./providers/voice-provider";
import "./index.css";

// Force transparent background for agent runner window
// This overrides the body background from index.css
const style = document.createElement('style');
style.textContent = `
  html, body, #root {
    background: transparent !important;
    overflow: hidden;
  }
`;
document.head.appendChild(style);

// Auto-open the runner when window loads
const runnerStore = (await import("./runner/runner.store")).useRunnerStore;

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <TooltipProvider>
      <SessionProvider session={null}>
        <VoiceProvider>
          {/* NO CONTAINER - AgentRunner renders itself with fixed positioning */}
          <AgentRunner />
        </VoiceProvider>
      </SessionProvider>
    </TooltipProvider>
  </React.StrictMode>
);

// Auto-open on load
setTimeout(() => {
  const { openCompact } = runnerStore.getState();
  openCompact();
}, 100);
