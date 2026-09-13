import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { FabricAciModeCanvas } from "./FabricAciModeCanvas";
import {
  getFabricAciRunner,
  setFabricAciRunner,
  useBrowserAgentStore,
} from "@/capsules/browser/browserAgent.store";
import type { FabricSessionWithStatus } from "@/lib/dispatch/fabric-session-client";

vi.mock("@/capsules/browser/BrowserCapsuleEnhanced", () => ({
  BrowserCapsuleEnhanced: () => <div data-testid="browser-capsule" />,
}));

function aciSession(id: string, title: string): FabricSessionWithStatus {
  return {
    session: { id, title, surface: "browser" },
    status: { type: "idle" },
  } as unknown as FabricSessionWithStatus;
}

describe("FabricAciModeCanvas", () => {
  beforeEach(() => {
    setFabricAciRunner(null);
    useBrowserAgentStore.setState({ status: "Idle", goal: "", screenshot: null });
  });

  it("mounts the embedded browser capsule (desktop ACI/browser mode view)", async () => {
    const { findByTestId } = render(
      <FabricAciModeCanvas
        session={aciSession("ses-1", "ACI run")}
        hostName="Studio Mac"
        onRunGoal={() => {}}
        onStopRun={() => {}}
      />,
    );
    expect(await findByTestId("browser-capsule")).toBeInTheDocument();
  });

  it("registers the fabric ACI runner while mounted and clears it on unmount", () => {
    const { unmount } = render(
      <FabricAciModeCanvas session={null} onRunGoal={() => {}} onStopRun={() => {}} />,
    );
    expect(getFabricAciRunner()).not.toBeNull();
    unmount();
    expect(getFabricAciRunner()).toBeNull();
  });

  it("routes capsule agent-bar runs to onRunGoal", () => {
    const onRunGoal = vi.fn();
    render(
      <FabricAciModeCanvas session={null} onRunGoal={onRunGoal} onStopRun={() => {}} />,
    );
    useBrowserAgentStore.getState().startAciSession("open allternit.com");
    expect(onRunGoal).toHaveBeenCalledWith("open allternit.com");
  });

  it("routes agent-bar stops to onStopRun", () => {
    const onStopRun = vi.fn();
    render(
      <FabricAciModeCanvas session={null} onRunGoal={() => {}} onStopRun={onStopRun} />,
    );
    useBrowserAgentStore.getState().stopExecution();
    expect(onStopRun).toHaveBeenCalledTimes(1);
  });
});
