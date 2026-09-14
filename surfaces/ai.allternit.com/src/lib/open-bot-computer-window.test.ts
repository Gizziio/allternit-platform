import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BOT_COMPUTER_DETACHED_SURFACE,
  botComputerWindowHref,
  launchBotComputerWindow,
} from "./open-bot-computer-window";

describe("botComputerWindowHref", () => {
  it("builds a detached /shell URL", () => {
    const href = botComputerWindowHref("https://platform.example", {
      botId: "bot-1",
      title: "Gizzi's computer",
    });
    const url = new URL(href);
    expect(url.pathname).toBe("/shell");
    expect(url.searchParams.get("detachedSurface")).toBe(BOT_COMPUTER_DETACHED_SURFACE);
    expect(url.searchParams.get("botId")).toBe("bot-1");
    expect(url.searchParams.get("title")).toBe("Gizzi's computer");
  });
});

describe("launchBotComputerWindow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("invokes the Electron bridge when present", () => {
    const openBotComputer = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("allternit", { shell: { openBotComputer } });
    Object.defineProperty(window, "allternit", {
      configurable: true,
      value: { shell: { openBotComputer } },
    });
    launchBotComputerWindow({ botId: "bot-1", title: "Desk" });
    expect(openBotComputer).toHaveBeenCalledWith({ botId: "bot-1", title: "Desk" });
  });

  it("opens a popup when the Electron bridge is missing", () => {
    const open = vi.fn().mockReturnValue({ closed: false });
    vi.stubGlobal("open", open);
    Object.defineProperty(window, "allternit", { configurable: true, value: undefined });
    launchBotComputerWindow({ botId: "bot-9" });
    expect(open).toHaveBeenCalled();
    const href = String(open.mock.calls[0][0]);
    expect(href).toContain("detachedSurface=bot-computer");
    expect(href).toContain("botId=bot-9");
    expect(open.mock.calls[0][1]).toBe("allternit-bot-computer-bot-9");
  });
});
