"use client";

import React, { useEffect } from "react";
import { useRunnerStore } from "../runner/runner.store";
import { AgentRunner } from "../runner/AgentRunner";

export function AgentRunnerWindow() {
  const { open, openCompact } = useRunnerStore();

  // Auto-open compact mode when window loads
  useEffect(() => {
    openCompact();
  }, [openCompact]);

  if (!open) return null;

  // Just render the AgentRunner directly - it handles its own layout
  return <AgentRunner />;
}
