import { describe, expect, it } from "vitest";

import {
  POLICY_PRESETS,
  buildPolicyDocument,
  emptyRuleDraft,
  validatePolicyRules,
} from "./policy-audit";

describe("validatePolicyRules", () => {
  it("rejects missing id, tool, and action", () => {
    const issues = validatePolicyRules([emptyRuleDraft()]);
    expect(issues.map((issue) => issue.reason)).toEqual(
      expect.arrayContaining([
        "rule has no `id`",
        "rule has no `tool` glob",
        "rule has no `action`",
      ])
    );
  });

  it("rejects an unknown action", () => {
    const issues = validatePolicyRules([
      {
        ...emptyRuleDraft(),
        id: "x",
        tool: "computer.shell",
        action: "explode" as never,
      },
    ]);
    expect(issues[0]?.reason).toContain("unknown action `explode`");
  });

  it("accepts a preset rule", () => {
    expect(validatePolicyRules(POLICY_PRESETS[0].rules)).toEqual([]);
  });
});

describe("buildPolicyDocument", () => {
  it("omits invalid drafts and keeps optional fields", () => {
    const json = buildPolicyDocument([
      emptyRuleDraft(),
      {
        id: "deny-shell",
        tool: "computer.shell",
        action: "deny",
        intent: "*rm -rf*",
        botId: "bot-1",
        networkHost: "",
        filePath: "",
        mcpTool: "",
      },
    ]);
    const parsed = JSON.parse(json) as { rules: Array<Record<string, string>> };
    expect(parsed.rules).toHaveLength(1);
    expect(parsed.rules[0]).toEqual({
      id: "deny-shell",
      tool: "computer.shell",
      action: "deny",
      intent: "*rm -rf*",
      botId: "bot-1",
    });
  });
});
