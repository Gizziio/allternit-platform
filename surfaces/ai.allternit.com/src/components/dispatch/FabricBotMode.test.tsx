import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FabricBotModeRail } from "./FabricBotMode";
import type { Agent } from "@/lib/agents/agent.types";
import { useAgentStore } from "@/lib/agents/agent.store";

const startSessionMock = vi.fn();
let sessionStartedCallback:
  | ((sessionId: string, botId: string) => void)
  | undefined;

vi.mock("@/lib/bots/useStartBotSession", () => ({
  useStartBotSession: (
    onSessionStarted?: (sessionId: string, botId: string) => void,
  ) => {
    sessionStartedCallback = onSessionStarted;
    return {
      startSession: startSessionMock,
      startTask: vi.fn(),
      isStarting: false,
      error: null,
      warning: null,
    };
  },
}));

function packagedBot(id: string, displayName: string): Agent {
  return {
    id,
    name: displayName,
    description: "Packaged bot",
    isBot: true,
    botProfile: { displayName },
  } as unknown as Agent;
}

function nodeBrain(id: string, name: string): Agent {
  // Grok/Claude/Kimi-style node agents: never isBot, never botProfile.
  return {
    id,
    name,
    description: "Node brain",
  } as unknown as Agent;
}

describe("FabricBotModeRail", () => {
  beforeEach(() => {
    startSessionMock.mockReset();
    startSessionMock.mockResolvedValue("ses-test-1");
    sessionStartedCallback = undefined;
    useAgentStore.setState({ agents: [] });
  });

  it("lists packaged bots and keeps node brains out of the rail", () => {
    useAgentStore.setState({
      agents: [
        packagedBot("bot-1", "Invoice Pilot"),
        nodeBrain("node-grok", "Grok"),
        nodeBrain("node-claude", "Claude"),
      ],
    });
    render(
      <FabricBotModeRail
        view="hub"
        selectedBotId={null}
        selectedGroupId={null}
        onOpenHub={() => {}}
        onOpenGroups={() => {}}
      />,
    );
    expect(screen.getByText("Invoice Pilot")).toBeInTheDocument();
    expect(screen.queryByText("Grok")).not.toBeInTheDocument();
    expect(screen.queryByText("Claude")).not.toBeInTheDocument();
  });

  it("opens the bot chat view when a bot session starts", () => {
    useAgentStore.setState({ agents: [packagedBot("bot-1", "Invoice Pilot")] });
    const openViewEvents: CustomEvent[] = [];
    window.addEventListener("allternit:open-view", (e) =>
      openViewEvents.push(e as CustomEvent),
    );

    render(
      <FabricBotModeRail
        view="hub"
        selectedBotId={null}
        selectedGroupId={null}
        onOpenHub={() => {}}
        onOpenGroups={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("Invoice Pilot"));

    expect(startSessionMock).toHaveBeenCalledTimes(1);
    // The rail must wire the session-started callback (desktop ShellRail
    // parity) so the canvas navigates from the hub to the bot chat.
    expect(sessionStartedCallback).toBeDefined();
    sessionStartedCallback!("ses-test-1", "bot-1");

    const chatEvent = openViewEvents.find(
      (e) => e.detail?.viewType === "bot-chat-session",
    );
    expect(chatEvent).toBeDefined();
    expect(chatEvent?.detail?.context).toMatchObject({
      sessionId: "ses-test-1",
      botId: "bot-1",
    });
  });
});
