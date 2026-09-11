"use client";

/**
 * Bot-scoped policy audit list — the "View all" surface behind the verdict
 * chips. Newest first, paginated by `limit`, rendered as a plain table with
 * the same status-dot vocabulary as the chips. Empty state in plain language:
 * this is an operator surface, not a marketing one.
 *
 * @module PolicyAuditList
 */

import React, { useCallback, useEffect, useState } from "react";
import { ArrowClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { fetchPolicyAudit, type PolicyAuditRow } from "./policy-audit";

export const POLICY_AUDIT_PAGE_SIZE = 50;

const VERDICT_DOT: Record<PolicyAuditRow["decision"], string> = {
  allowed: "var(--status-success)",
  denied: "var(--status-error)",
};

function formatTime(ts: string): string {
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return ts;
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(t).toLocaleDateString();
}

function describeAction(row: PolicyAuditRow): string {
  if (row.path) return `${row.tool} — ${row.path}`;
  if (row.host) return `${row.tool} — ${row.host}`;
  if (row.intent) return `${row.tool} — ${row.intent.slice(0, 60)}`;
  return row.tool;
}

export interface PolicyAuditListProps {
  botId: string;
}

export function PolicyAuditList({ botId }: PolicyAuditListProps) {
  const [rows, setRows] = useState<PolicyAuditRow[]>([]);
  const [limit, setLimit] = useState(POLICY_AUDIT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (pageLimit: number) => {
      setLoading(true);
      setError(null);
      try {
        const fresh = await fetchPolicyAudit(botId, pageLimit);
        setRows(fresh);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [botId]
  );

  useEffect(() => {
    void load(limit);
  }, [load, limit]);

  const hasMore = rows.length >= limit;

  return (
    <div data-policy-audit-list className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="text-xs text-[var(--text-secondary)]">
          Policy decisions for this bot, newest first. Each row was recorded
          before the action ran.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => void load(limit)}
          aria-label="Refresh policy audit"
          disabled={loading}
        >
          <ArrowClockwise size={14} className={loading ? "animate-spin" : undefined} />
        </Button>
      </div>

      {error && (
        <p className="rounded-xl border border-[var(--status-error)]/30 bg-[var(--status-error)]/8 px-3 py-2 text-xs text-[var(--status-error)]">
          Could not load the policy audit: {error}
        </p>
      )}

      {!error && rows.length === 0 && !loading && (
        <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-4 text-xs text-[var(--text-secondary)]">
          No policy decisions recorded for this bot yet. Once a policy document
          is configured on the gateway, every allowed or denied action appears
          here before it runs.
        </p>
      )}

      {rows.length > 0 && (
        <div className="overflow-y-auto rounded-xl border border-[var(--border-subtle)]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[var(--surface-panel)] text-[var(--text-tertiary)]">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Verdict</th>
                <th className="px-3 py-2 font-medium">Rule</th>
                <th className="px-3 py-2 font-medium">Actor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={`${row.ts}-${idx}`}
                  className="border-t border-[var(--border-subtle)] text-[var(--text-secondary)]"
                >
                  <td className="whitespace-nowrap px-3 py-2">{formatTime(row.ts)}</td>
                  <td className="max-w-[240px] truncate px-3 py-2" title={describeAction(row)}>
                    {describeAction(row)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 font-medium"
                      style={{
                        color:
                          row.decision === "denied"
                            ? "var(--status-error)"
                            : "var(--status-success)",
                      }}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: VERDICT_DOT[row.decision] }}
                      />
                      {row.decision}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px]">
                    {row.decision === "denied" ? (row.rule_id ?? "—") : "—"}
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2">{row.actor ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && !error && (
        <button
          type="button"
          onClick={() => setLimit((value) => value + POLICY_AUDIT_PAGE_SIZE)}
          className="mt-2 self-center rounded-lg px-3 py-1 text-[11px] font-medium text-[var(--accent-primary)] transition-colors hover:bg-[var(--surface-hover)]"
        >
          Load more
        </button>
      )}
    </div>
  );
}

export default PolicyAuditList;
