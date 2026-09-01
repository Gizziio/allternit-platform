import React, { useCallback, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ShieldCheckIcon,
  CheckmarkCircle01Icon,
  CancelCircleIcon,
  Cancel01Icon,
  Refresh01Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/lib/api-client";
import {
  type ApprovalRequestSummary,
  type ApprovalRequest,
  type ApprovalPriority,
  listApprovals,
  getApproval,
  approveApproval,
  denyApproval,
  cancelApproval,
} from "@/lib/approvals";
import { EmptyState } from "@/components/settings/EmptyState";
import { SkeletonRow } from "@/components/settings/SkeletonRow";
import { Badge } from "@/components/settings/Badge";
import { QUIET_BUTTON_CLASS } from "@/components/settings/buttonStyles";

function formatTime(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  return date.toLocaleDateString();
}

function statusColor(status: string): string {
  switch (status) {
    case "approved":
      return "text-[var(--status-success)] bg-[var(--status-success)]/10";
    case "denied":
      return "text-[var(--status-error)] bg-[var(--status-error)]/10";
    case "pending":
      return "text-[var(--accent-highlight)] bg-[var(--accent-highlight)]/10";
    case "timed_out":
    case "cancelled":
      return "text-[var(--text-tertiary)] bg-[var(--bg-primary)]";
    default:
      return "text-[var(--text-secondary)] bg-[var(--bg-primary)]";
  }
}

function priorityColor(priority: ApprovalPriority): string {
  switch (priority) {
    case "critical":
      return "text-[var(--status-error)] bg-[var(--status-error)]/10";
    case "high":
      return "text-[var(--status-warning)] bg-[var(--status-warning)]/10";
    case "low":
      return "text-[var(--accent-secondary)] bg-[var(--accent-secondary)]/10";
    default:
      return "text-[var(--text-secondary)] bg-[var(--bg-primary)]";
  }
}

export function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApprovalRequest | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listApprovals();
      setApprovals(data);
    } catch (err) {
      setError(formatApiError(err, "Unable to load approvals"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void getApproval(selectedId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) setError(formatApiError(err, "Unable to load approval details"));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const action = useCallback(
    async (id: string, fn: (id: string) => Promise<ApprovalRequestSummary>) => {
      setBusyId(id);
      setError(null);
      try {
        await fn(id);
        if (selectedId === id) {
          const updated = await getApproval(id);
          setDetail(updated);
        }
        await load();
      } catch (err) {
        setError(formatApiError(err, "Unable to update approval"));
      } finally {
        setBusyId(null);
      }
    },
    [load, selectedId]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
            Approvals
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            Review and respond to human-in-the-loop requests from active runs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={QUIET_BUTTON_CLASS}
        >
          <HugeiconsIcon
            icon={Refresh01Icon}
            size={13}
            className={cn(loading && "animate-spin")}
          />
          Refresh
        </button>
      </div>

      {error && !loading && (
        <div className="rounded-xl border border-dashed border-[var(--status-error)]/30 bg-[var(--status-error)]/10 p-4">
          <div className="flex items-start gap-2 text-[13px] text-[var(--status-error)]">
            <HugeiconsIcon icon={AlertCircleIcon} size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
          <SkeletonRow lines={5} />
        </div>
      ) : approvals.length === 0 ? (
        <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <EmptyState
            icon={<HugeiconsIcon icon={ShieldCheckIcon} size={32} />}
            title="No approval requests"
            caption="Approval requests from runs will appear here when a step asks for human input."
            ctaLabel="Refresh"
            onCtaClick={() => void load()}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase tracking-wider text-[var(--text-tertiary)]">
                  <th className="px-4 py-3 font-semibold">Request</th>
                  <th className="px-4 py-3 font-semibold">Run ID</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)]">
                {approvals.map((approval) => (
                  <tr
                    key={approval.id}
                    className={cn(
                      "border-b border-[var(--border-subtle)] last:border-0 cursor-pointer hover:bg-[var(--surface-hover)]",
                      selectedId === approval.id && "bg-[var(--surface-hover)]"
                    )}
                    onClick={() => setSelectedId(approval.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="text-[var(--text-primary)] font-medium">{approval.title}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] truncate max-w-[120px]">
                      {approval.run_id}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusColor(approval.status)}>{approval.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={priorityColor(approval.priority)}>{approval.priority}</Badge>
                    </td>
                    <td className="px-4 py-3">{formatTime(approval.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {approval.status === "pending" && (
                          <>
                            <button
                              type="button"
                              title="Approve"
                              disabled={busyId === approval.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void action(approval.id, approveApproval);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium bg-[var(--status-success)]/10 text-[var(--status-success)] hover:bg-[var(--status-success)]/20 transition-colors disabled:opacity-50"
                            >
                              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={12} />
                              Approve
                            </button>
                            <button
                              type="button"
                              title="Deny"
                              disabled={busyId === approval.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void action(approval.id, denyApproval);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error)]/10 transition-colors disabled:opacity-50"
                            >
                              <HugeiconsIcon icon={CancelCircleIcon} size={12} />
                              Deny
                            </button>
                            <button
                              type="button"
                              title="Cancel"
                              disabled={busyId === approval.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void action(approval.id, cancelApproval);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
                            >
                              <HugeiconsIcon icon={Cancel01Icon} size={12} />
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedId && (
        <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Approval details
            </h2>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              Close
            </button>
          </div>
          {detailLoading ? (
            <SkeletonRow lines={3} />
          ) : detail ? (
            <div className="space-y-3 text-[13px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">Title</div>
                  <div className="text-[var(--text-primary)] font-medium">{detail.title}</div>
                </div>
                <div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">Run ID</div>
                  <div className="text-[var(--text-primary)] font-mono text-[12px]">{detail.run_id}</div>
                </div>
                <div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">Status</div>
                  <Badge className={statusColor(detail.status)}>{detail.status}</Badge>
                </div>
                <div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">Priority</div>
                  <Badge className={priorityColor(detail.priority)}>{detail.priority}</Badge>
                </div>
              </div>
              {(detail.description || detail.reasoning) && (
                <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 space-y-2">
                  {detail.description && (
                    <div>
                      <div className="text-[11px] text-[var(--text-tertiary)]">Description</div>
                      <div className="text-[var(--text-primary)] whitespace-pre-wrap">
                        {detail.description}
                      </div>
                    </div>
                  )}
                  {detail.reasoning && (
                    <div>
                      <div className="text-[11px] text-[var(--text-tertiary)]">Reasoning</div>
                      <div className="text-[var(--text-secondary)] whitespace-pre-wrap">
                        {detail.reasoning}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {detail.status === "pending" && (
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={busyId === detail.id}
                    onClick={() => void action(detail.id, approveApproval)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--status-success)]/10 text-[var(--status-success)] hover:bg-[var(--status-success)]/20 transition-colors disabled:opacity-50"
                  >
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} size={13} />
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === detail.id}
                    onClick={() => void action(detail.id, denyApproval)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error)]/10 transition-colors disabled:opacity-50"
                  >
                    <HugeiconsIcon icon={CancelCircleIcon} size={13} />
                    Deny
                  </button>
                  <button
                    type="button"
                    disabled={busyId === detail.id}
                    onClick={() => void action(detail.id, cancelApproval)}
                    className={QUIET_BUTTON_CLASS}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={13} />
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-[var(--text-tertiary)]">Unable to load details.</p>
          )}
        </div>
      )}
    </div>
  );
}
