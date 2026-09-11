/**
 * BA-5 spawned-child event feed: live subagents of a parent bot, merged with
 * the transcript tree. Uses GET /api/v1/agents/:id/subagents plus
 * parent-scoped ledger events (parent_agent_id on the event payload).
 */

import { api } from "@/integration/api-client";
import type { BotChatTranscript } from "@/components/bot-chat/types";
import type { BotActivityChild, BotActivityTree } from "./bot-subagent-tree";
import { treeFromTranscript } from "./bot-subagent-tree";

export interface SubagentRow {
  id: string;
  name: string;
  status: string;
  mode?: string;
  parent_agent_id?: string | null;
}

export interface SubagentEvent {
  event_type: string;
  agent_id?: string;
  run_id?: string;
  data?: Record<string, unknown>;
}

function statusFromAgent(status: string): BotActivityChild["status"] {
  const s = status.toLowerCase();
  if (s === "working" || s === "running") return "running";
  if (s === "error" || s === "failed" || s === "blocked") return "error";
  return "success";
}

function emptyTree(parentName: string): BotActivityTree {
  return {
    parentName,
    running: 0,
    done: 0,
    failed: 0,
    actions: 0,
    elapsedMs: 0,
    parentSteps: [],
    children: [],
  };
}

function recount(tree: BotActivityTree): BotActivityTree {
  const header = [...tree.parentSteps, ...tree.children];
  return {
    ...tree,
    running: header.filter((n) => n.status === "running").length,
    done: header.filter((n) => n.status === "success").length,
    failed: header.filter((n) => n.status === "error").length,
    actions: tree.parentSteps.length + tree.children.reduce((n, c) => n + 1 + c.steps.length, 0),
  };
}

export function childrenFromSubagents(rows: SubagentRow[]): BotActivityChild[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    task: row.mode ?? "",
    status: statusFromAgent(row.status),
    steps: [],
  }));
}

export function mergeActivityTrees(base: BotActivityTree, extraChildren: BotActivityChild[]): BotActivityTree {
  const byId = new Map(base.children.map((c) => [c.id, c]));
  for (const child of extraChildren) {
    const existing = byId.get(child.id);
    if (existing) {
      byId.set(child.id, {
        ...existing,
        name: child.name || existing.name,
        status: child.status === "running" ? "running" : existing.status,
      });
    } else {
      byId.set(child.id, child);
    }
  }
  return recount({ ...base, children: [...byId.values()] });
}

export async function fetchSubagentFeed(parentId: string): Promise<SubagentRow[]> {
  const body = await api.get<{ subagents?: SubagentRow[] }>(
    `/api/v1/agents/${encodeURIComponent(parentId)}/subagents`,
  );
  return body.subagents ?? [];
}

export function liveActivityTree(
  transcript: BotChatTranscript | null | undefined,
  subagents: SubagentRow[],
  parentName = "Bot",
): BotActivityTree {
  const base = transcript ? treeFromTranscript(transcript, parentName) : emptyTree(parentName);
  return mergeActivityTrees(base, childrenFromSubagents(subagents));
}
