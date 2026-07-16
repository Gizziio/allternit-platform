import React, { useEffect, useMemo, useState } from 'react';
import { ArrowSquareOut, File, FileCode, FileImage, FileText, Package, ShieldCheck } from '@phosphor-icons/react';
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

  if (artifacts.length === 0) {
    return <div className="flex h-full min-h-0 items-center justify-center bg-[var(--surface-canvas)] px-8">
      <div className="w-full max-w-[280px] text-center">
        <div className="mx-auto grid size-10 place-items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--text-secondary)] shadow-sm"><Package size={18} weight="duotone" /></div>
        <h3 className="mt-3 text-[13px] font-semibold text-[var(--text-primary)]">No artifacts yet</h3>
        <p className="mt-1 text-[11px] leading-5 text-[var(--text-tertiary)]">Files, previews, and reports created during this session will collect here automatically.</p>
        <div className="mx-auto mt-4 h-px w-12 bg-[var(--border-subtle)]" />
        <p className="mt-3 text-[10px] text-[var(--text-tertiary)]">Session outputs · receipts preserved</p>
      </div>
    </div>;
  }

  return <div className="flex h-full min-h-0 flex-col bg-[var(--surface-canvas)]">
    <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2">
      <span className="text-[11px] text-[var(--text-tertiary)]">{artifacts.length} session output{artifacts.length === 1 ? '' : 's'}</span>
      <span className="inline-flex items-center gap-1 text-[10px] text-[var(--status-success)]"><ShieldCheck size={12} />Provenance on</span>
    </div>
    <div className="min-h-0 flex-1 overflow-auto p-2">
      {artifacts.map((artifact) => <button type="button" key={artifact.id} onClick={() => setSelectedId(artifact.id)} className={`mb-1 flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${artifact.id === selected?.id ? 'border-[var(--border-strong)] bg-[var(--surface-active)]' : 'border-transparent hover:bg-[var(--surface-hover)]'}`}><ArtifactIcon kind={artifact.kind} /><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-medium text-[var(--text-primary)]">{artifact.name}</div><div className="mt-0.5 truncate text-[10px] text-[var(--text-tertiary)]">{artifact.kind} · {artifact.source} · {new Date(artifact.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div></div>{artifact.uri && /^https?:\/\//.test(artifact.uri) ? <ArrowSquareOut size={13} className="shrink-0 text-[var(--text-tertiary)]" /> : null}</button>)}
    </div>
    {selected ? <section className="border-t border-[var(--border-subtle)] bg-[var(--surface-panel)] p-3"><div className="truncate text-[11px] font-semibold text-[var(--text-primary)]">{selected.name}</div><div className="mt-2 grid grid-cols-2 gap-1.5"><Metadata label="Source" value={selected.source} /><Metadata label="Kind" value={selected.kind} /></div>{selected.uri && <div className="mt-2 flex items-center gap-2 rounded-md border border-[var(--border-subtle)] px-2 py-1.5"><span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[var(--text-secondary)]">{selected.uri}</span>{/^https?:\/\//.test(selected.uri) && <a aria-label="Open artifact" href={selected.uri} target="_blank" rel="noreferrer" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ArrowSquareOut size={13} /></a>}</div>}</section> : null}
  </div>;
}

function Metadata({ label, value }: { label: string; value: string }): React.ReactNode { return <div className="min-w-0 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-2 py-1.5"><div className="text-[9px] uppercase tracking-wide text-[var(--text-tertiary)]">{label}</div><div className="mt-0.5 truncate text-[10px] font-medium capitalize text-[var(--text-primary)]">{value}</div></div>; }
function ArtifactIcon({ kind }: { kind: CodeArtifactKind }): React.ReactNode { const Icon = kind === 'image' ? FileImage : kind === 'html' || kind === 'json' || kind === 'diff' ? FileCode : kind === 'markdown' || kind === 'report' ? FileText : File; return <span className="grid size-7 shrink-0 place-items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--text-secondary)]"><Icon size={14} /></span>; }
