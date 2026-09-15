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
 *   - workflow specs + network-trace verify (ACU gateway /v1/browser-skills,
 *     distilled shapes only; cu28/cu29)
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  listRuns, listRunEvents, listRunJobs, getJob,
  listApprovals, decideApproval, submitIntent, getIntent,
  listPrincipals, provisionPrincipalToken,
  listDelegationRules, upsertDelegationRule, deleteDelegationRule,
  listConnectorSessions,
  listRoutines, createRoutine, deleteRoutine, runRoutineNow,
  continueRunInCloud, getCoworkPreferences, setCloudContinuation,
  type TransportRun, TransportEvent, ApprovalRow, IntentSubmission,
  type PrincipalRow, DelegationRuleRow, ConnectorSessionRow, RoutineRow,
} from '@/lib/fabric-transport-api';
import { FabricWorkflowsPanel } from '@/components/dispatch/FabricWorkflowsPanel';
import { cn } from '@/lib/utils';
import { usePlatformAuth } from '@/lib/platform-auth-client';

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

  // P-T6 control-surface state
  const [principals, setPrincipals] = useState<PrincipalRow[]>([]);
  const [provisionedToken, setProvisionedToken] = useState<{ principal: string; token: string } | null>(null);
  const [rules, setRules] = useState<DelegationRuleRow[]>([]);
  const [ruleAction, setRuleAction] = useState('shell');
  const [ruleTarget, setRuleTarget] = useState('gizzi');
  const [rulePriority, setRulePriority] = useState('100');
  const [sessions, setSessions] = useState<ConnectorSessionRow[]>([]);
  const [routines, setRoutines] = useState<RoutineRow[]>([]);
  const [routineName, setRoutineName] = useState('');
  const [routineMessage, setRoutineMessage] = useState('');
  const [routineSchedule, setRoutineSchedule] = useState('*/30');
  const [cloudContinuation, setCloudContinuationPref] = useState(false);
  const [continuationApiUrl, setContinuationApiUrl] = useState('');

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
      const [runList, approvalList, principalList, ruleList, sessionList, routineList, prefs] = await Promise.all([
        listRuns(getToken),
        listApprovals(getToken, workspace),
        listPrincipals(getToken, workspace),
        listDelegationRules(getToken, workspace),
        listConnectorSessions(getToken),
        listRoutines(getToken),
        getCoworkPreferences(getToken).catch(() => ({ cloud_continuation: false, trusted_folders: [] as string[], continuation_api_url: null })),
      ]);
      setRuns((runList as TransportRun[]).slice(0, 25));
      setApprovals(approvalList.approvals);
      setPrincipals(principalList.principals);
      setRules(ruleList.rules);
      setSessions(sessionList.sessions.slice(0, 25));
      setRoutines(routineList.routines);
      setCloudContinuationPref(Boolean(prefs.cloud_continuation));
      if (prefs.continuation_api_url) setContinuationApiUrl(prefs.continuation_api_url);
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

  const provision = async (principalId: string) => {
    try {
      setError(null);
      // Returned exactly once; the surface shows it a single time.
      const res = await provisionPrincipalToken(getToken, principalId);
      setProvisionedToken({ principal: principalId, token: res.token });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const saveRule = async () => {
    try {
      setError(null);
      await upsertDelegationRule(getToken, {
        workspace,
        action_type: ruleAction.trim(),
        target_principal: ruleTarget.trim(),
        priority: Number(rulePriority) || 100,
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const removeRule = async (actionType: string) => {
    try {
      setError(null);
      await deleteDelegationRule(getToken, workspace, actionType);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const addRoutine = async () => {
    try {
      setError(null);
      await createRoutine(getToken, {
        name: routineName.trim(),
        message: routineMessage.trim(),
        schedule: routineSchedule.trim(),
        workspace,
      });
      setRoutineName('');
      setRoutineMessage('');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const removeRoutine = async (id: string) => {
    try {
      setError(null);
      await deleteRoutine(getToken, id);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const fireRoutine = async (id: string) => {
    try {
      setError(null);
      await runRoutineNow(getToken, id);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Run-scoped timeline entries: approval bindings interleaved with events,
  // both carrying the attribution triple (§8.18).
  const runApprovals = selectedRun
    ? approvals.filter((a) => a.run_id === selectedRun)
    : [];
  const timeline = selectedRun
    ? [
        ...events.map((e) => ({ kind: 'event' as const, at: e.created_at, event: e })),
        ...runApprovals.map((a) => ({ kind: 'approval' as const, at: a.created_at, approval: a })),
      ].sort((x, y) => String(x.at).localeCompare(String(y.at)))
    : [];

  // P3: finished deliverables attached to this run (deliverable.created events)
  // — rendered as document cards above the timeline.
  const deliverables = events
    .filter((e) => e.event_type === 'deliverable.created' && e.payload?.file)
    .map((e) => ({
      at: e.created_at,
      name: String(e.payload?.name ?? e.payload?.file),
      template: String(e.payload?.template ?? 'report'),
      title: String(e.payload?.title ?? e.payload?.name ?? ''),
      file: String(e.payload?.file),
      mime: String(e.payload?.mime ?? ''),
      sizeBytes: Number(e.payload?.size_bytes ?? 0),
      actor: e.executor ?? e.initiator ?? '',
    }));

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
          <input
            className="w-56 rounded border border-[var(--border-default)] bg-transparent px-2 py-1 text-xs"
            placeholder="Always-on API URL"
            value={continuationApiUrl}
            onChange={(e) => setContinuationApiUrl(e.target.value)}
            aria-label="Continuation API URL"
          />
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={cloudContinuation}
              onChange={async (e) => {
                const on = e.target.checked;
                try {
                  await setCloudContinuation(getToken, on, continuationApiUrl || undefined);
                  setCloudContinuationPref(on);
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            />
            Continue on always-on API (needs URL + token + gizzi-cloud)
          </label>
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

      <Section title="Routines (scheduled work on Fabric Transport)">
        <p className="text-xs text-[var(--text-muted)]">
          Each fire submits a canonical intent (Al as delegator). Schedule: <Mono>*/N</Mono> minutes, <Mono>@hourly</Mono>, or <Mono>@daily</Mono>. Ticks only while this API process is running — closing the laptop stops them.
        </p>
        <ul className="space-y-2">
          {routines.map((r) => (
            <li key={r.id} className="rounded border border-[var(--border-default)] p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.name}</span>
                <span className="text-[var(--text-muted)]"><Mono>{r.schedule}</Mono></span>
              </div>
              <div className="mt-1 text-[var(--text-muted)]">{r.message}</div>
              <div className="mt-1 text-[var(--text-muted)]">
                next {r.next_run_at ?? '—'}{r.last_run_at ? ` · last ${r.last_run_at}` : ''}
              </div>
              <div className="mt-2 flex gap-2">
                <button className="rounded border px-2 py-0.5" onClick={() => fireRoutine(r.id)}>Run now</button>
                <button className="rounded border px-2 py-0.5 text-red-500" onClick={() => removeRoutine(r.id)}>Delete</button>
              </div>
            </li>
          ))}
          {routines.length === 0 && <li className="text-xs text-[var(--text-muted)]">No routines yet.</li>}
        </ul>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <label className="text-xs">Name<input className="mt-1 w-full rounded border border-[var(--border-default)] bg-transparent px-2 py-1" value={routineName} onChange={(e) => setRoutineName(e.target.value)} /></label>
          <label className="text-xs">Schedule<input className="mt-1 w-full rounded border border-[var(--border-default)] bg-transparent px-2 py-1" value={routineSchedule} onChange={(e) => setRoutineSchedule(e.target.value)} /></label>
          <label className="text-xs md:col-span-3">What to do<input className="mt-1 w-full rounded border border-[var(--border-default)] bg-transparent px-2 py-1" value={routineMessage} onChange={(e) => setRoutineMessage(e.target.value)} /></label>
        </div>
        <button className="rounded bg-blue-600 px-3 py-1 text-white" onClick={addRoutine} disabled={!routineName.trim() || !routineMessage.trim()}>Add routine</button>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Principals / bots (management)">
          {provisionedToken && (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-600">
              Token for <Mono>{provisionedToken.principal}</Mono> (shown once — store it now):
              <div className="mt-1 break-all"><Mono>{provisionedToken.token}</Mono></div>
            </div>
          )}
          <ul className="space-y-2">
            {principals.map((p) => (
              <li key={p.id} className="rounded border border-[var(--border-default)] p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <Mono>{p.id}</Mono>
                  <span className={statusColor(p.status === 'active' ? 'completed' : 'pending')}>{p.status}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.roles.map((r) => (
                    <span key={r} className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-500">{r}</span>
                  ))}
                  {p.capabilities.map((c) => (
                    <span key={c} className="rounded bg-[var(--border-default)]/40 px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">{c}</span>
                  ))}
                </div>
                <button
                  className="mt-2 rounded border px-2 py-0.5 text-[10px]"
                  onClick={() => provision(p.id)}
                >
                  Provision new token
                </button>
              </li>
            ))}
            {principals.length === 0 && <li className="text-xs text-[var(--text-muted)]">No principals in this workspace.</li>}
          </ul>
        </Section>

        <Section title="Delegation rules (editor)">
          <ul className="space-y-1">
            {rules.map((r) => (
              <li key={r.action_type} className="flex items-center justify-between gap-2 rounded border border-[var(--border-default)] px-2 py-1 text-xs">
                <span>
                  <Mono>{r.action_type}</Mono> → <Mono>{r.target_principal}</Mono>
                  <span className="text-[var(--text-muted)]"> (priority {r.priority})</span>
                </span>
                <button className="rounded border px-2 py-0.5 text-[10px] text-red-500" onClick={() => removeRule(r.action_type)}>Delete</button>
              </li>
            ))}
            {rules.length === 0 && <li className="text-xs text-[var(--text-muted)]">No delegation rules.</li>}
          </ul>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs">Action type prefix<input className="mt-1 w-full rounded border border-[var(--border-default)] bg-transparent px-2 py-1" value={ruleAction} onChange={(e) => setRuleAction(e.target.value)} /></label>
            <label className="text-xs">Target principal<input className="mt-1 w-full rounded border border-[var(--border-default)] bg-transparent px-2 py-1" value={ruleTarget} onChange={(e) => setRuleTarget(e.target.value)} /></label>
            <label className="text-xs">Priority<input className="mt-1 w-full rounded border border-[var(--border-default)] bg-transparent px-2 py-1" value={rulePriority} onChange={(e) => setRulePriority(e.target.value)} /></label>
          </div>
          <button className="rounded bg-blue-600 px-3 py-1 text-white" onClick={saveRule}>Save rule</button>
        </Section>
      </div>

      <Section title="Connector sessions (broker)">
        <ul className="space-y-1 text-xs">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 rounded border border-[var(--border-default)] px-2 py-1">
              <Mono>{s.capability}</Mono>
              <span className={statusColor(s.status === 'active' ? 'leased' : 'completed')}>{s.status}</span>
              <span className="text-[var(--text-muted)]">principal <Mono>{s.principal}</Mono> · run <Mono>{s.run_id.slice(0, 8)}</Mono> · expires {s.expires_at.slice(11, 19)}</span>
            </li>
          ))}
          {sessions.length === 0 && <li className="text-[var(--text-muted)]">No brokered sessions yet.</li>}
        </ul>
      </Section>

      <FabricWorkflowsPanel />

      {selectedRun && (
        <Section title={`Run detail — ${selectedRun.slice(0, 8)}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-[var(--text-muted)]">
              Jobs: {jobs.map((j) => `${j.job_type}(${j.state})`).join(', ') || 'none created yet'}
            </div>
            <button
              className="rounded border px-2 py-0.5 text-xs"
              onClick={async () => {
                try {
                  setError(null);
                  await continueRunInCloud(getToken, selectedRun);
                  await refresh();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Retag for compute.cloud
            </button>
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
          {/* P3 deliverables: finished documents, preview + export. */}
          {deliverables.length > 0 && (
            <div className="mb-2 space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Deliverables</div>
              {deliverables.map((d) => {
                const ext = d.file.split('.').pop()?.toUpperCase() ?? '';
                const base = `/api/v1/cowork/runs/${selectedRun}/deliverables/${encodeURIComponent(d.file)}`;
                return (
                  <div key={d.file} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-[var(--border-default)] px-2 py-1.5">
                    <span className="rounded bg-[var(--border-default)]/30 px-1.5 py-0.5 text-[10px] font-semibold">{ext}</span>
                    <span className="font-medium">{d.title || d.name}</span>
                    <span className="text-[var(--text-muted)]">
                      {d.template} · {(d.sizeBytes / 1024).toFixed(1)} KB{d.actor ? <> · by <Mono>{d.actor}</Mono></> : null}
                    </span>
                    <span className="ml-auto flex gap-2">
                      <a className="rounded border px-2 py-0.5" href={base} target="_blank" rel="noreferrer">Preview</a>
                      <a className="rounded border px-2 py-0.5" href={`${base}?download=1`}>Export</a>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {/* Timeline: attributed events + approval states, interleaved by time. */}
          <ul className="max-h-72 space-y-1 overflow-y-auto text-xs">
            {timeline.map((item, i) =>
              item.kind === 'event' ? (
                <li key={`e-${item.event.id ?? i}`} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[var(--text-muted)]">{item.event.created_at?.slice(11, 19)}</span>
                  <span className="font-medium">{item.event.event_type}</span>
                  {item.event.event_type === 'deliverable.created' && (
                    <span className="text-[var(--text-muted)]">
                      📄 {String(item.event.payload?.title ?? item.event.payload?.name ?? '')}
                    </span>
                  )}
                  <span className="text-[var(--text-muted)]">
                    {item.event.initiator && <>initiator <Mono>{item.event.initiator}</Mono></>}
                    {item.event.delegator && <> · delegator <Mono>{item.event.delegator}</Mono></>}
                    {item.event.executor && <> · executor <Mono>{item.event.executor}</Mono></>}
                  </span>
                  {item.event.payload && Object.keys(item.event.payload).length > 0 && (
                    <details className="w-full">
                      <summary className="cursor-pointer text-[var(--text-muted)]">payload</summary>
                      <pre className="mt-1 overflow-x-auto rounded bg-[var(--border-default)]/20 p-1 text-[10px]">
                        {JSON.stringify(item.event.payload, null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              ) : (
                <li key={`a-${item.approval.id}`} className="flex flex-wrap items-baseline gap-x-2 rounded border border-[var(--border-default)] px-2 py-0.5">
                  <span className="text-[var(--text-muted)]">{item.approval.created_at?.slice(11, 19)}</span>
                  <span className="font-medium">approval.{item.approval.status}</span>
                  <Mono>{item.approval.capability}</Mono>
                  <span className={statusColor(item.approval.status)}>{item.approval.status}</span>
                  <span className="text-[var(--text-muted)]">
                    executor <Mono>{item.approval.executor}</Mono> · target <Mono>{item.approval.target}</Mono> · gen {item.approval.lease_generation}
                    {item.approval.decided_by ? <> · decided by <Mono>{item.approval.decided_by}</Mono></> : null}
                  </span>
                  {item.approval.status === 'pending' && (
                    <span className="flex gap-2">
                      <button className="rounded bg-emerald-600 px-2 py-0.5 text-white" onClick={() => decide(item.approval.id, 'grant')}>Grant</button>
                      <button className="rounded bg-red-600 px-2 py-0.5 text-white" onClick={() => decide(item.approval.id, 'deny')}>Deny</button>
                    </span>
                  )}
                </li>
              ),
            )}
            {timeline.length === 0 && <li className="text-[var(--text-muted)]">No events yet.</li>}
          </ul>
        </Section>
      )}
    </div>
  );
}

export default FabricTransportView;
