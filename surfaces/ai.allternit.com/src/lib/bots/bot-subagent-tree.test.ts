import { describe, expect, it } from "vitest";

import { initTranscript } from "@/components/bot-chat/transcript";
import type { BotChatTranscript, ToolCallRecord } from "@/components/bot-chat/types";
import { isSpawnTool, parseSpawnMeta, treeFromTranscript } from "./bot-subagent-tree";

function call(partial: Partial<ToolCallRecord> & Pick<ToolCallRecord, "id" | "tool">): ToolCallRecord {
  return {
    inputSummary: "",
    status: "success",
    ...partial,
  };
}

function transcriptOf(calls: ToolCallRecord[]): BotChatTranscript {
  const t = initTranscript();
  return {
    ...t,
    rows: calls.map((c) => ({
      kind: "toolCall" as const,
      id: c.id,
      createdAt: c.createdAt ?? 0,
      call: c,
    })),
  };
}

describe("isSpawnTool", () => {
  it("recognizes Task/Agent/delegate_task", () => {
    expect(isSpawnTool("Task")).toBe(true);
    expect(isSpawnTool("tool-Agent")).toBe(true);
    expect(isSpawnTool("delegate_task")).toBe(true);
    expect(isSpawnTool("computer.shell")).toBe(false);
  });
});

describe("parseSpawnMeta", () => {
  it("reads subagent_type from JSON input", () => {
    expect(
      parseSpawnMeta("Task", JSON.stringify({ subagent_type: "researcher", description: "find sources" }))
    ).toEqual({ name: "researcher", task: "find sources" });
  });
});

describe("treeFromTranscript", () => {
  it("nests tools after a spawn under that child", () => {
    const tree = treeFromTranscript(
      transcriptOf([
        call({ id: "p1", tool: "computer.shell", inputSummary: "pwd", status: "success", durationMs: 50 }),
        call({
          id: "s1",
          tool: "Task",
          inputSummary: JSON.stringify({ subagent_type: "researcher", description: "find sources" }),
          status: "success",
          durationMs: 10,
        }),
        call({ id: "s1a", tool: "Grep", inputSummary: "TODO", status: "success", durationMs: 80 }),
        call({ id: "s1b", tool: "computer.shell", inputSummary: "ls", status: "running" }),
      ]),
      "Teknium"
    );
    expect(tree.parentName).toBe("Teknium");
    expect(tree.parentSteps.map((s) => s.name)).toEqual(["computer.shell"]);
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].name).toBe("researcher");
    expect(tree.children[0].task).toBe("find sources");
    expect(tree.children[0].steps.map((s) => s.name)).toEqual(["Grep", "computer.shell"]);
    expect(tree.children[0].status).toBe("running");
    expect(tree.running).toBe(1);
    expect(tree.actions).toBeGreaterThanOrEqual(3);
  });

  it("opens a second child on the next spawn", () => {
    const tree = treeFromTranscript(
      transcriptOf([
        call({ id: "a", tool: "delegate_task", inputSummary: "Fixer: lint", status: "success" }),
        call({ id: "a1", tool: "Read", status: "success" }),
        call({ id: "b", tool: "delegate_task", inputSummary: "Rev: review", status: "running" }),
      ])
    );
    expect(tree.children.map((c) => c.name)).toEqual(["Fixer", "Rev"]);
    expect(tree.children[0].steps).toHaveLength(1);
    expect(tree.children[1].steps).toHaveLength(0);
    expect(tree.children[1].status).toBe("running");
  });
});
