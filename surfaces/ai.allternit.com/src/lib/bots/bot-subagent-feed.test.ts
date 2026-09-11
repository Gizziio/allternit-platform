import { describe, expect, it } from "vitest";
import { initTranscript } from "@/components/bot-chat/transcript";
import type { BotChatTranscript } from "@/components/bot-chat/types";
import { liveActivityTree, mergeActivityTrees, treeFromSubagents } from "./bot-subagent-feed";

describe("bot-subagent-feed", () => {
  it("maps spawned children onto the activity tree", () => {
    const tree = treeFromSubagents([
      { id: "child-1", name: "researcher", status: "working" },
      { id: "child-2", name: "fixer", status: "idle" },
    ]);
    expect(tree.running).toBe(1);
    expect(tree.done).toBe(1);
    expect(tree.nodes.map((n) => n.name)).toEqual(["researcher", "fixer"]);
  });

  it("merges transcript tools with the spawned-child feed", () => {
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
    expect(live.running).toBe(1);
    expect(live.done).toBe(1);
    expect(live.nodes.map((n) => n.name).sort()).toEqual(["delegate_task", "researcher"]);
  });

  it("dedupes merged trees by id", () => {
    const merged = mergeActivityTrees(
      { running: 1, done: 0, failed: 0, nodes: [{ id: "a", name: "old", status: "running" }] },
      { running: 0, done: 1, failed: 0, nodes: [{ id: "a", name: "new", status: "success" }] },
    );
    expect(merged.nodes).toHaveLength(1);
    expect(merged.nodes[0].name).toBe("new");
    expect(merged.done).toBe(1);
  });
});
