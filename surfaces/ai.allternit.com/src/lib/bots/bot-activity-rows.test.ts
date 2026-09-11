import { describe, expect, it } from "vitest";

import { activityCounts, formatActivityLines } from "./bot-activity-rows";
import type { PolicyAuditRow } from "@/views/bots/policy-audit";

const rows: PolicyAuditRow[] = [
  {
    ts: "2026-09-10T18:00:00.000Z",
    decision: "allowed",
    tool: "computer.shell",
  },
  {
    ts: "2026-09-10T17:00:00.000Z",
    decision: "denied",
    tool: "aci.run",
    rule_id: "deny-runs",
  },
];

describe("formatActivityLines", () => {
  it("shortens the tool and keeps denied rule ids", () => {
    const now = Date.parse("2026-09-10T18:00:30.000Z");
    const lines = formatActivityLines(rows, now);
    expect(lines[0]).toMatchObject({ tool: "shell", decision: "allowed" });
    expect(lines[1]).toMatchObject({
      tool: "run",
      decision: "denied",
      ruleId: "deny-runs",
    });
  });
});

describe("activityCounts", () => {
  it("counts allowed and denied", () => {
    expect(activityCounts(rows)).toEqual({ allowed: 1, denied: 1 });
  });
});
