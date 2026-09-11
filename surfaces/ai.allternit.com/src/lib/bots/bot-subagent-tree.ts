/**
 * Parent → spawned-subagent tree from transcript tool rows.
 *
 * Spawn tools (Task / Agent / delegate_task / spawn_subagent / message_agent)
 * open a child card. Later tools attach as steps of that child until the next
 * spawn. Tools before any spawn sit on the parent. The stream already emits
 * these as `onToolCall` — this module is the nesting + counts, not a new feed.
 *
 * @module bot-subagent-tree
 */

import type { BotChatTranscript, ToolCallRecord, ToolRunStatus } from "@/components/bot-chat/types";

const SPAWN_TOOLS = new Set([
  "task",
  "agent",
  "delegate_task",
  "spawn_subagent",
  "message_agent",
]);

export interface BotActivityStep {
  id: string;
  name: string;
  status: ToolRunStatus;
  durationMs?: number;
  summary?: string;
}

export interface BotActivityChild {
  id: string;
  name: string;
  task: string;
  status: ToolRunStatus;
  durationMs?: number;
  steps: BotActivityStep[];
}

export interface BotActivityTree {
  parentName: string;
  running: number;
  done: number;
  failed: number;
  actions: number;
  elapsedMs: number;
  parentSteps: BotActivityStep[];
  children: BotActivityChild[];
}

export function isSpawnTool(tool: string): boolean {
  return SPAWN_TOOLS.has(tool.replace(/^tool-/, "").toLowerCase());
}

export function parseSpawnMeta(tool: string, inputSummary: string): { name: string; task: string } {
  const fallback = tool.replace(/^tool-/, "");
  let name = fallback;
  let task = inputSummary;
  const trimmed = inputSummary.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (typeof parsed.subagent_type === "string" && parsed.subagent_type) {
        name = parsed.subagent_type;
      }
      if (typeof parsed.description === "string" && parsed.description) {
        task = parsed.description;
      } else if (typeof parsed.prompt === "string" && parsed.prompt) {
        task = parsed.prompt;
      } else if (typeof parsed.input === "string" && parsed.input) {
        task = parsed.input;
      }
    } catch {
      // keep fallback
    }
  } else {
    const colon = trimmed.indexOf(":");
    if (colon > 0 && colon < 40) {
      name = trimmed.slice(0, colon).trim() || fallback;
      task = trimmed.slice(colon + 1).trim() || trimmed;
    }
  }
  return { name, task: task.slice(0, 160) };
}

function collectCalls(transcript: BotChatTranscript): ToolCallRecord[] {
  const calls: ToolCallRecord[] = [];
  const seen = new Set<string>();
  const push = (call: ToolCallRecord) => {
    if (seen.has(call.id)) return;
    seen.add(call.id);
    calls.push(call);
  };
  for (const row of transcript.rows) {
    if (row.kind === "toolCall") push(row.call);
    if (row.kind === "toolRun") row.run.calls.forEach(push);
  }
  if (transcript.activeTurn) {
    transcript.activeTurn.pendingToolCalls.forEach(push);
  }
  return calls;
}

function rollup(statusList: ToolRunStatus[]): ToolRunStatus {
  if (statusList.some((s) => s === "running")) return "running";
  if (statusList.some((s) => s === "error")) return "error";
  return "success";
}

function toStep(call: ToolCallRecord): BotActivityStep {
  return {
    id: call.id,
    name: call.tool.replace(/^tool-/, ""),
    status: call.status,
    durationMs: call.durationMs,
    summary: call.inputSummary || call.outputSummary,
  };
}

export function treeFromTranscript(
  transcript: BotChatTranscript,
  parentName = "Bot"
): BotActivityTree {
  const calls = collectCalls(transcript);
  const parentSteps: BotActivityStep[] = [];
  const children: BotActivityChild[] = [];
  let open: BotActivityChild | null = null;

  const closeOpen = () => {
    if (!open) return;
    const statuses = [open.status, ...open.steps.map((s) => s.status)];
    open.status = rollup(statuses);
    open.durationMs = open.steps.reduce((sum, s) => sum + (s.durationMs ?? 0), open.durationMs ?? 0);
    children.push(open);
    open = null;
  };

  for (const call of calls) {
    if (isSpawnTool(call.tool)) {
      closeOpen();
      const meta = parseSpawnMeta(call.tool, call.inputSummary);
      open = {
        id: call.id,
        name: meta.name,
        task: meta.task,
        status: call.status,
        durationMs: call.durationMs,
        steps: [],
      };
      continue;
    }
    const step = toStep(call);
    if (open) open.steps.push(step);
    else parentSteps.push(step);
  }
  closeOpen();

  const headerNodes = [...parentSteps, ...children];
  let running = 0;
  let done = 0;
  let failed = 0;
  for (const node of headerNodes) {
    if (node.status === "running") running += 1;
    else if (node.status === "error") failed += 1;
    else done += 1;
  }
  const allSteps = [
    ...parentSteps,
    ...children.flatMap((c) => [toStepLike(c), ...c.steps]),
  ];

  const times = calls
    .map((c) => c.createdAt)
    .filter((t): t is number => typeof t === "number");
  const start = times.length ? Math.min(...times) : Date.now();
  const stillRunning = running > 0;
  const end = stillRunning
    ? Date.now()
    : calls.reduce((max, c) => {
        const finish = (c.createdAt ?? 0) + (c.durationMs ?? 0);
        return finish > max ? finish : max;
      }, start);

  return {
    parentName,
    running,
    done,
    failed,
    actions: allSteps.length,
    elapsedMs: Math.max(0, end - start),
    parentSteps,
    children,
  };
}

function toStepLike(child: BotActivityChild): BotActivityStep {
  return { id: child.id, name: child.name, status: child.status, durationMs: child.durationMs };
}
