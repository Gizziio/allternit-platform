import { describe, expect, it } from "vitest";
import { initTranscript } from "@/components/bot-chat/transcript";
import type { BotChatTranscript } from "@/components/bot-chat/types";
import { childrenFromSubagents, liveActivityTree, mergeActivityTrees } from "./bot-subagent-feed";
import { treeFromTranscript } from "./bot-subagent-tree";

describe("bot-subagent-feed", () => {
  it("maps spawned children onto activity children", () => {
    const children = childrenFromSubagents([
      { id: "child-1", name: "researcher", status: "working" },
      { id: "child-2", name: "fixer", status: "idle" },
    ]);
    expect(children.map((c) => c.name)).toEqual(["researcher", "fixer"]);
    expect(children[0].status).toBe("running");
    expect(children[1].status).toBe("success");
  });

  it("merges transcript spawn tools with the spawned-child feed", () => {
    const t: BotChatTranscript = {
      ...initTranscript(),
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
      ],
    };
    const live = liveActivityTree(t, [{ id: "child-1", name: "researcher", status: "working" }]);
    expect(live.children.some((c) => c.name === "researcher")).toBe(true);
    expect(live.children.some((c) => c.id === "c1")).toBe(true);
  });

  it("dedupes merged children by id", () => {
    const base = treeFromTranscript(initTranscript(), "Bot");
    const merged = mergeActivityTrees(base, [
      { id: "a", name: "old", task: "", status: "running", steps: [] },
    ]);
    const again = mergeActivityTrees(merged, [
      { id: "a", name: "new", task: "", status: "success", steps: [] },
    ]);
    expect(again.children).toHaveLength(1);
    expect(again.children[0].name).toBe("new");
  });
});
