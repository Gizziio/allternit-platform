/**
 * BA-5 spawned-child event feed: live subagents of a parent bot, merged with
 * the transcript tool ladder. Uses GET /api/v1/agents/:id/subagents plus
 * parent-scoped ledger events (parent_agent_id on the event payload).
 */

import { api } from "@/integration/api-client";
import type { BotActivityNode, BotActivityTree } from "./bot-subagent-tree";
import { treeFromTranscript } from "./bot-subagent-tree";
import type { BotChatTranscript } from "@/components/bot-chat/types";

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

function statusFromAgent(status: string): BotActivityNode["status"] {
  const s = status.toLowerCase();
  if (s === "working" || s === "running") return "running";
  if (s === "error" || s === "failed" || s === "blocked") return "error";
  return "success";
}

export function treeFromSubagents(rows: SubagentRow[]): BotActivityTree {
  let running = 0;
  let done = 0;
  let failed = 0;
  const nodes: BotActivityNode[] = rows.map((row) => {
    const status = statusFromAgent(row.status);
    if (status === "running") running += 1;
    else if (status === "error") failed += 1;
    else done += 1;
    return { id: row.id, name: row.name, status };
  });
  return { running, done, failed, nodes };
}

export function mergeActivityTrees(...trees: BotActivityTree[]): BotActivityTree {
  const byId = new Map<string, BotActivityNode>();
  for (const tree of trees) {
    for (const node of tree.nodes) byId.set(node.id, node);
  }
  const nodes = [...byId.values()];
  return {
    running: nodes.filter((n) => n.status === "running").length,
    done: nodes.filter((n) => n.status === "success").length,
    failed: nodes.filter((n) => n.status === "error").length,
    nodes: nodes.slice(-12),
  };
}

export function treeFromEvents(events: SubagentEvent[]): BotActivityTree {
  const nodes: BotActivityNode[] = [];
  for (const event of events) {
    const id =
      (typeof event.data?.subagent_id === "string" && event.data.subagent_id) ||
      event.agent_id ||
      event.run_id;
    if (!id) continue;
    const name =
      (typeof event.data?.name === "string" && event.data.name) ||
      event.event_type;
    const status = statusFromAgent(String(event.data?.status ?? event.event_type));
    nodes.push({ id, name, status });
  }
  return mergeActivityTrees({ running: 0, done: 0, failed: 0, nodes });
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
  events: SubagentEvent[] = [],
): BotActivityTree {
  const fromTranscript = transcript
    ? treeFromTranscript(transcript)
    : { running: 0, done: 0, failed: 0, nodes: [] };
  return mergeActivityTrees(fromTranscript, treeFromSubagents(subagents), treeFromEvents(events));
}
