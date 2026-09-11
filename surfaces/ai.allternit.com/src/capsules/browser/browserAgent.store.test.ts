import { beforeEach, describe, expect, it } from "vitest";
import {
  applyAciStreamEvent,
  useBrowserAgentStore,
} from "./browserAgent.store";

function resetStore() {
  useBrowserAgentStore.setState({
    status: "Idle",
    currentAction: null,
    goal: "",
    lastEventMessage: null,
    currentAdapterId: null,
    currentLayer: null,
    screenshot: null,
    requiresApproval: false,
    engineHealthy: false,
    engineRuntimeStatus: null,
  });
}

describe("applyAciStreamEvent", () => {
  beforeEach(resetStore);

  it("maps a state frame to status, message, and currentAction with bounding box", () => {
    const patches: Array<Record<string, unknown>> = [];
    applyAciStreamEvent((u) => patches.push(u), {
      type: "state",
      data: {
        status: "Running",
        lastMessage: "Clicking sign in",
        adapterId: "browser.cdp",
        stepIndex: 2,
        totalSteps: 5,
        currentAction: { type: "click", label: "Sign in", x: 120, y: 340, risk: 2 },
      },
    });
    for (const p of patches) useBrowserAgentStore.setState(p as never);
    const s = useBrowserAgentStore.getState();
    expect(s.status).toBe("Running");
    expect(s.lastEventMessage).toBe("Clicking sign in");
    expect(s.currentAdapterId).toBe("browser.cdp");
    expect(s.currentAction).toMatchObject({
      stepIndex: 2,
      totalSteps: 5,
      label: "Sign in",
      type: "click",
      boundingBox: { x: 120, y: 340, width: 40, height: 20 },
    });
  });

  it("derives WaitingApproval state", () => {
    applyAciStreamEvent((u) => useBrowserAgentStore.setState(u as never), {
      type: "state",
      data: {
        status: "WaitingApproval",
        currentAction: { type: "purchase", label: "Buy now", risk: 4 },
      },
    });
    const s = useBrowserAgentStore.getState();
    expect(s.requiresApproval).toBe(true);
    expect(s.approvalActionSummary).toBe("Buy now");
    expect(s.approvalRiskTier).toBe(4);
  });

  it("applies screenshot and trace frames", () => {
    applyAciStreamEvent((u) => useBrowserAgentStore.setState(u as never), {
      type: "screenshot",
      data: { screenshot: "aVBORw==" },
    });
    applyAciStreamEvent((u) => useBrowserAgentStore.setState(u as never), {
      type: "trace",
      data: { message: "Navigated to example.com", adapterId: "browser.cdp" },
    });
    const s = useBrowserAgentStore.getState();
    expect(s.screenshot).toBe("aVBORw==");
    expect(s.lastEventMessage).toBe("Navigated to example.com");
  });

  it("marks the run done on a done frame", () => {
    useBrowserAgentStore.setState({ status: "Running", requiresApproval: true });
    applyAciStreamEvent((u) => useBrowserAgentStore.setState(u as never), {
      type: "done",
      data: {},
    });
    const s = useBrowserAgentStore.getState();
    expect(s.status).toBe("Done");
    expect(s.requiresApproval).toBe(false);
  });

  it("ingestAciStreamEvent marks the engine reachable once frames arrive", () => {
    expect(useBrowserAgentStore.getState().engineHealthy).toBe(false);
    useBrowserAgentStore.getState().ingestAciStreamEvent({
      type: "trace",
      data: { message: "hello" },
    });
    const s = useBrowserAgentStore.getState();
    expect(s.engineHealthy).toBe(true);
    expect(s.lastEventMessage).toBe("hello");
  });
});
