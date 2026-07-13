import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  Circle,
  CircleNotch,
  ClockCounterClockwise,
  Robot,
  ShieldCheck,
  TreeStructure,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react';
import { useUnifiedStore } from '@/lib/agents/unified.store';
import { useRunnerStore } from '@/runner/runner.store';
import type { RunnerTraceEntry } from '@/runner/runner.types';

type InspectorTab = 'overview' | 'timeline' | 'agents' | 'evidence';

const tabs: Array<{ id: InspectorTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'agents', label: 'Agents' },
  { id: 'evidence', label: 'Evidence' },
];

export function RunInspector(): React.ReactNode {
  const [tab, setTab] = useState<InspectorTab>('overview');
  const {
    executions,
    dags,
    agents,
    receipts,
    logs,
    selectedRunId,
    isLoading,
    fetchDags,
    fetchAgents,
    fetchReceipts,
    fetchLedgerEvents,
    selectRun,
    cancelExecution,
  } = useUnifiedStore();
  const runnerTrace = useRunnerStore((state: { trace: RunnerTraceEntry[] }) => state.trace) as RunnerTraceEntry[];

  useEffect(() => {
    void Promise.all([fetchDags(), fetchAgents(), fetchReceipts(), fetchLedgerEvents()]);
  }, [fetchAgents, fetchDags, fetchLedgerEvents, fetchReceipts]);

  const selectedRun = executions.find((run) => run.runId === selectedRunId)
    ?? executions.find((run) => run.status === 'running')
    ?? executions.at(-1);
  const selectedDag = dags.find((dag) => dag.dagId === selectedRun?.dagId);
  const runAgents = agents.filter((agent) => !selectedRun || agent.currentDagId === selectedRun.dagId || agent.status !== 'idle');
  const runReceipts = receipts.filter((receipt) => !selectedRun || receipt.run_id === selectedRun.runId || receipt.dag_id === selectedRun.dagId);
  const runLogs = logs.filter((entry) => !selectedRun || entry.runId === selectedRun.runId || entry.dagId === selectedRun.dagId);
  const timeline = useMemo(() => [
    ...runLogs.map((entry) => ({ id: entry.id, timestamp: entry.timestamp, kind: entry.level, title: entry.message, detail: entry.source })),
    ...runnerTrace.map((entry) => ({ id: entry.id, timestamp: entry.timestamp, kind: entry.kind, title: entry.title, detail: entry.detail })),
  ].sort((a, b) => b.timestamp - a.timestamp), [runLogs, runnerTrace]);

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg-primary)]">
      <aside className="flex w-72 shrink-0 flex-col border-r border-[var(--border-subtle)]">
        <div className="border-b border-[var(--border-subtle)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Runs</h2>
          <p className="text-xs text-[var(--text-tertiary)]">{executions.length} recorded execution{executions.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {isLoading && executions.length === 0 ? <CircleNotch className="mx-auto mt-8 animate-spin text-[var(--text-tertiary)]" /> : executions.length === 0 ? <Empty label="No runs have started" /> : executions.slice().reverse().map((run) => {
            const dag = dags.find((candidate) => candidate.dagId === run.dagId);
            const selected = run.runId === selectedRun?.runId;
            return <button type="button" key={run.runId} onClick={() => selectRun(run.runId)} className={`mb-1 w-full rounded-lg border px-3 py-2 text-left ${selected ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'border-transparent hover:bg-[var(--surface-hover)]'}`}>
              <div className="flex items-center gap-2"><RunStateIcon state={run.status} /><span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-primary)]">{dag?.metadata?.title ?? run.dagId}</span><span className="text-[10px] text-[var(--text-tertiary)]">{run.progress}%</span></div>
              <div className="mt-1 truncate pl-5 font-mono text-[10px] text-[var(--text-tertiary)]">{run.runId}</div>
            </button>;
          })}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
          <div className="min-w-0"><h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">{selectedDag?.metadata?.title ?? selectedRun?.dagId ?? 'Run inspector'}</h2><p className="truncate text-xs text-[var(--text-tertiary)]">{selectedRun ? `${selectedRun.status} · ${selectedRun.runId}` : 'Select a run to inspect its execution'}</p></div>
          {selectedRun?.status === 'running' && <button type="button" onClick={() => void cancelExecution(selectedRun.runId)} className="rounded-lg border border-[var(--status-error)]/30 px-3 py-1.5 text-xs font-semibold text-[var(--status-error)] hover:bg-[var(--status-error)]/10">Cancel run</button>}
        </header>
        <nav className="flex gap-1 border-b border-[var(--border-subtle)] px-3 py-2">{tabs.map((item) => <button type="button" key={item.id} onClick={() => setTab(item.id)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${tab === item.id ? 'bg-[var(--accent-primary)] text-[var(--ui-text-inverse)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'}`}>{item.label}</button>)}</nav>
        <div className="flex-1 overflow-auto p-4">
          {!selectedRun ? <Empty label="No execution selected" /> : tab === 'overview' ? <Overview run={selectedRun} dag={selectedDag} agentCount={runAgents.length} evidenceCount={runReceipts.length} /> : tab === 'timeline' ? <Timeline items={timeline} /> : tab === 'agents' ? <Agents agents={runAgents} /> : <Evidence receipts={runReceipts} />}
        </div>
      </section>
    </div>
  );
}

function Overview({ run, dag, agentCount, evidenceCount }: { run: { progress: number; completedNodes: string[]; failedNodes: string[]; blockedNodes: string[]; startedAt: number }; dag?: { nodes: Array<{ nodeId: string; title: string; status: string }> }; agentCount: number; evidenceCount: number }): React.ReactNode {
  const cards = [{ label: 'Progress', value: `${run.progress}%`, icon: ClockCounterClockwise }, { label: 'Agents', value: agentCount, icon: Robot }, { label: 'Evidence', value: evidenceCount, icon: ShieldCheck }, { label: 'Blocked', value: run.blockedNodes.length, icon: WarningCircle }];
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-xl border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] p-4"><Icon size={17} className="text-[var(--accent-primary)]" /><div className="mt-3 text-xl font-semibold text-[var(--text-primary)]">{value}</div><div className="text-xs text-[var(--text-tertiary)]">{label}</div></div>)}</div><div className="rounded-xl border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] p-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]"><TreeStructure size={16} />Phases and tasks</div>{!dag?.nodes.length ? <p className="text-xs text-[var(--text-tertiary)]">No task graph was reported for this run.</p> : <div className="space-y-2">{dag.nodes.map((node) => <div key={node.nodeId} className="flex items-center gap-2 rounded-lg bg-[var(--bg-secondary)] px-3 py-2"><RunStateIcon state={node.status} /><span className="flex-1 text-xs text-[var(--text-primary)]">{node.title}</span><span className="text-[10px] capitalize text-[var(--text-tertiary)]">{node.status}</span></div>)}</div>}</div></div>;
}

function Timeline({ items }: { items: Array<{ id: string; timestamp: number; kind: string; title: string; detail?: string }> }): React.ReactNode {
  if (!items.length) return <Empty label="Waiting for trace events" />;
  return <div className="space-y-2">{items.map((item) => <div key={item.id} className="flex gap-3 rounded-lg border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] p-3"><Circle size={9} weight="fill" className="mt-1 shrink-0 text-[var(--accent-primary)]" /><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><span className="text-xs font-medium text-[var(--text-primary)]">{item.title}</span><time className="shrink-0 text-[10px] text-[var(--text-tertiary)]">{new Date(item.timestamp).toLocaleTimeString()}</time></div>{item.detail && <p className="mt-1 truncate text-[11px] text-[var(--text-tertiary)]">{item.detail}</p>}</div><span className="text-[10px] uppercase text-[var(--text-tertiary)]">{item.kind}</span></div>)}</div>;
}

function Agents({ agents }: { agents: Array<{ agentId: string; name: string; role: string; status: string; currentWihId?: string }> }): React.ReactNode {
  if (!agents.length) return <Empty label="No agents are attached to this run" />;
  return <div className="grid gap-3 lg:grid-cols-2">{agents.map((agent) => <div key={agent.agentId} className="rounded-xl border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] p-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"><Robot size={18} /></span><div className="min-w-0 flex-1"><h3 className="truncate text-xs font-semibold text-[var(--text-primary)]">{agent.name}</h3><p className="text-[11px] text-[var(--text-tertiary)]">{agent.role}</p></div><span className="text-[10px] capitalize text-[var(--text-secondary)]">{agent.status}</span></div>{agent.currentWihId && <p className="mt-3 truncate rounded-md bg-[var(--bg-secondary)] px-2 py-1.5 font-mono text-[10px] text-[var(--text-tertiary)]">{agent.currentWihId}</p>}</div>)}</div>;
}

function Evidence({ receipts }: { receipts: Array<{ receipt_id: string; kind: string; timestamp: string; payload: unknown; signature?: string }> }): React.ReactNode {
  if (!receipts.length) return <Empty label="No completion evidence has been recorded" />;
  return <div className="space-y-2">{receipts.map((receipt) => <details key={receipt.receipt_id} className="rounded-lg border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] p-3"><summary className="cursor-pointer list-none"><div className="flex items-center gap-2"><ShieldCheck size={15} className="text-[var(--status-success)]" /><span className="flex-1 text-xs font-semibold text-[var(--text-primary)]">{receipt.kind.replaceAll('_', ' ')}</span><time className="text-[10px] text-[var(--text-tertiary)]">{new Date(receipt.timestamp).toLocaleString()}</time></div></summary><pre className="mt-3 max-h-52 overflow-auto rounded-lg bg-[var(--bg-secondary)] p-3 text-[10px] text-[var(--text-secondary)]">{JSON.stringify(receipt.payload, null, 2)}</pre>{receipt.signature && <p className="mt-2 truncate font-mono text-[9px] text-[var(--text-tertiary)]">Signature: {receipt.signature}</p>}</details>)}</div>;
}

function RunStateIcon({ state }: { state: string }): React.ReactNode {
  if (['completed', 'complete', 'success', 'passed'].includes(state)) return <CheckCircle size={14} weight="fill" className="shrink-0 text-[var(--status-success)]" />;
  if (['failed', 'error', 'cancelled'].includes(state)) return <XCircle size={14} weight="fill" className="shrink-0 text-[var(--status-error)]" />;
  if (['running', 'working', 'validating'].includes(state)) return <CircleNotch size={14} className="shrink-0 animate-spin text-[var(--accent-primary)]" />;
  if (state === 'blocked') return <WarningCircle size={14} weight="fill" className="shrink-0 text-[var(--status-warning)]" />;
  return <Circle size={14} className="shrink-0 text-[var(--text-tertiary)]" />;
}

function Empty({ label }: { label: string }): React.ReactNode {
  return <div className="grid h-full min-h-40 place-items-center text-center text-xs text-[var(--text-tertiary)]">{label}</div>;
}
