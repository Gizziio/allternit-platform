"use client";

import React from "react";
import { useRunnerStore } from "../runner/runner.store";
import { AgentRunner } from "../runner/AgentRunner";
import { ACIComputerUseSidecar } from "../capsules/browser/ACIComputerUseSidecar";

export function ShellOverlayLayer() {
  const { open } = useRunnerStore();

  return (
    <>
      {/* AgentRunner panel (runner.store controlled) */}
      {open && <AgentRunner />}

      {/* ACI computer-use viewport — slides in from right in Chat/Cowork/Code modes
          when the engine is active. Suppressed automatically when BrowserCapsule
          is mounted (it renders its own full-screen ACIComputerUseView). */}
      <ACIComputerUseSidecar suppressInBrowserMode />
    </>
  );
}
