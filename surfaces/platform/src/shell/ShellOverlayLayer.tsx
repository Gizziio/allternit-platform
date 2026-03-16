"use client";

import React from "react";
import { useRunnerStore } from "../runner/runner.store";
import { AgentRunner } from "../runner/AgentRunner";

export function ShellOverlayLayer() {
  const { open } = useRunnerStore();
  
  if (!open) return null;
  
  // Just render AgentRunner directly - it handles its own positioning and styling
  return <AgentRunner />;
}
