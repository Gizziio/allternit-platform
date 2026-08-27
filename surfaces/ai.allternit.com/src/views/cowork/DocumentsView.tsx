import React, { useEffect, useMemo, useState } from 'react';
import { FloppyDisk } from '@phosphor-icons/react';
import { OfficeLauncherView } from '../office/OfficeLauncherView';
import { installNativeDocumentSurfaceBridge } from '../documents/document-surface';
import { listDocumentWorkflowDrafts, listPromotedDocumentWorkflows, promoteDocumentWorkflow } from '../documents/document-workflows';

/**
 * Cowork Documents view — consolidated onto the unified Documents & Office
 * launcher (the four GenOffice-backed editors). The legacy editor packs
 * (local-storage Univer/proto editors) are superseded by the launcher;
 * this view additionally keeps the reusable-workflows surface.
 */
export const DocumentsView: React.FC<{ openView?: (viewType: string, context?: unknown) => void }> = ({ openView }) => {
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
    <OfficeLauncherView openView={openView}>
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
    </OfficeLauncherView>
  );
};

export default DocumentsView;
