import { afterEach, describe, expect, it } from "vitest";
import { claimVnc, getVncOwner, releaseVnc } from "./bot-computer-vnc";

afterEach(() => {
  const owner = getVncOwner();
  if (owner) releaseVnc(owner.sandboxId, owner.layout);
});

describe("bot-computer-vnc", () => {
  it("keeps the strip from stealing VNC from the chat pane", () => {
    expect(claimVnc("sb-1", "pane")).toBe(true);
    expect(claimVnc("sb-1", "strip")).toBe(false);
  });

  it("lets ACI steal the VNC claim from the chat pane", () => {
    expect(claimVnc("sb-1", "pane")).toBe(true);
    expect(claimVnc("sb-1", "aci")).toBe(true);
    expect(getVncOwner()).toEqual({ sandboxId: "sb-1", layout: "aci" });
    expect(claimVnc("sb-1", "pane")).toBe(false);
  });

  it("releases so a lower-priority host can reconnect", () => {
    expect(claimVnc("sb-1", "aci")).toBe(true);
    releaseVnc("sb-1", "aci");
    expect(claimVnc("sb-1", "pane")).toBe(true);
  });
});
