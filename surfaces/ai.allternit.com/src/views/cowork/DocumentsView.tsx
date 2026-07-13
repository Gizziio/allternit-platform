import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, GridFour, PresentationChart, UploadSimple, CircleNotch, FloppyDisk } from '@phosphor-icons/react';
import { EDITOR_PACKS, type EditorPackId } from '../documents/editor-packs';
import { importDocumentFile } from '../documents/file-io';
import { listDocumentWorkflowDrafts, listPromotedDocumentWorkflows, promoteDocumentWorkflow, recordDocumentWorkflowIntent } from '../documents/document-workflows';

const PACK_ICONS = { documents: FileText, sheets: GridFour, presentations: PresentationChart } as const;

export const DocumentsView: React.FC = () => {
  const [active, setActive] = useState<{ pack: EditorPackId; id: string } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [workflowRevision, setWorkflowRevision] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const Editor = useMemo(() => active ? React.lazy(EDITOR_PACKS[active.pack].load) : null, [active]);
  const suggestedWorkflows = useMemo(() => listDocumentWorkflowDrafts().filter((workflow) => workflow.runCount >= 2), [workflowRevision]);
  const promotedWorkflows = useMemo(() => listPromotedDocumentWorkflows(), [workflowRevision]);

  useEffect(() => {
    const refresh = () => setWorkflowRevision((revision) => revision + 1);
    window.addEventListener('allternit:document-workflows-changed', refresh);
    return () => window.removeEventListener('allternit:document-workflows-changed', refresh);
  }, []);

  const createDocument = (pack: EditorPackId) => {
    recordDocumentWorkflowIntent(pack, `Create a new ${pack === 'documents' ? 'document' : pack === 'sheets' ? 'spreadsheet' : 'presentation'}`);
    setActive({ pack, id: crypto.randomUUID() });
  };

  const openFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    try {
      const imported = await importDocumentFile(file);
      setActive({ pack: imported.pack, id: imported.documentId });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'This file could not be opened.');
    }
  };

  if (active && Editor) {
    return <Suspense fallback={<div className="flex h-full items-center justify-center gap-2 text-sm text-[var(--text-secondary)]"><CircleNotch className="animate-spin"/>Loading editor pack…</div>}><Editor documentId={active.id} onClose={() => setActive(null)} /></Suspense>;
  }

  return <div className="h-full overflow-auto bg-[var(--shell-view-bg)] p-8">
    <header className="mx-auto max-w-6xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Allternit workspace</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-bold text-[var(--text-primary)]">Documents</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">Create locally without Microsoft, or open the same work in Word, Excel, and PowerPoint through their dedicated Allternit integrations.</p></div><input ref={fileInputRef} type="file" className="hidden" accept=".altdoc,.altsheet,.altdeck,.txt,.md,.csv" onChange={(event) => { void openFile(event.target.files?.[0]); event.target.value = ''; }} /><button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)]"><UploadSimple/>Open a file</button></div>
      {importError && <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-500">{importError}</p>}
    </header>
    <main className="mx-auto mt-8 max-w-6xl">
      <div className="grid gap-4 md:grid-cols-3">{Object.values(EDITOR_PACKS).map((pack) => {
        const Icon = PACK_ICONS[pack.id];
        return <article key={pack.id} className="flex min-h-64 flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 shadow-sm">
          <div className="flex size-12 items-center justify-center rounded-2xl" style={{ color: pack.accent, background: `color-mix(in srgb, ${pack.accent} 12%, transparent)` }}><Icon size={24} weight="duotone" /></div>
          <h2 className="mt-5 text-lg font-bold text-[var(--text-primary)]">{pack.name}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{pack.description}</p>
          <p className="mt-3 text-[10px] text-[var(--text-tertiary)]">On-demand pack · {pack.formats.join(' · ')}</p>
          <button type="button" onClick={() => createDocument(pack.id)} className="mt-auto rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ background: pack.accent }}>Create new</button>
        </article>;
      })}</div>
      {(suggestedWorkflows.length > 0 || promotedWorkflows.length > 0) && <section className="mt-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6">
        <h2 className="text-base font-bold text-[var(--text-primary)]">Reusable document workflows</h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">Repeated intents can be saved without combining the Word, Excel, and PowerPoint products.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">{suggestedWorkflows.map((workflow) => {
          const saved = promotedWorkflows.some((item) => item.id === workflow.id);
          return <div key={workflow.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[var(--text-primary)]">{workflow.name}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{workflow.host} · used {workflow.runCount} times</p></div><button type="button" disabled={saved} onClick={() => { promoteDocumentWorkflow(workflow.id); setWorkflowRevision((revision) => revision + 1); }} className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50"><FloppyDisk />{saved ? 'Saved' : 'Save workflow'}</button></div></div>;
        })}</div>
      </section>}
      <section className="mt-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6"><h2 className="text-base font-bold text-[var(--text-primary)]">Offline and Microsoft compatibility</h2><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Desktop packages include these lazy chunks and can open them offline. Web loads each editor only when requested. Local formats, Markdown, and CSV import/export are available now; high-fidelity DOCX, XLSX, and PPTX remain delegated to the dedicated Microsoft integrations or a future compatibility engine.</p></section>
    </main>
  </div>;
};

export default DocumentsView;
