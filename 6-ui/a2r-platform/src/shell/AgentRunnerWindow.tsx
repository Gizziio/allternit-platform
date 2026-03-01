"use client";

import React, { useEffect } from "react";
import { useRunnerStore } from "../runner/runner.store";
import { AgentRunnerPanel } from "../runner/AgentRunnerPanel";
import { AgentInvokeBar } from "../runner/AgentInvokeBar";
import { Minimize2, X, GripHorizontal } from "lucide-react";

export function AgentRunnerWindow() {
  const { open, mode, toggle, close } = useRunnerStore();

  // Auto-open compact mode when window loads
  useEffect(() => {
    const { openCompact } = useRunnerStore.getState();
    openCompact();
  }, []);

  const handleClose = () => {
    (window as any).a2AgentRunner?.close();
  };

  const handleToggle = () => {
    const newExpanded = mode !== "expanded";
    toggle();
    (window as any).a2AgentRunner?.setExpanded(newExpanded);
  };

  const handleExpand = () => {
    // Always expand - used when submitting task
    // Store already set mode to "expanded", just resize window
    (window as any).a2AgentRunner?.setExpanded(true);
  };

  if (!open) return null;

  return (
    <div className="h-full w-full flex flex-col bg-background rounded-xl overflow-hidden shadow-2xl">
      {/* Expanded header */}
      {mode === "expanded" && (
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50 select-none app-region-drag">
          <div className="flex items-center gap-2 app-region-no-drag">
            <GripHorizontal className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">Agent Runner</span>
          </div>
          <div className="flex items-center gap-1 app-region-no-drag">
            <button onClick={handleToggle} className="p-1.5 rounded-md hover:bg-muted">
              <Minimize2 className="w-4 h-4" />
            </button>
            <button onClick={handleClose} className="p-1.5 rounded-md hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Compact header */}
      {mode === "compact" && (
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 select-none app-region-drag">
          <div className="flex items-center gap-1 app-region-no-drag">
            <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Agent Runner</span>
          </div>
          <div className="flex items-center gap-1 app-region-no-drag">
            <button 
              onClick={handleToggle} 
              className="px-2 py-1 text-xs rounded-md hover:bg-muted/50 transition-colors text-muted-foreground"
            >
              Expand
            </button>
            <button onClick={handleClose} className="p-1 rounded-md hover:bg-muted/50">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mode === "compact" ? (
          <div className="h-full p-3 flex flex-col">
            <AgentInvokeBar onExpand={handleExpand} />
          </div>
        ) : (
          <AgentRunnerPanel onCollapse={handleToggle} />
        )}
      </div>
    </div>
  );
}
