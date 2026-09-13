import React, { useEffect, useMemo, useState } from 'react';
import { FloppyDisk, PuzzlePiece } from '@phosphor-icons/react';
import { openOfficeWindow } from '@/lib/open-office-window';
import { installNativeDocumentSurfaceBridge } from '../documents/document-surface';
import { listDocumentWorkflowDrafts, listPromotedDocumentWorkflows, promoteDocumentWorkflow } from '../documents/document-workflows';

/**
 * Cowork Documents view — the Documents & Office launcher embed was retired;
 * the Allternit Office suite now lives in its own ACI-mode window. This view
 * is a pointer to that window, plus the reusable-workflows surface it
 * always carried.
 */
export const DocumentsView: React.FC<{ openView?: (viewType: string, context?: unknown) => void }> = ({ openView: _openView }) => {
  const [workflowRevision, setWorkflowRevision] = useState(0);
  const suggestedWorkflows = useMemo(() => listDocumentWorkflowDrafts().filter((workflow) => workflow.runCount >= 2), [workflowRevision]);
  const promotedWorkflows = useMemo(() => listPromotedDocumentWorkflows(), [workflowRevision]);

  useEffect(() => {
    installNativeDocumentSurfaceBridge();
    const refresh = () => setWorkflowRevision((revision) => revision + 1);
    window.addEventListener('allternit:document-workflows-changed', refresh);
    return () => window.removeEventListener('allternit:document-workflows-changed', refresh);
  }, []);

  return (
    <div className="h-full w-full overflow-auto bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-8 pb-12 pt-10">
        <h1 className="m-0 text-3xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>Documents</h1>
        <section
          data-testid="documents-hub-pointer"
          className="mt-8 flex flex-col items-start gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-8"
        >
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <PuzzlePiece size={20} weight="duotone" />
            <h2 className="m-0 text-base font-bold">Documents live in Allternit Office</h2>
          </div>
          <p className="m-0 max-w-xl text-sm text-[var(--text-secondary)]">
            Create and edit Word, Excel, PowerPoint, and PDF files from the Allternit Office suite —
            the ACI mode window dedicated to office work.
          </p>
          <button
            type="button"
            onClick={() => openOfficeWindow()}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3.5 py-2 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--border-hover)]"
          >
            Open Allternit Office
          </button>
        </section>

        {(suggestedWorkflows.length > 0 || promotedWorkflows.length > 0) && (
          <section className="mt-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6">
            <h2 className="text-base font-bold text-[var(--text-primary)]">Reusable document workflows</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Repeated intents can be saved without combining the Word, Excel, and PowerPoint products.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {suggestedWorkflows.map((workflow) => {
                const saved = promotedWorkflows.some((item) => item.id === workflow.id);
                return (
                  <div key={workflow.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{workflow.name}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{workflow.host} · used {workflow.runCount} times</p>
                      </div>
                      <button
                        type="button"
                        disabled={saved}
                        onClick={() => { promoteDocumentWorkflow(workflow.id); setWorkflowRevision((revision) => revision + 1); }}
                        className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                      >
                        <FloppyDisk />{saved ? 'Saved' : 'Save workflow'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default DocumentsView;
