"use client";

/**
 * Fabric Transport control surface (A:// §17 control conformance).
 *
 * One tight panel, wired to canonical state only:
 *   - create/observe intents (idempotent submission + resolve)
 *   - observe canonical run/job state (store rows, never narration)
 *   - approvals inbox with grant/deny and auto-decision reasons
 *   - attributed event stream (initiator/delegator/executor)
 *   - terminal results
 */

import React, { useCallback, useEffect, useState } from 'react';
import { usePlatformAuth } from '@/lib/platform-auth-client';
import {
  listRuns, listRunEvents, listRunJobs, getJob,
  listApprovals, decideApproval, submitIntent, getIntent,
  type TransportRun, TransportEvent, ApprovalRow, IntentSubmission,
} from '@/lib/fabric-transport-api';
import { cn } from '@/lib/utils';

const POLL_MS = 5000;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border-default)] p-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">{title}</h2>
      {children}
    </section>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="text-xs break-all">{children}</code>;
}

function statusColor(status: string): string {
  if (status === 'completed' || status === 'granted') return 'text-emerald-500';
  if (status === 'failed' || status === 'denied' || status === 'dead_letter') return 'text-red-500';
  if (status === 'queued' || status === 'pending') return 'text-amber-500';
  if (status === 'leased' || status === 'running') return 'text-blue-500';
  return 'text-[var(--text-muted)]';
}

export function FabricTransportView() {
  const auth = usePlatformAuth();
  const getToken = useCallback(() => auth.getToken(), [auth]);

  const [workspace, setWorkspace] = useState('ws-allternit');
  const [runs, setRuns] = useState<TransportRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [events, setEvents] = useState<TransportEvent[]>([]);
  const [jobs, setJobs] = useState<Array<{ id: string; state: string; job_type: string }>>([]);
  const [jobView, setJobView] = useState<Awaited<ReturnType<typeof getJob>> | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Intent form
  const [initiator, setInitiator] = useState('a://workspace/ws-allternit/user/joe');
  const [delegator, setDelegator] = useState('a://workspace/ws-allternit/principal/al');
  const [target, setTarget] = useState('a://workspace/ws-allternit/principal/gizzi');
  const [actionType, setActionType] = useState('shell_steps');
  const [description, setDescription] = useState('');
  const [chainInput, setChainInput] = useState('');
  const [intentResult, setIntentResult] = useState<IntentSubmission | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [runList, approvalList] = await Promise.all([
        listRuns(getToken),
        listApprovals(getToken, workspace),
      ]);
      setRuns((runList as TransportRun[]).slice(0, 25));
      setApprovals(approvalList.approvals);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [getToken, workspace]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!selectedRun) return;
    (async () => {
      try {
        const [evs, jbs] = await Promise.all([
          listRunEvents(getToken, selectedRun),
          listRunJobs(getToken, selectedRun),
        ]);
        setEvents(evs);
        setJobs(jbs);
        const withJob = jbs.find((j) => j.id);
        if (withJob) setJobView(await getJob(getToken, withJob.id));
      } catch {
        /* run may have been pruned; keep last state */
      }
    })();
  }, [getToken, selectedRun, approvals]);

  const submit = async () => {
    try {
      setError(null);
      const chain = chainInput
        ? chainInput.split(',').map((s) => s.trim()).filter(Boolean)
        : [initiator, delegator, target].filter(Boolean);
      const sub = await submitIntent(getToken, {
        workspace, initiator, delegator, target, actionType, description,
        causationChain: chain,
      });
      setIntentResult(sub);
      await refresh();
      setSelectedRun(sub.run_id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const decide = async (id: string, d: 'grant' | 'deny') => {
    try {
      setError(null);
      await decideApproval(getToken, id, d);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 text-sm">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Fabric Transport</h1>
        <div className="flex items-center gap-2">
          <input
            className="rounded border border-[var(--border-default)] bg-transparent px-2 py-1 text-xs"
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
            aria-label="Workspace"
          />
          <button className="rounded border px-2 py-1 text-xs" onClick={refresh}>Refresh</button>
        </div>
      </header>
      {error && <div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-500">{error}</div>}

      <Section title="Submit intent (create / observe)">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <label className="text-xs">Initiator<input className="mt-1 w-full rounded border border-[var(--border-default)] bg-transparent px-2 py-1" value={initiator} onChange={(e) => setInitiator(e.target.value)} /></label>
          <label className="text-xs">Delegator<input className="mt-1 w-full rounded border border-[var(--border-default)] bg-transparent px-2 py-1" value={delegator} onChange={(e) => setDelegator(e.target.value)} /></label>
          <label className="text-xs">Target (executor)<input className="mt-1 w-full rounded border border-[var(--border-default)] bg-transparent px-2 py-1" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
          <label className="text-xs">Action type<input className="mt-1 w-full rounded border border-[var(--border-default)] bg-transparent px-2 py-1" value={actionType} onChange={(e) => setActionType(e.target.value)} /></label>
          <label className="text-xs md:col-span-2">Description<input className="mt-1 w-full rounded border border-[var(--border-default)] bg-transparent px-2 py-1" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <label className="text-xs md:col-span-2">Delegation chain (comma-separated; empty = initiator→delegator→target)<input className="mt-1 w-full rounded border border-[var(--border-default)] bg-transparent px-2 py-1" value={chainInput} onChange={(e) => setChainInput(e.target.value)} /></label>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded bg-blue-600 px-3 py-1 text-white" onClick={submit}>Submit intent</button>
          {intentResult && (
            <span className="text-xs">
              <Mono>{intentResult.intent_id}</Mono> → run <Mono>{intentResult.run_id}</Mono>{' '}
              {intentResult.created ? '(created)' : '(canonical existing — idempotent replay)'}
            </span>
          )}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Runs (canonical store)">
          <ul className="space-y-1">
            {runs.map((r) => (
              <li key={r.id}>
                <button
                  className={cn('w-full rounded border px-2 py-1 text-left', selectedRun === r.id ? 'border-blue-500' : 'border-[var(--border-default)]')}
                  onClick={() => setSelectedRun(r.id)}
                >
                  <div className="flex justify-between">
                    <Mono>{r.id.slice(0, 8)}</Mono>
                    <span className={statusColor(r.state)}>{r.state}</span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {r.initiator}{r.delegator ? ` ← ${r.delegator}` : ''}
                  </div>
                </button>
              </li>
            ))}
            {runs.length === 0 && <li className="text-xs text-[var(--text-muted)]">No runs.</li>}
          </ul>
        </Section>

        <Section title="Approvals inbox (grant / deny)">
          <ul className="space-y-2">
            {approvals.map((a) => (
              <li key={a.id} className="rounded border border-[var(--border-default)] p-2 text-xs">
                <div className="flex items-center justify-between">
                  <Mono>{a.capability}</Mono>
                  <span className={statusColor(a.status)}>{a.status}</span>
                </div>
                <div className="mt-1 text-[var(--text-muted)]">
                  target <Mono>{a.target}</Mono> · executor <Mono>{a.executor}</Mono> · gen {a.lease_generation}
                </div>
                {/* Auto-decision reasons must be visible, not silent (§8). */}
                {a.decided_by && (
                  <div className="mt-1 text-[var(--text-muted)]">decided by <Mono>{a.decided_by}</Mono></div>
                )}
                {a.status === 'pending' && (
                  <div className="mt-2 flex gap-2">
                    <button className="rounded bg-emerald-600 px-2 py-0.5 text-white" onClick={() => decide(a.id, 'grant')}>Grant</button>
                    <button className="rounded bg-red-600 px-2 py-0.5 text-white" onClick={() => decide(a.id, 'deny')}>Deny</button>
                  </div>
                )}
              </li>
            ))}
            {approvals.length === 0 && <li className="text-xs text-[var(--text-muted)]">No approval bindings for this workspace.</li>}
          </ul>
        </Section>
      </div>

      {selectedRun && (
        <Section title={`Run detail — ${selectedRun.slice(0, 8)}`}>
          <div className="text-xs text-[var(--text-muted)]">
            Jobs: {jobs.map((j) => `${j.job_type}(${j.state})`).join(', ') || 'none created yet'}
          </div>
          {jobView && (
            <div className="rounded border border-[var(--border-default)] p-2 text-xs">
              <div className="flex justify-between">
                <span>Job <Mono>{jobView.job_id.slice(0, 8)}</Mono></span>
                <span className={statusColor(jobView.state)}>{jobView.state}</span>
              </div>
              {jobView.result?.result_id && (
                <div className="mt-1">
                  Result <Mono>{jobView.result.result_id}</Mono> — {jobView.result.summary}
                  <span className="text-[var(--text-muted)]"> (executor {jobView.result.executor})</span>
                </div>
              )}
            </div>
          )}
          <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[var(--text-muted)]">{e.created_at?.slice(11, 19)}</span>
                <span className="font-medium">{e.event_type}</span>
                <span className="text-[var(--text-muted)]">
                  {e.initiator && <>initiator <Mono>{e.initiator}</Mono></>}
                  {e.delegator && <> · delegator <Mono>{e.delegator}</Mono></>}
                  {e.executor && <> · executor <Mono>{e.executor}</Mono></>}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

export default FabricTransportView;
