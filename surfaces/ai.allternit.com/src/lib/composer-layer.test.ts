import { describe, expect, it, vi } from "vitest";
import { openAgentsConsole } from "./composer-layer";

describe("openAgentsConsole", () => {
  it("opens Cloud Console on the Agents tab", () => {
    const spy = vi.fn();
    window.addEventListener("allternit:open-view", spy);
    openAgentsConsole("sess-1");
    expect(spy).toHaveBeenCalled();
    const detail = (spy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.viewType).toBe("cloud-console");
    expect(detail.context).toEqual({ tab: "agents", sessionId: "sess-1" });
    window.removeEventListener("allternit:open-view", spy);
  });
});
