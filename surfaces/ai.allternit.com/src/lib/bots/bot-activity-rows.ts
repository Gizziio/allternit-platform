/**
 * Format policy-audit rows as compact tool-call lines for the bot watch strip.
 * These sit beside the dialogue, not inside it.
 *
 * @module bot-activity-rows
 */

import type { PolicyAuditRow } from "@/views/bots/policy-audit";

export interface BotActivityLine {
  key: string;
  tool: string;
  decision: PolicyAuditRow["decision"];
  ruleId?: string;
  when: string;
}

function shortTool(tool: string): string {
  const parts = tool.split(".");
  return parts[parts.length - 1] || tool;
}

function relative(ts: string, now: number): string {
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return ts;
  const min = Math.floor((now - t) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

export function formatActivityLines(
  rows: PolicyAuditRow[],
  now = Date.now(),
  limit = 6
): BotActivityLine[] {
  return rows.slice(0, limit).map((row, index) => ({
    key: `${row.ts}-${row.tool}-${index}`,
    tool: shortTool(row.tool),
    decision: row.decision,
    ruleId: row.decision === "denied" ? row.rule_id : undefined,
    when: relative(row.ts, now),
  }));
}

export function activityCounts(rows: PolicyAuditRow[]): {
  allowed: number;
  denied: number;
} {
  let allowed = 0;
  let denied = 0;
  for (const row of rows) {
    if (row.decision === "denied") denied += 1;
    else allowed += 1;
  }
  return { allowed, denied };
}
