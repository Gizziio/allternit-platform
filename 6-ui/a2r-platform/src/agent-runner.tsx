/**
 * Agent Runner Window Entry Point
 * 
 * This is loaded in a separate Electron BrowserWindow.
 * It renders only the Agent Runner UI without the shell chrome.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { AgentRunnerWindow } from "./shell/AgentRunnerWindow";
import { TooltipProvider } from "./components/ui/tooltip";
import "./index.css";

// Import providers needed for Agent Runner
import { SessionProvider } from "./providers/session-provider";
import { VoiceProvider } from "./providers/voice-provider";

// Auto-open the runner when window loads
const runnerStore = (await import("./runner/runner.store")).useRunnerStore;

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <TooltipProvider>
      <SessionProvider session={null}>
        <VoiceProvider>
          {/* Add the providers that NewChatInput expects */}
          <div className="h-screen w-screen bg-transparent flex items-center justify-center p-4">
            <AgentRunnerWindow />
          </div>
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
