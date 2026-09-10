"use client";

/**
 * Structured policy editor for bot-mode sessions.
 *
 * Task A ships no PUT /api/aci/policy, so save is a validated JSON document
 * plus a copy / save-to-ALLTERNIT_ACI_POLICY_FILE instruction. Validation
 * mirrors the gateway loader (`validatePolicyRules`).
 *
 * @module PolicyEditor
 */

import React, { useMemo, useState } from "react";
import { CaretDown, Copy, Plus, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  POLICY_ACTIONS,
  POLICY_PRESETS,
  buildPolicyDocument,
  emptyRuleDraft,
  validatePolicyRules,
  type PolicyAction,
  type PolicyRuleDraft,
} from "./policy-audit";

export interface PolicyEditorProps {
  defaultBotId?: string;
}

const FIELD_CLASS =
  "h-8 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2 text-xs";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
      {label}
      {children}
    </label>
  );
}

export function PolicyEditor({ defaultBotId }: PolicyEditorProps) {
  const [rules, setRules] = useState<PolicyRuleDraft[]>(() => [
    { ...emptyRuleDraft(), botId: defaultBotId ?? "" },
  ]);
  const [advanced, setAdvanced] = useState(false);
  const [rawJson, setRawJson] = useState("");
  const [rawError, setRawError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const issues = useMemo(() => validatePolicyRules(rules), [rules]);
  const document = useMemo(() => buildPolicyDocument(rules), [rules]);

  const updateRule = (index: number, patch: Partial<PolicyRuleDraft>) => {
    setRules((current) =>
      current.map((rule, i) => (i === index ? { ...rule, ...patch } : rule))
    );
  };

  const addRule = () => {
    setRules((current) => [
      ...current,
      { ...emptyRuleDraft(), botId: defaultBotId ?? "" },
    ]);
  };

  const removeRule = (index: number) => {
    setRules((current) =>
      current.length === 1
        ? [{ ...emptyRuleDraft(), botId: defaultBotId ?? "" }]
        : current.filter((_, i) => i !== index)
    );
  };

  const insertPreset = (presetIndex: number) => {
    const preset = POLICY_PRESETS[presetIndex];
    if (!preset) return;
    setRules((current) => {
      const isBlank =
        current.length === 0 ||
        (current.length === 1 &&
          !current[0].id &&
          !current[0].tool &&
          !current[0].action);
      return isBlank ? preset.rules.map((rule) => ({ ...rule })) : [...current, ...preset.rules.map((rule) => ({ ...rule }))];
    });
  };

  const applyRawJson = () => {
    try {
      const parsed = JSON.parse(rawJson) as { rules?: Array<Record<string, string>> };
      if (!parsed || !Array.isArray(parsed.rules)) {
        setRawError("JSON must be an object with a `rules` array.");
        return;
      }
      const next: PolicyRuleDraft[] = parsed.rules.map((rule) => ({
        ...emptyRuleDraft(),
        id: rule.id ?? "",
        tool: rule.tool ?? "",
        action: (rule.action as PolicyAction | "") || "",
        intent: rule.intent ?? "",
        botId: rule.botId ?? rule.bot_id ?? "",
        networkHost: rule.networkHost ?? rule.network_host ?? "",
        filePath: rule.filePath ?? rule.file_path ?? "",
        mcpTool: rule.mcpTool ?? rule.mcp_tool ?? "",
      }));
      setRules(next.length ? next : [emptyRuleDraft()]);
      setRawError(null);
    } catch (err) {
      setRawError(err instanceof Error ? err.message : "Could not parse JSON.");
    }
  };

  const copyDocument = async () => {
    try {
      await navigator.clipboard.writeText(document);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div data-policy-editor className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[var(--text-primary)]">Policy rules</p>
        <Button type="button" variant="outline" size="sm" onClick={addRule} data-testid="policy-editor-add">
          <Plus size={12} />
          Add rule
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {POLICY_PRESETS.map((preset, index) => (
          <button
            key={preset.label}
            type="button"
            data-testid={`policy-editor-preset-${preset.label}`}
            onClick={() => insertPreset(index)}
            title={preset.description}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2 py-1 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {rules.map((rule, index) => (
          <div
            key={`rule-${index}`}
            data-testid={`policy-editor-rule-${index}`}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                Rule {index + 1}
              </span>
              <button
                type="button"
                onClick={() => removeRule(index)}
                aria-label={`Remove rule ${index + 1}`}
                className="rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--status-error)]"
              >
                <Trash size={12} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Field label="Id">
                <Input
                  aria-label={`Rule ${index + 1} id`}
                  className={FIELD_CLASS}
                  value={rule.id}
                  onChange={(e) => updateRule(index, { id: e.target.value })}
                />
              </Field>
              <Field label="Tool glob">
                <Input
                  aria-label={`Rule ${index + 1} tool`}
                  className={FIELD_CLASS}
                  placeholder="computer.shell"
                  value={rule.tool}
                  onChange={(e) => updateRule(index, { tool: e.target.value })}
                />
              </Field>
              <Field label="Action">
                <select
                  aria-label={`Rule ${index + 1} action`}
                  className={cn(FIELD_CLASS, "text-[var(--text-primary)]")}
                  value={rule.action}
                  onChange={(e) =>
                    updateRule(index, { action: e.target.value as PolicyAction | "" })
                  }
                >
                  <option value="">Select…</option>
                  {POLICY_ACTIONS.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Intent">
                <Input
                  aria-label={`Rule ${index + 1} intent`}
                  className={FIELD_CLASS}
                  value={rule.intent}
                  onChange={(e) => updateRule(index, { intent: e.target.value })}
                />
              </Field>
              <Field label="Bot id">
                <Input
                  aria-label={`Rule ${index + 1} botId`}
                  className={FIELD_CLASS}
                  value={rule.botId}
                  onChange={(e) => updateRule(index, { botId: e.target.value })}
                />
              </Field>
              <Field label="Network host">
                <Input
                  aria-label={`Rule ${index + 1} networkHost`}
                  className={FIELD_CLASS}
                  value={rule.networkHost}
                  onChange={(e) => updateRule(index, { networkHost: e.target.value })}
                />
              </Field>
              <Field label="File path">
                <Input
                  aria-label={`Rule ${index + 1} filePath`}
                  className={FIELD_CLASS}
                  value={rule.filePath}
                  onChange={(e) => updateRule(index, { filePath: e.target.value })}
                />
              </Field>
              <Field label="MCP tool">
                <Input
                  aria-label={`Rule ${index + 1} mcpTool`}
                  className={FIELD_CLASS}
                  value={rule.mcpTool}
                  onChange={(e) => updateRule(index, { mcpTool: e.target.value })}
                />
              </Field>
            </div>
          </div>
        ))}
      </div>

      {issues.length > 0 && (
        <ul
          data-testid="policy-editor-issues"
          className="rounded-xl border border-[var(--status-error)]/30 bg-[var(--status-error)]/8 px-3 py-2 text-xs text-[var(--status-error)]"
        >
          {issues.map((issue) => (
            <li key={`${issue.index}-${issue.reason}`}>
              Rule {issue.index + 1} ({issue.id}): {issue.reason}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        data-testid="policy-editor-advanced"
        onClick={() => {
          setAdvanced((value) => !value);
          setRawJson(document);
          setRawError(null);
        }}
        className="inline-flex items-center gap-1 self-start text-[11px] text-[var(--text-secondary)]"
      >
        <CaretDown size={12} className={advanced ? "rotate-180" : undefined} />
        Advanced JSON
      </button>

      {advanced && (
        <div className="flex flex-col gap-2">
          <textarea
            data-testid="policy-editor-json"
            aria-label="Raw policy JSON"
            className="min-h-[140px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 font-mono text-[11px] text-[var(--text-primary)]"
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
          />
          {rawError && (
            <p className="text-xs text-[var(--status-error)]">{rawError}</p>
          )}
          <Button type="button" variant="outline" size="sm" onClick={applyRawJson}>
            Apply JSON
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs text-[var(--text-secondary)]">
            There is no policy write API. Copy this document and save it at the
            path named by <code className="font-mono">ALLTERNIT_ACI_POLICY_FILE</code>,
            then restart the sidecar. A malformed file refuses startup.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copyDocument()}
            data-testid="policy-editor-copy"
            disabled={issues.length > 0}
          >
            <Copy size={12} />
            {copied ? "Copied" : "Copy JSON"}
          </Button>
        </div>
        <pre
          data-testid="policy-editor-document"
          className="max-h-48 overflow-auto rounded-lg bg-[var(--surface-panel)] p-2 font-mono text-[11px] text-[var(--text-secondary)]"
        >
          {document}
        </pre>
      </div>
    </div>
  );
}

export default PolicyEditor;
