import { afterEach, describe, expect, it, vi } from "vitest";
import { vibrateApproval, vibrateSend } from "./haptics";

describe("haptics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls vibrate when present", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });

    vibrateSend();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(10);

    vibrateApproval();
    expect(vibrate).toHaveBeenCalledTimes(2);
    expect(vibrate).toHaveBeenCalledWith([15, 40, 15]);
  });

  it("is a silent no-op when vibrate is absent", () => {
    vi.stubGlobal("navigator", {});
    expect(() => vibrateSend()).not.toThrow();
    expect(() => vibrateApproval()).not.toThrow();
  });

  it("is a silent no-op when vibrate throws", () => {
    vi.stubGlobal("navigator", {
      vibrate: () => {
        throw new Error("not allowed");
      },
    });
    expect(() => vibrateSend()).not.toThrow();
    expect(() => vibrateApproval()).not.toThrow();
  });
});
