/**
 * Compact activity tree from the bot transcript's tool rows.
 * This is the parent-bot tool/subagent ladder we can show without a
 * separate subagent event feed.
 *
 * @module bot-subagent-tree
 */

import type { BotChatTranscript, ToolCallRecord } from "@/components/bot-chat/types";

export interface BotActivityNode {
  id: string;
  name: string;
  status: "running" | "success" | "error";
  durationMs?: number;
}

export interface BotActivityTree {
  running: number;
  done: number;
  failed: number;
  nodes: BotActivityNode[];
}

function collectCalls(transcript: BotChatTranscript): ToolCallRecord[] {
  const calls: ToolCallRecord[] = [];
  for (const row of transcript.rows) {
    if (row.kind === "toolCall") calls.push(row.call);
    if (row.kind === "toolRun") calls.push(...row.run.calls);
  }
  if (transcript.activeTurn) {
    calls.push(...transcript.activeTurn.pendingToolCalls);
  }
  return calls;
}

export function treeFromTranscript(transcript: BotChatTranscript): BotActivityTree {
  const calls = collectCalls(transcript);
  let running = 0;
  let done = 0;
  let failed = 0;
  const nodes: BotActivityNode[] = calls.map((call) => {
    if (call.status === "running") running += 1;
    else if (call.status === "error") failed += 1;
    else done += 1;
    return {
      id: call.id,
      name: call.tool,
      status: call.status,
      durationMs: call.durationMs,
    };
  });
  return { running, done, failed, nodes: nodes.slice(-8) };
}
