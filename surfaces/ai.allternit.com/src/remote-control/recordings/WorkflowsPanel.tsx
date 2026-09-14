"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise,
  CaretRight,
  Check,
  FlowArrow,
  ListChecks,
  Play,
  ShieldCheck,
  Warning,
  X,
} from "@phosphor-icons/react";
import { useToast } from "@/hooks/use-toast";
import {
  checkVerifyReceipt,
  getVerifyResult,
  getWorkflowSpecDetail,
  listWorkflowSpecs,
  pollVerifyUntilTerminal,
  startWorkflowVerify,
  type NetworkDeviation,
  type ReceiptCheck,
  type VerifyResult,
  type WorkflowSpecDetail,
  type WorkflowSpecSummary,
} from "../api/workflows";

function statusColor(status: string): string {
  switch (status) {
    case "pass":
    case "completed":
      return "var(--status-success)";
    case "deviated":
    case "failed":
      return "var(--status-error, var(--status-danger, #ef4444))";
    case "running":
      return "var(--status-warning)";
    default:
      return "var(--ui-text-muted)";
  }
}

function shortHash(value?: string | null): string {
  if (!value) return "—";
  return value.length <= 16 ? value : `${value.slice(0, 12)}…`;
}

function DeviationRow({ deviation }: { deviation: NetworkDeviation }) {
  const shape = (entry: Partial<{ method: string; host: string; pathTemplate: string }> | null | undefined) =>
    entry && (entry.method || entry.pathTemplate)
      ? `${entry.method ?? "?"} ${entry.pathTemplate ?? ""}`.trim()
      : "—";
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-solid border-[var(--border-subtle)] last:border-b-0">
      <Warning size={14} weight="bold" className="mt-0.5 shrink-0" color="var(--status-warning)" />
      <div className="min-w-0 text-[12px]">
        <span className="font-semibold capitalize">{deviation.kind.replace(/_/g, " ")}</span>
        <span className="text-[var(--text-tertiary)]"> · recorded #{deviation.index}</span>
        {deviation.live_index != null && (
          <span className="text-[var(--text-tertiary)]"> · live #{deviation.live_index}</span>
        )}
        <div className="text-[var(--text-secondary)] font-mono truncate">
          expected {shape(deviation.expected)} → actual {shape(deviation.actual)}
        </div>
      </div>
    </div>
  );
}

interface ActiveVerify {
  verifyId: string;
  mode: string;
  result: VerifyResult | null;
  done: boolean;
}

/**
 * WorkflowsPanel — record → teach → batch → verify, surfaced.
 *
 * Lists compiled browser-workflow specs from the ACU gateway (distilled
 * shapes only), shows each spec's taught NetworkTrace, and runs the
 * deterministic verify chain: the canned self-check, or a spec'd workflow
 * against a target URL. Verdicts render network deviations (exact-match,
 * never fuzzy), the a11y diff (or an honest "unverifiable"), and a
 * content-derived receipt the operator can re-verify.
 */
export function WorkflowsPanel(): React.ReactNode {
  const { addToast } = useToast();

  const [specs, setSpecs] = useState<WorkflowSpecSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkflowSpecDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [targetUrl, setTargetUrl] = useState("");
  const [starting, setStarting] = useState(false);
  const [activeVerify, setActiveVerify] = useState<ActiveVerify | null>(null);
  const [receiptCheck, setReceiptCheck] = useState<ReceiptCheck | null>(null);
  const [checkingReceipt, setCheckingReceipt] = useState(false);

  const loadSpecs = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      setSpecs(await listWorkflowSpecs());
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Could not load workflow specs.");
      setSpecs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSpecs();
  }, [loadSpecs]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    getWorkflowSpecDetail(selectedId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDetail(null);
          setDetailError(error instanceof Error ? error.message : "Could not load this spec.");
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selectedSpec = useMemo(
    () => specs.find((s) => s.skill_id === selectedId) ?? null,
    [specs, selectedId],
  );

  // Poll the active verify to completion.
  const activeVerifyId = activeVerify?.verifyId ?? null;
  useEffect(() => {
    if (!activeVerifyId) return;
    const controller = new AbortController();
    let cancelled = false;

    pollVerifyUntilTerminal(activeVerifyId, {
      signal: controller.signal,
      onUpdate: (result) => {
        if (cancelled) return;
        setActiveVerify((prev) =>
          prev && prev.verifyId === result.verify_id ? { ...prev, result } : prev,
        );
      },
    })
      .then((final) => {
        if (cancelled) return;
        setActiveVerify((prev) =>
          prev && prev.verifyId === final.verify_id ? { ...prev, result: final, done: true } : prev,
        );
        const network = final.network?.status ?? "unknown";
        addToast({
          title: final.status === "completed" ? `Verify ${network}` : `Verify ${final.status}`,
          description:
            final.status === "completed"
              ? `Receipt ${final.receipt_id ?? "—"} · ${final.network?.deviations.length ?? 0} deviation(s)`
              : final.error ?? "The chain refused the run (fail closed).",
          type: final.status === "completed" && network === "pass" ? "success" : "warning",
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setActiveVerify((prev) => (prev ? { ...prev, done: true } : prev));
        addToast({
          title: "Verify status unavailable",
          description: error instanceof Error ? error.message : "Polling the verify failed.",
          type: "error",
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVerifyId]);

  const handleSelfCheck = async () => {
    if (activeVerify) return;
    setStarting(true);
    setReceiptCheck(null);
    try {
      const start = await startWorkflowVerify({});
      setActiveVerify({ verifyId: start.verify_id, mode: "canned", result: null, done: false });
      addToast({
        title: "Self-check started",
        description: "Record → teach → batch → verify on the canned test site (deterministic).",
        type: "info",
      });
    } catch (error) {
      addToast({
        title: "Self-check failed to start",
        description: error instanceof Error ? error.message : "Unknown error.",
        type: "error",
      });
    } finally {
      setStarting(false);
    }
  };

  const handleTargetVerify = async () => {
    if (!selectedId || activeVerify) return;
    const target = targetUrl.trim();
    if (!/^https?:\/\//i.test(target)) {
      addToast({
        title: "Target URL must be absolute http(s)",
        description: "Example: http://127.0.0.1:8080/form",
        type: "error",
      });
      return;
    }
    setStarting(true);
    setReceiptCheck(null);
    try {
      const start = await startWorkflowVerify({ skillId: selectedId, targetUrl: target });
      setActiveVerify({ verifyId: start.verify_id, mode: "target", result: null, done: false });
      addToast({
        title: "Verify started",
        description: `Batch + network verify against ${target}`,
        type: "info",
      });
    } catch (error) {
      addToast({
        title: "Verify refused",
        description: error instanceof Error ? error.message : "Unknown error.",
        type: "error",
      });
    } finally {
      setStarting(false);
    }
  };

  const handleReceiptCheck = async () => {
    if (!activeVerify) return;
    setCheckingReceipt(true);
    try {
      setReceiptCheck(await checkVerifyReceipt(activeVerify.verifyId));
    } catch (error) {
      addToast({
        title: "Receipt check failed",
        description: error instanceof Error ? error.message : "Unknown error.",
        type: "error",
      });
    } finally {
      setCheckingReceipt(false);
    }
  };

  const network = activeVerify?.result?.network ?? null;
  const a11y = activeVerify?.result?.a11y ?? null;
  const a11yCounts = a11y && "added" in a11y ? a11y : null;

  return (
    <div>
      {/* Active verify monitor */}
      {activeVerify && (
        <div className="rounded-2xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <CaretRight size={16} weight="bold" color={statusColor(activeVerify.result?.status ?? "running")} />
              <span className="text-[13px] font-semibold capitalize">
                {activeVerify.mode === "canned" ? "Self-check" : "Target verify"}
              </span>
              <code className="text-[12px] text-[var(--text-tertiary)] truncate">
                {activeVerify.verifyId}
              </code>
              <span
                className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  color: statusColor(activeVerify.result?.status ?? "running"),
                  background: "var(--surface-hover)",
                }}
              >
                {(activeVerify.result?.status ?? "running").replace(/_/g, " ")}
              </span>
            </div>
            {activeVerify.done && (
              <button
                type="button"
                onClick={() => {
                  setActiveVerify(null);
                  setReceiptCheck(null);
                }}
                className="px-2.5 py-1 rounded-lg text-[12px] font-bold border-none cursor-pointer bg-transparent"
                style={{ color: "var(--text-secondary)" }}
              >
                Dismiss
              </button>
            )}
          </div>

          {network && (
            <div className="mt-3 text-[12px] space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[var(--text-tertiary)] uppercase tracking-wider text-[11px] font-semibold">
                  Network
                </span>
                <span
                  className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ color: statusColor(network.status), background: "var(--surface-hover)" }}
                >
                  {network.status}
                </span>
                <span className="text-[var(--text-tertiary)]">
                  {network.deviations.length === 0
                    ? "exact ordered match against the recorded trace"
                    : `${network.deviations.length} deterministic deviation(s)`}
                </span>
              </div>

              {network.deviations.length > 0 && (
                <div className="rounded-xl border border-solid border-[var(--border-subtle)] p-2">
                  {network.deviations.map((deviation, i) => (
                    <DeviationRow key={i} deviation={deviation} />
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[var(--text-tertiary)] uppercase tracking-wider text-[11px] font-semibold">
                  A11y
                </span>
                {a11yCounts ? (
                  <span className="text-[var(--text-secondary)]">
                    +{a11yCounts.added} / −{a11yCounts.removed} / ~{a11yCounts.modified}
                  </span>
                ) : (
                  <span className="text-[var(--text-secondary)]">unverifiable (no recorded DOM for this target)</span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[var(--text-tertiary)] uppercase tracking-wider text-[11px] font-semibold">
                  Receipt
                </span>
                <code className="text-[var(--text-secondary)]">{activeVerify.result?.receipt_id ?? "—"}</code>
                <code className="text-[var(--text-tertiary)]" title={activeVerify.result?.receipt_hash}>
                  {shortHash(activeVerify.result?.receipt_hash)}
                </code>
                <button
                  type="button"
                  onClick={handleReceiptCheck}
                  disabled={checkingReceipt || activeVerify.result?.status !== "completed"}
                  className="px-2 py-0.5 rounded-lg text-[11px] font-bold border-none cursor-pointer"
                  style={{ background: "var(--surface-hover)", color: "var(--accent-primary)" }}
                >
                  {checkingReceipt ? "Verifying…" : "Verify hash"}
                </button>
                {receiptCheck && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold"
                    style={{ color: receiptCheck.valid ? "var(--status-success)" : "var(--status-error, #ef4444)" }}
                  >
                    {receiptCheck.valid ? <Check size={12} weight="bold" /> : <X size={12} weight="bold" />}
                    {receiptCheck.valid ? "hash verified" : "TAMPERED"}
                  </span>
                )}
              </div>
            </div>
          )}
          {activeVerify.result?.error && (
            <div className="mt-3 text-[12px]" style={{ color: "var(--status-error, #ef4444)" }}>
              {activeVerify.result.error}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_2fr]">
        {/* Spec list */}
        <div className="rounded-2xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-solid border-[var(--border-subtle)]">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              Workflow specs
            </span>
            <button
              type="button"
              onClick={loadSpecs}
              className="p-1 rounded-lg border-none cursor-pointer bg-transparent"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Refresh workflow specs"
            >
              <ArrowClockwise size={14} />
            </button>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-[12px] text-[var(--text-tertiary)]">Loading…</div>
            ) : listError ? (
              <div className="p-4 text-[12px]" style={{ color: "var(--status-error, #ef4444)" }}>
                {listError}
              </div>
            ) : specs.length === 0 ? (
              <div className="p-4 text-[12px] text-[var(--text-tertiary)]">
                No compiled workflow specs on the gateway yet. Compile a recording first
                (POST /v1/browser-skills/from-recording).
              </div>
            ) : (
              specs.map((spec) => (
                <button
                  key={spec.skill_id}
                  type="button"
                  onClick={() => setSelectedId(spec.skill_id)}
                  className="w-full text-left px-3 py-2 border-none cursor-pointer border-b border-solid border-[var(--border-subtle)] last:border-b-0"
                  style={{
                    background: selectedId === spec.skill_id ? "var(--surface-hover)" : "transparent",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <FlowArrow size={14} className="shrink-0" color="var(--accent-primary)" />
                    <span className="text-[13px] font-semibold truncate">
                      {spec.title || spec.skill_id}
                    </span>
                    {spec.hasNetworkTrace ? (
                      <ShieldCheck
                        size={13}
                        className="shrink-0 ml-auto"
                        color="var(--status-success)"
                        aria-label="Has NetworkTrace"
                      />
                    ) : (
                      <span className="ml-auto text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                        no trace
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-tertiary)] font-mono truncate">
                    {spec.workflowId ?? spec.skill_id} · {spec.stepCount ?? "?"} steps
                    {typeof spec.networkTraceEntries === "number" && ` · ${spec.networkTraceEntries} calls`}
                    {!spec.valid && " · invalid"}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Self-check */}
          <div className="p-3 border-t border-solid border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={handleSelfCheck}
              disabled={starting || !!activeVerify}
              className="w-full px-3 py-2 rounded-xl text-[12px] font-bold border-none cursor-pointer inline-flex items-center justify-center gap-2"
              style={{ background: "var(--accent-primary)", color: "var(--bg-primary)" }}
            >
              <ListChecks size={14} weight="bold" />
              Run deterministic self-check
            </button>
            <p className="mt-2 text-[11px] text-[var(--text-tertiary)] leading-relaxed">
              Record → teach → batch → verify on the canned test site, twice-checked for
              determinism. No target needed.
            </p>
          </div>
        </div>

        {/* Spec detail + target verify */}
        <div className="rounded-2xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 min-h-[200px]">
          {!selectedId ? (
            <div className="text-[12px] text-[var(--text-tertiary)]">
              Select a workflow spec to inspect its taught NetworkTrace, or run the
              self-check to exercise the whole chain.
            </div>
          ) : detailLoading ? (
            <div className="text-[12px] text-[var(--text-tertiary)]">Loading spec…</div>
          ) : detailError ? (
            <div className="text-[12px]" style={{ color: "var(--status-error, #ef4444)" }}>
              {detailError}
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div>
                <div className="text-[14px] font-semibold">{detail.title || selectedId}</div>
                <div className="text-[11px] text-[var(--text-tertiary)] font-mono">
                  {detail.workflowId} · {detail.provider ?? "unknown provider"} ·{" "}
                  {detail.stepCount ?? detail.steps.length} steps
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">
                  Taught NetworkTrace
                </div>
                {detail.networkTrace && detail.networkTrace.entries.length > 0 ? (
                  <div className="rounded-xl border border-solid border-[var(--border-subtle)] overflow-hidden">
                    {detail.networkTrace.entries.map((entry, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-mono border-b border-solid border-[var(--border-subtle)] last:border-b-0"
                      >
                        <span className="font-bold" style={{ color: "var(--accent-primary)" }}>
                          {entry.method}
                        </span>
                        <span className="truncate">
                          {entry.host}
                          {entry.pathTemplate}
                        </span>
                        <span className="ml-auto text-[10px] text-[var(--text-tertiary)] shrink-0">
                          {entry.payloadKeysHash ? `keys ${shortHash(entry.payloadKeysHash)}` : "no payload"}
                          {!entry.verifiable && " · unverifiable"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[12px] text-[var(--text-tertiary)]">
                    No NetworkTrace taught for this spec — target verify would be refused
                    (nothing to compare is never guessed).
                  </div>
                )}
              </div>

              <div className="flex items-end gap-2 flex-wrap">
                <label className="flex-1 min-w-[220px]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block mb-1">
                    Target URL
                  </span>
                  <input
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="http://127.0.0.1:8080/form"
                    className="w-full px-3 py-2 rounded-xl text-[12px] font-mono border border-solid border-[var(--border-default)]"
                    style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleTargetVerify}
                  disabled={
                    starting ||
                    !!activeVerify ||
                    !targetUrl.trim() ||
                    !detail.networkTrace ||
                    selectedSpec?.valid === false
                  }
                  className="px-4 py-2 rounded-xl text-[12px] font-bold border-none cursor-pointer inline-flex items-center gap-2"
                  style={{
                    background:
                      !detail.networkTrace || selectedSpec?.valid === false
                        ? "var(--surface-hover)"
                        : "var(--accent-primary)",
                    color:
                      !detail.networkTrace || selectedSpec?.valid === false
                        ? "var(--text-tertiary)"
                        : "var(--bg-primary)",
                  }}
                >
                  <Play size={14} weight="bold" />
                  Verify against target
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default WorkflowsPanel;
