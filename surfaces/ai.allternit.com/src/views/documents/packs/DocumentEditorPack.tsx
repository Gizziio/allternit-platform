import { useEffect, useState } from 'react';
import { editorPackStorageKey } from '../editor-packs';
import { downloadDocumentFile, exportDocumentFile } from '../file-io';
import { registerNativeDocumentSurface } from '../document-surface';

export default function DocumentEditorPack({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const key = editorPackStorageKey('documents', documentId);
  const [title, setTitle] = useState(() => localStorage.getItem(`${key}.title`) || 'Untitled document');
  const [body, setBody] = useState(() => localStorage.getItem(key) || '');
  const [revision, setRevision] = useState(0);
  useEffect(() => { localStorage.setItem(key, body); localStorage.setItem(`${key}.title`, title); }, [body, key, title]);
  useEffect(() => registerNativeDocumentSurface({
    id: documentId,
    kind: 'documents',
    snapshot: () => ({ surfaceId: documentId, kind: 'documents', title, revision, content: { body } }),
    apply: (mutation) => {
      if (mutation.type === 'export-office') {
        return exportDocumentFile('documents', documentId, mutation.format).then(() => ({ revision, summary: `Exported as ${mutation.format}.` }));
      }
      if (mutation.type !== 'replace-document') throw new Error(`Unsupported document mutation: ${mutation.type}`);
      setBody(mutation.body); if (mutation.title) setTitle(mutation.title); setRevision((value) => value + 1);
      return { revision: revision + 1, summary: 'Replaced document content.' };
    },
  }), [body, documentId, revision, title]);
  return <div className="flex h-full flex-col bg-[var(--bg-primary)]">
    <header className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-3"><button type="button" onClick={onClose} className="text-xs text-[var(--text-secondary)]">← Documents</button><input value={title} onChange={(e) => setTitle(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"/><button type="button" onClick={() => void exportDocumentFile('documents', documentId, 'docx')} className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold">Save as .docx</button><button type="button" onClick={() => downloadDocumentFile(`${title || 'document'}.md`, body, 'text/markdown')} className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold">Export Markdown</button><span className="text-[10px] text-[var(--text-tertiary)]">Saved locally</span></header>
    <div className="flex-1 overflow-auto bg-[var(--bg-secondary)] p-8"><textarea aria-label="Document body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Start writing, or ask Computer Agent to draft here…" className="mx-auto block min-h-full w-full max-w-3xl resize-none rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-12 text-[15px] leading-7 text-[var(--text-primary)] shadow-lg outline-none" /></div>
  </div>;
}
