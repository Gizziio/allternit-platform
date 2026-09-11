import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FabricAciModeCanvas } from "./FabricAciModeCanvas";
import { useBrowserAgentStore } from "@/capsules/browser/browserAgent.store";
import type { FabricSessionWithStatus } from "@/lib/dispatch/fabric-session-client";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function aciSession(id: string, title: string): FabricSessionWithStatus {
  return {
    session: { id, title, surface: "browser" },
    status: { type: "idle" },
  } as unknown as FabricSessionWithStatus;
}

describe("FabricAciModeCanvas", () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).ResizeObserver ??= ResizeObserverStub;
    useBrowserAgentStore.setState({
      status: "Idle",
      goal: "",
      screenshot: null,
      currentAction: null,
      lastEventMessage: null,
      currentAdapterId: null,
      currentLayer: null,
      connectedBotId: null,
    });
  });

  it("renders the ACI viewport and a goal composer", () => {
    render(
      <FabricAciModeCanvas
        session={aciSession("ses-1", "ACI run")}
        hostName="Studio Mac"
        onRunGoal={() => {}}
      />,
    );
    expect(screen.getByText("COMPUTER USE")).toBeInTheDocument();
    expect(screen.getByText("No live computer session")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Run a task on Studio Mac…"),
    ).toBeInTheDocument();
  });

  it("submits a trimmed goal and clears the composer", () => {
    const onRunGoal = vi.fn();
    render(
      <FabricAciModeCanvas session={null} hostName="Studio Mac" onRunGoal={onRunGoal} />,
    );
    const composer = screen.getByPlaceholderText("Run a task on Studio Mac…");
    fireEvent.change(composer, { target: { value: "  open allternit.com  " } });
    fireEvent.keyDown(composer, { key: "Enter" });
    expect(onRunGoal).toHaveBeenCalledWith("open allternit.com");
    expect(composer).toHaveValue("");
  });

  it("does not submit an empty goal", () => {
    const onRunGoal = vi.fn();
    render(<FabricAciModeCanvas session={null} onRunGoal={onRunGoal} />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(onRunGoal).not.toHaveBeenCalled();
  });

  it("toggles watching from the composer bar", () => {
    const onToggleWatch = vi.fn();
    render(
      <FabricAciModeCanvas
        session={null}
        watching={false}
        onToggleWatch={onToggleWatch}
        onRunGoal={() => {}}
      />,
    );
    fireEvent.click(screen.getByTitle("Watch the computer"));
    expect(onToggleWatch).toHaveBeenCalledTimes(1);
  });

  it("shows the host fallback when no session or host is given", () => {
    render(<FabricAciModeCanvas session={null} onRunGoal={() => {}} />);
    expect(screen.getByPlaceholderText("Run a task on paired node…")).toBeInTheDocument();
  });
});
