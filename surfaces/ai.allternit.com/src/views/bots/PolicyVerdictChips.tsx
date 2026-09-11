"use client";

/**
 * Policy verdict chips — the compact, always-visible policy timeline for an
 * open bot session. Polls the Task A audit API every ~3s while mounted
 * (paused when the tab is hidden, cleared on unmount) and merges the newest
 * decisions into one chip row. No SSE transport: the same API the audit list
 * uses, at chip granularity.
 *
 * @module PolicyVerdictChips
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, Warning } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { fetchPolicyAudit, type PolicyAuditRow } from "./policy-audit";

export const POLICY_CHIP_POLL_MS = 3000;
export const POLICY_CHIP_MAX = 10;

export interface PolicyVerdictChipsProps {
  botId: string;
  onViewAll?: () => void;
}

const STATUS_DOT: Record<PolicyAuditRow["decision"], string> = {
  allowed: "var(--status-success)",
  denied: "var(--status-error)",
};

function shortTool(tool: string): string {
  // Keep chips compact: last segment of dotted tool names.
  const parts = tool.split(".");
  return parts[parts.length - 1] || tool;
}

export function PolicyVerdictChips({ botId, onViewAll }: PolicyVerdictChipsProps) {
  const [rows, setRows] = useState<PolicyAuditRow[]>([]);
  const [feedError, setFeedError] = useState(false);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const fresh = await fetchPolicyAudit(botId, POLICY_CHIP_MAX);
      if (!mountedRef.current) return;
      setRows(fresh);
      setFeedError(false);
    } catch {
      if (!mountedRef.current) return;
      setFeedError(true);
    }
  }, [botId]);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    const interval = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void load();
    }, POLICY_CHIP_POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [load]);

  return (
    <div
      data-policy-chips
      className="flex items-center gap-2 overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-1.5"
      aria-label="Recent policy decisions"
    >
      <ShieldCheck size={14} className="shrink-0 text-[var(--text-tertiary)]" aria-hidden />
      {feedError && (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-medium"
          style={{ background: "var(--surface-hover)", color: "var(--status-warning)" }}
          title="The policy audit feed could not be reached. Decisions are still enforced on the gateway."
        >
          <span className="size-1.5 rounded-full" style={{ background: "var(--status-warning)" }} />
          <Warning size={10} aria-hidden />
          audit feed unavailable
        </span>
      )}
      {rows.length === 0 && !feedError ? (
        <span className="text-[10px] text-[var(--text-tertiary)]">
          No policy decisions yet
        </span>
      ) : (
        rows.slice(0, POLICY_CHIP_MAX).map((row, idx) => (
          <span
            key={`${row.ts}-${row.tool}-${idx}`}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-medium",
              row.decision === "denied" && "border border-[var(--status-error)]/30"
            )}
            style={{
              background: "var(--surface-hover)",
              color:
                row.decision === "denied"
                  ? "var(--status-error)"
                  : "var(--text-secondary)",
            }}
            title={
              row.decision === "denied"
                ? `${row.tool} denied by rule ${row.rule_id ?? "(no rule id)"}`
                : `${row.tool} allowed${row.rule_id ? ` by rule ${row.rule_id}` : ""}`
            }
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: STATUS_DOT[row.decision] }}
            />
            {shortTool(row.tool)}
            <span className="uppercase">{row.decision}</span>
            {row.decision === "denied" && row.rule_id ? <span>· {row.rule_id}</span> : null}
          </span>
        ))
      )}
      {onViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium text-[var(--accent-primary)] transition-colors hover:bg-[var(--surface-hover)]"
        >
          {rows.length > 0 ? "View all" : "Policy"}
        </button>
      )}
    </div>
  );
}

export default PolicyVerdictChips;
