import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BotsRosterSection } from "./BotsRosterSection";
import type { Agent } from "@/lib/agents/agent.types";

function bot(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "bot-1",
    name: "Gizzi",
    isBot: true,
    botProfile: {
      displayName: "Gizzi",
      tagline: "Local copilot",
    },
    ...overrides,
  } as Agent;
}

describe("BotsRosterSection", () => {
  it("renders a plain empty state when the roster is empty", () => {
    render(<BotsRosterSection bots={[]} onSelectBot={() => {}} />);
    expect(screen.getByText("Bots")).toBeInTheDocument();
    expect(screen.getByText("No bots yet — create one in Bot Hub")).toBeInTheDocument();
  });

  it("lists bots and selects on tap; shows Waiting on you when pending", () => {
    const onSelectBot = vi.fn();
    render(
      <BotsRosterSection
        bots={[
          bot(),
          bot({ id: "bot-2", name: "Ops", botProfile: { displayName: "Ops" } }),
        ]}
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
