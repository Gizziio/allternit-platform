import React, { useEffect, useMemo, useState } from 'react';
import { File, FileCode, FileImage, FileText, Link, Package, ShieldCheck } from '@phosphor-icons/react';
import { execEvents } from '@/integration/execution/exec.events';
import { useUnifiedStore } from '@/lib/agents/unified.store';
import { artifactFromReference, type CodeArtifact, type CodeArtifactKind } from './artifacts';

export function ArtifactCenter(): React.ReactNode {
  const receipts = useUnifiedStore((state) => state.receipts);
  const fetchReceipts = useUnifiedStore((state) => state.fetchReceipts);
  const [runArtifacts, setRunArtifacts] = useState<CodeArtifact[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { void fetchReceipts(); }, [fetchReceipts]);
  useEffect(() => execEvents.subscribe('onRunComplete', (result) => {
    if (!result.artifacts?.length) return;
    setRunArtifacts((current) => {
      const next = result.artifacts!.map((reference) => artifactFromReference(reference, result.runId));
      return [...current.filter((item) => !next.some((candidate) => candidate.id === item.id)), ...next];
    });
  }), []);

  const receiptArtifacts = useMemo<CodeArtifact[]>(() => receipts.flatMap((receipt) => {
    const payload = receipt.payload;
    if (!payload || typeof payload !== 'object') return [];
    const record = payload as Record<string, unknown>;
    const references = [record.artifact, record.artifact_url, record.path, record.file]
      .filter((value): value is string => typeof value === 'string');
    return references.map((reference) => ({
      ...artifactFromReference(reference, receipt.run_id),
      id: `${receipt.receipt_id}:${reference}`,
      source: 'receipt' as const,
      receiptId: receipt.receipt_id,
      createdAt: new Date(receipt.timestamp).getTime(),
      metadata: { receipt_kind: receipt.kind },
    }));
  }), [receipts]);
  const artifacts = useMemo(() => [...runArtifacts, ...receiptArtifacts].sort((a, b) => b.createdAt - a.createdAt), [receiptArtifacts, runArtifacts]);
  const selected = artifacts.find((artifact) => artifact.id === selectedId) ?? artifacts[0];

  return <div className="flex h-full min-h-0 bg-[var(--bg-primary)]">
    <aside className="flex w-80 shrink-0 flex-col border-r border-[var(--border-subtle)]">
      <header className="border-b border-[var(--border-subtle)] px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><Package size={17} />Artifacts</h2><p className="text-xs text-[var(--text-tertiary)]">{artifacts.length} output{artifacts.length === 1 ? '' : 's'} with provenance</p></header>
      <div className="flex-1 overflow-auto p-2">{artifacts.length === 0 ? <div className="grid h-full min-h-40 place-items-center px-6 text-center text-xs text-[var(--text-tertiary)]">Artifacts created by runs and tools will appear here.</div> : artifacts.map((artifact) => <button type="button" key={artifact.id} onClick={() => setSelectedId(artifact.id)} className={`mb-1 flex w-full items-center gap-3 rounded-lg border p-3 text-left ${artifact.id === selected?.id ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'border-transparent hover:bg-[var(--surface-hover)]'}`}><ArtifactIcon kind={artifact.kind} /><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold text-[var(--text-primary)]">{artifact.name}</div><div className="mt-0.5 truncate text-[10px] text-[var(--text-tertiary)]">{artifact.kind} · {artifact.source}</div></div></button>)}</div>
    </aside>
    <section className="min-w-0 flex-1 overflow-auto p-5">{!selected ? <div className="grid h-full place-items-center text-xs text-[var(--text-tertiary)]">Select an artifact to inspect it.</div> : <div className="mx-auto max-w-3xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-base font-semibold text-[var(--text-primary)]">{selected.name}</h2><p className="mt-1 text-xs text-[var(--text-tertiary)]">Created {new Date(selected.createdAt).toLocaleString()}</p></div><span className="rounded-full border border-[var(--ui-border-muted)] px-2 py-1 text-[10px] uppercase text-[var(--text-tertiary)]">{selected.retention ?? 'session'}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Metadata label="Run" value={selected.runId ?? 'Not attached'} /><Metadata label="Source" value={selected.source} /><Metadata label="Kind" value={selected.kind} /><Metadata label="Receipt" value={selected.receiptId ?? 'None'} /></div>{selected.uri && <div className="mt-4 rounded-xl border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] p-4"><div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Reference</div><div className="break-all font-mono text-xs text-[var(--text-secondary)]">{selected.uri}</div>{/^https?:\/\//.test(selected.uri) && <a href={selected.uri} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-primary)]"><Link size={13} />Open artifact</a>}</div>}<div className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--status-success)]/10 px-3 py-2 text-xs text-[var(--status-success)]"><ShieldCheck size={15} />Provenance attached to {selected.source}{selected.receiptId ? ' evidence' : ''}</div></div>}</section>
  </div>;
}

function Metadata({ label, value }: { label: string; value: string }): React.ReactNode { return <div className="rounded-lg border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] p-3"><div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{label}</div><div className="mt-1 truncate text-xs font-medium capitalize text-[var(--text-primary)]">{value}</div></div>; }
function ArtifactIcon({ kind }: { kind: CodeArtifactKind }): React.ReactNode { const Icon = kind === 'image' ? FileImage : kind === 'html' || kind === 'json' || kind === 'diff' ? FileCode : kind === 'markdown' || kind === 'report' ? FileText : File; return <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"><Icon size={16} /></span>; }

