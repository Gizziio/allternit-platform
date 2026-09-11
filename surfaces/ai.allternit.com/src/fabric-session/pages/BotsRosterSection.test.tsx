import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BotsRosterSection } from "./BotsRosterSection";
import type { UnifiedRosterBot } from "@/lib/bots/use-unified-roster";

function bot(overrides: Partial<UnifiedRosterBot> = {}): UnifiedRosterBot {
  return {
    id: "bot-1",
    displayName: "Gizzi",
    handle: "gizzi",
    tagline: "Local copilot",
    status: "idle",
    source: "native",
    agent: { id: "bot-1", name: "Gizzi" } as UnifiedRosterBot["agent"],
    updatedAt: "2026-09-10T00:00:00Z",
    ...overrides,
  };
}

describe("BotsRosterSection", () => {
  it("renders a plain empty state when the roster is empty", () => {
    render(<BotsRosterSection bots={[]} onSelectBot={() => {}} />);
    expect(screen.getByText("Bots")).toBeInTheDocument();
    expect(screen.getByText("No bots on this account yet.")).toBeInTheDocument();
  });

  it("lists bots and selects on tap; shows Waiting on you when pending", () => {
    const onSelectBot = vi.fn();
    render(
      <BotsRosterSection
        bots={[bot(), bot({ id: "bot-2", displayName: "Ops", tagline: "" })]}
        pendingByBot={{ "bot-1": true }}
        onSelectBot={onSelectBot}
      />,
    );
    expect(screen.getByText("Gizzi")).toBeInTheDocument();
    expect(screen.getByText("Waiting on you")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Ops"));
    expect(onSelectBot).toHaveBeenCalledWith("bot-2");
  });
});
