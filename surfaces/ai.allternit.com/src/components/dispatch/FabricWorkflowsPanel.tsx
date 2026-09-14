'use client';

/**
 * Workflows panel for Fabric Transport: record → teach → batch → verify
 * against the computer-use gateway's /v1/browser-skills surface.
 * Direct ACU on desktop/console; optional fetch transport for the PWA
 * (runtime-devices proxy to the paired machine).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowClockwise, CaretRight, Check, FlowArrow, ListChecks, Play, ShieldCheck, Warning, X } from '@phosphor-icons/react';
import { useToast } from '@/hooks/use-toast';
import {
  checkVerifyReceipt,
  getWorkflowSpecDetail,
  listWorkflowSpecs,
  pollVerifyUntilTerminal,
  startWorkflowVerify,
  type NetworkDeviation,
  type ReceiptCheck,
  type VerifyResult,
  type WorkflowSpecDetail,
  type WorkflowSpecSummary,
  type WorkflowsFetch,
} from '@/lib/browser-skills-api';
import { cn } from '@/lib/utils';

export interface FabricWorkflowsPanelProps {
  /** Override fetch (Fabric PWA runtime proxy). Omit for local ACU. */
  fetch?: WorkflowsFetch;
  /** Paired machine name shown above the panel. */
  machineLabel?: string;
  /** When set, skip the gateway and show this reason instead. */
  unavailable?: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border-default)] p-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">{title}</h2>
      {children}
    </section>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="text-xs break-all font-mono">{children}</code>;
}

function statusColor(status: string): string {
  if (status === 'completed' || status === 'granted') return 'text-emerald-500';
  if (status === 'failed' || status === 'denied' || status === 'dead_letter') return 'text-red-500';
  if (status === 'queued' || status === 'pending') return 'text-amber-500';
  if (status === 'leased' || status === 'running') return 'text-blue-500';
  return 'text-[var(--text-muted)]';
}

function shortHash(value?: string | null): string {
  if (!value) return '—';
  return value.length <= 16 ? value : `${value.slice(0, 12)}…`;
}

function networkStatusColor(status: string): string {
  if (status === 'pass') return 'text-emerald-500';
  if (status === 'deviated') return 'text-red-500';
  return 'text-[var(--text-muted)]';
}

function WorkflowDeviationRow({ deviation }: { deviation: NetworkDeviation }) {
  const shape = (entry: Partial<{ method: string; pathTemplate: string }> | null | undefined) =>
    entry && (entry.method || entry.pathTemplate)
      ? `${entry.method ?? '?'} ${entry.pathTemplate ?? ''}`.trim()
      : '—';
  return (
    <li className="flex items-start gap-2 border-b border-[var(--border-default)] py-1.5 text-xs last:border-b-0">
      <Warning size={14} weight="bold" className="mt-0.5 shrink-0 text-amber-500" />
      <div className="min-w-0">
        <span className="font-semibold capitalize">{deviation.kind.replace(/_/g, ' ')}</span>
        <span className="text-[var(--text-muted)]"> · recorded #{deviation.index}</span>
        {deviation.live_index != null && (
          <span className="text-[var(--text-muted)]"> · live #{deviation.live_index}</span>
        )}
        <div className="truncate font-mono text-[var(--text-muted)]">
          expected {shape(deviation.expected)} → actual {shape(deviation.actual)}
        </div>
      </div>
    </li>
  );
}

interface ActiveVerify {
  verifyId: string;
  mode: string;
  result: VerifyResult | null;
  done: boolean;
}

/**
 * WorkflowsSection — workflow specs, taught NetworkTraces, and the
 * deterministic verify chain (canned self-check or spec against a target URL).
 * Canonical gateway data only: distilled shapes, exact-match deviations,
 * content-derived receipts the operator can re-verify. Moved here from the
 * legacy remote-control tree in cu29; behavior identical to the cu28 panel.
 */
export function FabricWorkflowsPanel({
  fetch: fetchImpl,
  machineLabel,
  unavailable,
}: FabricWorkflowsPanelProps = {}) {
  const call = fetchImpl ? { fetch: fetchImpl } : undefined;
  const { addToast } = useToast();

  const [specs, setSpecs] = useState<WorkflowSpecSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkflowSpecDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [targetUrl, setTargetUrl] = useState('');
  const [starting, setStarting] = useState(false);
  const [activeVerify, setActiveVerify] = useState<ActiveVerify | null>(null);
  const [receiptCheck, setReceiptCheck] = useState<ReceiptCheck | null>(null);
  const [checkingReceipt, setCheckingReceipt] = useState(false);

  const loadSpecs = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      setSpecs(await listWorkflowSpecs(call));
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Could not load workflow specs.');
      setSpecs([]);
    } finally {
      setLoading(false);
    }
  }, [fetchImpl]);

  useEffect(() => {
    if (unavailable) {
      setLoading(false);
      setSpecs([]);
      setListError(null);
      return;
    }
    void loadSpecs();
  }, [loadSpecs, unavailable]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    getWorkflowSpecDetail(selectedId, call)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setDetail(null);
          setDetailError(e instanceof Error ? e.message : 'Could not load this spec.');
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Poll the active verify to a terminal verdict; abort on switch/unmount.
  const activeVerifyId = activeVerify?.verifyId ?? null;
  useEffect(() => {
    if (!activeVerifyId) return;
    const controller = new AbortController();
    let cancelled = false;

    pollVerifyUntilTerminal(activeVerifyId, {
      ...call,
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
        const network = final.network?.status ?? 'unknown';
        addToast({
          title: final.status === 'completed' ? `Verify ${network}` : `Verify ${final.status}`,
          description:
            final.status === 'completed'
              ? `Receipt ${final.receipt_id ?? '—'} · ${final.network?.deviations.length ?? 0} deviation(s)`
              : final.error ?? 'The chain refused the run (fail closed).',
          type: final.status === 'completed' && network === 'pass' ? 'success' : 'warning',
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setActiveVerify((prev) => (prev ? { ...prev, done: true } : prev));
        addToast({
          title: 'Verify status unavailable',
          description: e instanceof Error ? e.message : 'Polling the verify failed.',
          type: 'error',
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
      const start = await startWorkflowVerify({}, call);
      setActiveVerify({ verifyId: start.verify_id, mode: 'canned', result: null, done: false });
      addToast({
        title: 'Self-check started',
        description: 'Record → teach → batch → verify on the canned test site (deterministic).',
        type: 'info',
      });
    } catch (e) {
      addToast({
        title: 'Self-check failed to start',
        description: e instanceof Error ? e.message : 'Unknown error.',
        type: 'error',
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
        title: 'Target URL must be absolute http(s)',
        description: 'Example: http://127.0.0.1:8080/form',
        type: 'error',
      });
      return;
    }
    setStarting(true);
    setReceiptCheck(null);
    try {
      const start = await startWorkflowVerify({ skillId: selectedId, targetUrl: target }, call);
      setActiveVerify({ verifyId: start.verify_id, mode: 'target', result: null, done: false });
      addToast({
        title: 'Verify started',
        description: `Batch + network verify against ${target}`,
        type: 'info',
      });
    } catch (e) {
      addToast({
        title: 'Verify refused',
        description: e instanceof Error ? e.message : 'Unknown error.',
        type: 'error',
      });
    } finally {
      setStarting(false);
    }
  };

  const handleReceiptCheck = async () => {
    if (!activeVerify) return;
    setCheckingReceipt(true);
    try {
      setReceiptCheck(await checkVerifyReceipt(activeVerify.verifyId, call));
    } catch (e) {
      addToast({
        title: 'Receipt check failed',
        description: e instanceof Error ? e.message : 'Unknown error.',
        type: 'error',
      });
    } finally {
      setCheckingReceipt(false);
    }
  };

  const network = activeVerify?.result?.network ?? null;
  const a11y = activeVerify?.result?.a11y ?? null;
  const a11yCounts = a11y && 'added' in a11y ? a11y : null;
  const verifyStatus = activeVerify?.result?.status ?? 'running';

  if (unavailable) {
    return (
      <Section title="Workflows (record → teach → batch → verify)">
        {machineLabel ? (
          <p className="m-0 text-[11px] text-[var(--text-muted)]">{machineLabel}</p>
        ) : null}
        <p className="m-0 text-xs text-[var(--text-muted)]">{unavailable}</p>
      </Section>
    );
  }

  return (
    <Section title="Workflows (record → teach → batch → verify)">
      {machineLabel ? (
        <p className="m-0 text-[11px] text-[var(--text-muted)]">{machineLabel}</p>
      ) : null}
      {/* Active verify monitor */}
      {activeVerify && (
        <div className="rounded border border-[var(--border-default)] p-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <CaretRight size={14} weight="bold" className={statusColor(verifyStatus)} />
            <span className="font-semibold capitalize">
              {activeVerify.mode === 'canned' ? 'Self-check' : 'Target verify'}
            </span>
            <Mono>{activeVerify.verifyId}</Mono>
            <span className={cn('font-semibold uppercase', statusColor(verifyStatus))}>
              {verifyStatus.replace(/_/g, ' ')}
            </span>
            {activeVerify.done && (
              <button
                type="button"
                className="ml-auto rounded border px-2 py-0.5"
                onClick={() => {
                  setActiveVerify(null);
                  setReceiptCheck(null);
                }}
              >
                Dismiss
              </button>
            )}
          </div>

          {network && (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Network
                </span>
                <span className={cn('font-semibold uppercase', networkStatusColor(network.status))}>
                  {network.status}
                </span>
                <span className="text-[var(--text-muted)]">
                  {network.deviations.length === 0
                    ? 'exact ordered match against the recorded trace'
                    : `${network.deviations.length} deterministic deviation(s)`}
                </span>
              </div>

              {network.deviations.length > 0 && (
                <ul className="rounded border border-[var(--border-default)] p-2">
                  {network.deviations.map((deviation, i) => (
                    <WorkflowDeviationRow key={i} deviation={deviation} />
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  A11y
                </span>
                {a11yCounts ? (
                  <span>+{a11yCounts.added} / −{a11yCounts.removed} / ~{a11yCounts.modified}</span>
                ) : (
                  <span className="text-[var(--text-muted)]">unverifiable (no recorded DOM for this target)</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Receipt
                </span>
                <Mono>{activeVerify.result?.receipt_id ?? '—'}</Mono>
                <Mono>{shortHash(activeVerify.result?.receipt_hash)}</Mono>
                <button
                  type="button"
                  className="rounded border px-2 py-0.5"
                  disabled={checkingReceipt || activeVerify.result?.status !== 'completed'}
                  onClick={handleReceiptCheck}
                >
                  {checkingReceipt ? 'Verifying…' : 'Verify hash'}
                </button>
                {receiptCheck && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 font-semibold',
                      receiptCheck.valid ? 'text-emerald-500' : 'text-red-500',
                    )}
                  >
                    {receiptCheck.valid ? <Check size={12} weight="bold" /> : <X size={12} weight="bold" />}
                    {receiptCheck.valid ? 'hash verified' : 'TAMPERED'}
                  </span>
                )}
              </div>
            </div>
          )}
          {activeVerify.result?.error && (
            <div className="mt-2 text-red-500">{activeVerify.result.error}</div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,1fr)_2fr]">
        {/* Spec list */}
        <div className="rounded border border-[var(--border-default)]">
          <div className="flex items-center justify-between border-b border-[var(--border-default)] px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Workflow specs
            </span>
            <button
              type="button"
              onClick={loadSpecs}
              className="rounded p-1 text-[var(--text-muted)]"
              aria-label="Refresh workflow specs"
            >
              <ArrowClockwise size={14} />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-3 text-xs text-[var(--text-muted)]">Loading…</div>
            ) : listError ? (
              <div className="p-3 text-xs text-red-500">{listError}</div>
            ) : specs.length === 0 ? (
              <div className="p-3 text-xs text-[var(--text-muted)]">
                No compiled workflow specs on the gateway yet. Compile a recording first
                (POST /v1/browser-skills/from-recording).
              </div>
            ) : (
              specs.map((spec) => (
                <button
                  key={spec.skill_id}
                  type="button"
                  onClick={() => setSelectedId(spec.skill_id)}
                  className={cn(
                    'w-full border-b border-[var(--border-default)] px-3 py-2 text-left last:border-b-0',
                    selectedId === spec.skill_id ? 'bg-[var(--border-default)]/30' : '',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FlowArrow size={14} className="shrink-0 text-blue-500" />
                    <span className="truncate text-xs font-semibold">
                      {spec.title || spec.skill_id}
                    </span>
                    {spec.hasNetworkTrace ? (
                      <ShieldCheck size={13} className="ml-auto shrink-0 text-emerald-500" aria-label="Has NetworkTrace" />
                    ) : (
                      <span className="ml-auto text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                        no trace
                      </span>
                    )}
                  </div>
                  <div className="truncate font-mono text-[10px] text-[var(--text-muted)]">
                    {spec.workflowId ?? spec.skill_id} · {spec.stepCount ?? '?'} steps
                    {typeof spec.networkTraceEntries === 'number' && ` · ${spec.networkTraceEntries} calls`}
                    {!spec.valid && ' · invalid'}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Self-check */}
          <div className="border-t border-[var(--border-default)] p-3">
            <button
              type="button"
              onClick={handleSelfCheck}
              disabled={starting || !!activeVerify}
              className="inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              <ListChecks size={14} weight="bold" />
              Run deterministic self-check
            </button>
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-muted)]">
              Record → teach → batch → verify on the canned test site, twice-checked for
              determinism. No target needed.
            </p>
          </div>
        </div>

        {/* Spec detail + target verify */}
        <div className="min-h-48 rounded border border-[var(--border-default)] p-3">
          {!selectedId ? (
            <div className="text-xs text-[var(--text-muted)]">
              Select a workflow spec to inspect its taught NetworkTrace, or run the
              self-check to exercise the whole chain.
            </div>
          ) : detailLoading ? (
            <div className="text-xs text-[var(--text-muted)]">Loading spec…</div>
          ) : detailError ? (
            <div className="text-xs text-red-500">{detailError}</div>
          ) : detail ? (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold">{detail.title || selectedId}</div>
                <div className="font-mono text-[10px] text-[var(--text-muted)]">
                  {detail.workflowId} · {detail.provider ?? 'unknown provider'} ·{' '}
                  {detail.stepCount ?? detail.steps.length} steps
                </div>
              </div>

              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Taught NetworkTrace
                </div>
                {detail.networkTrace && detail.networkTrace.entries.length > 0 ? (
                  <ul className="overflow-hidden rounded border border-[var(--border-default)]">
                    {detail.networkTrace.entries.map((entry, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 border-b border-[var(--border-default)] px-3 py-1.5 font-mono text-xs last:border-b-0"
                      >
                        <span className="font-bold text-blue-500">{entry.method}</span>
                        <span className="truncate">
                          {entry.host}
                          {entry.pathTemplate}
                        </span>
                        <span className="ml-auto shrink-0 text-[10px] text-[var(--text-muted)]">
                          {entry.payloadKeysHash ? `keys ${shortHash(entry.payloadKeysHash)}` : 'no payload'}
                          {!entry.verifiable && ' · unverifiable'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-[var(--text-muted)]">
                    No NetworkTrace taught for this spec — target verify would be refused
                    (nothing to compare is never guessed).
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-52 flex-1">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Target URL
                  </span>
                  <input
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="http://127.0.0.1:8080/form"
                    className="w-full rounded border border-[var(--border-default)] bg-transparent px-2 py-1 font-mono text-xs"
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
                    specs.find((s) => s.skill_id === selectedId)?.valid === false
                  }
                  className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-1 text-xs font-bold text-white disabled:bg-[var(--border-default)] disabled:text-[var(--text-muted)]"
                >
                  <Play size={14} weight="bold" />
                  Verify against target
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
