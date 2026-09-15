import { afterEach, describe, expect, it } from "vitest";
import {
  claimVnc,
  getRemoteVncHolder,
  getVncOwner,
  noteRemoteClaim,
  noteRemoteRelease,
  releaseVnc,
  resetVncOwnership,
  shouldHoldBotDesktopStream,
  vncEndpointKey,
} from "./bot-computer-vnc";

afterEach(() => {
  resetVncOwnership();
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

  it("lets the detached window steal the VNC claim from pane and ACI", () => {
    expect(claimVnc("sb-1", "pane")).toBe(true);
    expect(claimVnc("sb-1", "window")).toBe(true);
    expect(getVncOwner()).toEqual({ sandboxId: "sb-1", layout: "window" });
    expect(claimVnc("sb-1", "aci")).toBe(false);
    expect(claimVnc("sb-1", "pane")).toBe(false);
  });

  it("keeps the detached window streaming when the page is hidden or offscreen", () => {
    expect(
      shouldHoldBotDesktopStream({ layout: "window", pageVisible: false, isOnscreen: false }),
    ).toBe(true);
    expect(
      shouldHoldBotDesktopStream({ layout: "pane", pageVisible: false, isOnscreen: true }),
    ).toBe(false);
    expect(
      shouldHoldBotDesktopStream({ layout: "pane", pageVisible: true, isOnscreen: true }),
    ).toBe(true);
  });

  it("releases so a lower-priority host can reconnect", () => {
    expect(claimVnc("sb-1", "aci")).toBe(true);
    releaseVnc("sb-1", "aci");
    expect(claimVnc("sb-1", "pane")).toBe(true);
  });

  it("does not let a remote pane steal the window's VNC claim", () => {
    expect(claimVnc("sb-1", "window")).toBe(true);
    noteRemoteClaim("sb-1", "pane");
    expect(getVncOwner()).toEqual({ sandboxId: "sb-1", layout: "window" });
    expect(claimVnc("sb-1", "window")).toBe(true);
  });

  it("yields the pane when a remote window claims VNC", () => {
    expect(claimVnc("sb-1", "pane")).toBe(true);
    noteRemoteClaim("sb-1", "window");
    expect(getVncOwner()).toBeNull();
    expect(getRemoteVncHolder()).toEqual({ sandboxId: "sb-1", layout: "window" });
    expect(claimVnc("sb-1", "pane")).toBe(false);
  });

  it("lets the pane reclaim after the remote window releases", () => {
    noteRemoteClaim("sb-1", "window");
    expect(claimVnc("sb-1", "pane")).toBe(false);
    noteRemoteRelease("sb-1");
    expect(claimVnc("sb-1", "pane")).toBe(true);
  });

  it("strips rotating VNC tokens so reconnects are not identity changes", () => {
    expect(
      vncEndpointKey(
        "/ws/bots/b1/desktop/vnc?sandbox_id=sb-1&token=aaa",
      ),
    ).toBe(
      vncEndpointKey(
        "/ws/bots/b1/desktop/vnc?sandbox_id=sb-1&token=bbb",
      ),
    );
  });
});
