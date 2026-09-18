import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BotRailRow } from "./BotRailRows";
import type { Agent } from "@/lib/agents/agent.types";

vi.mock("@phosphor-icons/react", () => {
  const Icon = () => <span data-icon="p" />;
  return {
    Archive: Icon,
    ArrowCounterClockwise: Icon,
    ArrowDown: Icon,
    ArrowUp: Icon,
    CaretRight: Icon,
    CircleNotch: Icon,
    Crown: Icon,
    DotsThree: Icon,
    Folder: Icon,
    FolderSimplePlus: Icon,
    PencilSimple: Icon,
    Plus: Icon,
    PushPin: Icon,
    PushPinSlash: Icon,
    Trash: Icon,
    X: Icon,
  };
});

vi.mock("@/lib/bots/bot-operational-state.store", () => ({
  useBotStatus: () => ({
    needsAttention: false,
    hasPendingApprovals: false,
    isWorking: false,
    status: "idle",
  }),
}));

vi.mock("@/lib/bots/bot-roster.store", () => ({
  useBotRosterStore: (sel: (s: { canonicalChatIds: Record<string, string> }) => unknown) =>
    sel({ canonicalChatIds: { "bot-1": "ses-1" } }),
}));

vi.mock("@/lib/bots/bot-folders.store", () => ({
  useBotFoldersStore: (sel: (s: { foldersByBot: Record<string, never> }) => unknown) =>
    sel({ foldersByBot: {} }),
  moveFolderIds: (ids: string[]) => ids,
}));

vi.mock("@/views/chat/ChatSessionStore", () => ({
  useChatSessionStore: (
    sel: (s: {
      sessions: Array<{ id: string; name?: string; messages: Array<{ role: string; content: string }>; metadata?: Record<string, unknown> }>;
      unreadCounts: Record<string, number>;
      streamingBySession: Record<string, { isStreaming?: boolean }>;
      activeSessionId: string | null;
    }) => unknown,
  ) =>
    sel({
      sessions: [
        {
          id: "ses-1",
          name: "Bot Chat",
          metadata: { isBot: true, botCanonicalFor: "bot-1" },
          messages: [{ role: "assistant", content: "Hi! I'm Accountant. Regarding the invoice." }],
        },
      ],
      unreadCounts: {},
      streamingBySession: {},
      activeSessionId: "ses-1",
    }),
}));

vi.mock("./BotAvatar", () => ({
  BotAvatar: () => <span data-testid="avatar" />,
}));

function makeBot(): Agent {
  return {
    id: "bot-1",
    name: "Accountant",
    description: "Books",
    isBot: true,
    botProfile: {
      displayName: "Accountant",
      title: "Keyword Researcher",
      chiefOfStaff: true,
    },
  } as Agent;
}

describe("BotRailRow", () => {
  it("matches OpenMaus BotListItem: title above name, CoS under name, last message", () => {
    render(<BotRailRow bot={makeBot()} onOpen={() => undefined} />);
    expect(screen.getByText("Keyword Researcher")).toBeInTheDocument();
    expect(screen.getByText("Accountant")).toBeInTheDocument();
    expect(screen.getByText("Chief of Staff")).toBeInTheDocument();
    expect(screen.getByText(/Regarding the invoice/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Expand threads/ })).toBeInTheDocument();
  });
});
