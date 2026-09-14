import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getBotDesktopScreenshot,
  getBotDesktopStatus,
  observeBotDesktop,
} from "@/lib/bots/vm-operator";
import { BotWatchStrip } from "./BotWatchStrip";

vi.mock("@/lib/bots/vm-operator", () => ({
  getBotDesktopScreenshot: vi.fn(async () => ({ ok: true, data: { png: "abc" } })),
  getBotDesktopStatus: vi.fn(),
  observeBotDesktop: vi.fn(),
}));

vi.mock("./policy-audit", () => ({
  fetchPolicyAudit: vi.fn(async () => []),
}));

vi.mock("@/lib/bots/bot-subagent-feed", () => ({
  fetchSubagentFeed: vi.fn(async () => []),
  liveActivityTree: () => ({ children: [], parentSteps: [] }),
}));

vi.mock("@/lib/bots/bot-activity-rows", () => ({
  activityCounts: () => ({ allowed: 0, denied: 0 }),
  formatActivityLines: () => [],
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("BotWatchStrip", () => {
  it("never imports noVNC — the 140×88 thumb is screenshot-only", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "BotWatchStrip.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/@novnc\/novnc/);
    expect(src).not.toMatch(/\bclaimVnc\b/);
    expect(src).not.toMatch(/\bobserveBotDesktop\b/);
  });

  it("polls screenshots and does not open a live RFB", async () => {
    render(<BotWatchStrip botId="bot-1" sandboxId="sb-1" />);
    await waitFor(() => {
      expect(getBotDesktopScreenshot).toHaveBeenCalled();
    });
    expect(observeBotDesktop).not.toHaveBeenCalled();
    expect(getBotDesktopStatus).not.toHaveBeenCalled();
  });
});
