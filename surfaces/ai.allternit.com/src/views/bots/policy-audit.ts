/**
 * Policy audit client for the bot-mode governance surfaces.
 *
 * Read side: `GET /api/aci/policy/audit` (Task A), bot-scoped, newest first.
 * Write side: Task A ships no policy write endpoint, so the editor produces a
 * validated policy document for the operator to save at the path named by
 * `ALLTERNIT_ACI_POLICY_FILE` — this module holds the validation that mirrors
 * the gateway loader (`policy_config::PolicyLoadError`) so a rule that would
 * refuse startup is flagged in the UI before it ever reaches the gateway.
 *
 * @module policy-audit
 */

import { api } from "@/integration/api-client";

export interface PolicyAuditRow {
  ts: string;
  decision: "allowed" | "denied";
  rule_id?: string;
  bot_id?: string;
  session_id?: string;
  actor?: string;
  tool: string;
  intent?: string;
  host?: string;
  path?: string;
  mcp_tool?: string;
  run_id?: string;
}

export interface PolicyAuditResponse {
  rows?: PolicyAuditRow[];
}

export async function fetchPolicyAudit(botId: string, limit = 100): Promise<PolicyAuditRow[]> {
  const query = `bot_id=${encodeURIComponent(botId)}&limit=${limit}`;
  const resp = await api.get<PolicyAuditResponse>(`/api/aci/policy/audit?${query}`);
  return resp?.rows ?? [];
}

// ─── Policy document model + validation (mirrors the gateway loader) ─────────

export type PolicyAction = "allow" | "deny" | "ask";

export const POLICY_ACTIONS: PolicyAction[] = ["allow", "deny", "ask"];

/** One editable rule. Mirrors `permission_policy::PermissionRule`. */
export interface PolicyRuleDraft {
  id: string;
  tool: string;
  action: PolicyAction | "";
  intent: string;
  botId: string;
  networkHost: string;
  filePath: string;
  mcpTool: string;
}

export function emptyRuleDraft(): PolicyRuleDraft {
  return {
    id: "",
    tool: "",
    action: "",
    intent: "",
    botId: "",
    networkHost: "",
    filePath: "",
    mcpTool: "",
  };
}

export interface PolicyRuleIssue {
  /** 1-based rule position, for display. */
  index: number;
  id: string;
  reason: string;
}

/**
 * Client-side mirror of the gateway loader checks: every rule needs an id,
 * a `tool` glob, and an action in {allow, deny, ask}. Error wording follows
 * `PolicyLoadError` so the message a user sees here matches what the gateway
 * would log at startup.
 */
export function validatePolicyRules(rules: PolicyRuleDraft[]): PolicyRuleIssue[] {
  const issues: PolicyRuleIssue[] = [];
  rules.forEach((rule, index) => {
    const label = rule.id.trim() || `(index ${index})`;
    if (!rule.id.trim()) {
      issues.push({ index, id: label, reason: "rule has no `id`" });
    }
    if (!rule.tool.trim()) {
      issues.push({ index, id: label, reason: "rule has no `tool` glob" });
    }
    if (!rule.action) {
      issues.push({ index, id: label, reason: "rule has no `action`" });
    } else if (!POLICY_ACTIONS.includes(rule.action)) {
      issues.push({
        index,
        id: label,
        reason: `unknown action \`${rule.action}\` (expected allow|deny|ask)`,
      });
    }
  });
  return issues;
}

/** Build the JSON document the gateway loads. Invalid drafts are omitted. */
export function buildPolicyDocument(rules: PolicyRuleDraft[]): string {
  const doc = {
    rules: rules
      .filter((rule) => rule.id.trim() && rule.tool.trim() && POLICY_ACTIONS.includes(rule.action as PolicyAction))
      .map((rule) => {
        const out: Record<string, string> = {
          id: rule.id.trim(),
          tool: rule.tool.trim(),
          action: rule.action,
        };
        if (rule.intent.trim()) out.intent = rule.intent.trim();
        if (rule.botId.trim()) out.botId = rule.botId.trim();
        if (rule.networkHost.trim()) out.networkHost = rule.networkHost.trim();
        if (rule.filePath.trim()) out.filePath = rule.filePath.trim();
        if (rule.mcpTool.trim()) out.mcpTool = rule.mcpTool.trim();
        return out;
      }),
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

// ─── Presets ──────────────────────────────────────────────────────────────────

export interface PolicyPreset {
  label: string;
  description: string;
  rules: PolicyRuleDraft[];
}

export const POLICY_PRESETS: PolicyPreset[] = [
  {
    label: "Deny dangerous shell",
    description: "Refuse shell actions whose intent matches destructive removal.",
    rules: [
      {
        ...emptyRuleDraft(),
        id: "deny-destructive-shell",
        tool: "computer.shell",
        action: "deny",
        intent: "*rm -rf*",
      },
    ],
  },
  {
    label: "Allow browse only",
    description: "Permit browser runs, ask before any shell or file write.",
    rules: [
      {
        ...emptyRuleDraft(),
        id: "ask-shell",
        tool: "computer.shell",
        action: "ask",
      },
      {
        ...emptyRuleDraft(),
        id: "ask-file-writes",
        tool: "computer.file_write",
        action: "ask",
      },
      {
        ...emptyRuleDraft(),
        id: "allow-runs",
        tool: "aci.run",
        action: "allow",
      },
    ],
  },
  {
    label: "Ask before file writes",
    description: "Route every file write through the approval grant flow.",
    rules: [
      {
        ...emptyRuleDraft(),
        id: "ask-file-writes",
        tool: "computer.file_write",
        action: "ask",
      },
    ],
  },
];
