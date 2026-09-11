import { afterEach, describe, expect, it } from "vitest";

import {
  isBotThreadMuted,
  resetBotThreadNotify,
  setBotThreadMuted,
} from "./bot-thread-notify";

afterEach(() => {
  resetBotThreadNotify();
  localStorage.removeItem("allternit.bot-thread-notify");
});

describe("bot-thread-notify", () => {
  it("defaults to unmuted", () => {
    expect(isBotThreadMuted("sess-1")).toBe(false);
    expect(isBotThreadMuted(undefined)).toBe(false);
  });

  it("persists mute per session", () => {
    setBotThreadMuted("sess-1", true);
    expect(isBotThreadMuted("sess-1")).toBe(true);
    expect(isBotThreadMuted("sess-2")).toBe(false);
    setBotThreadMuted("sess-1", false);
    expect(isBotThreadMuted("sess-1")).toBe(false);
  });
});
