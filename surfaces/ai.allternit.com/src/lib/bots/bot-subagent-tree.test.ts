import { describe, expect, it } from "vitest";

import { initTranscript } from "@/components/bot-chat/transcript";
import type { BotChatTranscript } from "@/components/bot-chat/types";
import { treeFromTranscript } from "./bot-subagent-tree";

function transcriptWithTools(): BotChatTranscript {
  const t = initTranscript();
  return {
    ...t,
    rows: [
      {
        kind: "toolCall",
        id: "c1",
        createdAt: 1,
        call: {
          id: "c1",
          tool: "delegate_task",
          inputSummary: "research",
          status: "success",
          durationMs: 200,
        },
      },
      {
        kind: "toolCall",
        id: "c2",
        createdAt: 2,
        call: {
          id: "c2",
          tool: "computer.shell",
          inputSummary: "ls",
          status: "running",
        },
      },
    ],
  };
}

describe("treeFromTranscript", () => {
  it("counts running and done tool nodes", () => {
    const tree = treeFromTranscript(transcriptWithTools());
    expect(tree.running).toBe(1);
    expect(tree.done).toBe(1);
    expect(tree.failed).toBe(0);
    expect(tree.nodes.map((n) => n.name)).toEqual(["delegate_task", "computer.shell"]);
  });
});
