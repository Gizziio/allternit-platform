import { useEffect, useState } from 'react';
import { editorPackStorageKey } from '../editor-packs';
import { cellsToCsv, downloadDocumentFile } from '../file-io';

const ROWS = 30, COLS = 12;
export default function SheetEditorPack({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const key = editorPackStorageKey('sheets', documentId);
  const [cells, setCells] = useState<Record<string, string>>(() => JSON.parse(localStorage.getItem(key) || '{}'));
  useEffect(() => localStorage.setItem(key, JSON.stringify(cells)), [cells, key]);
  return <div className="flex h-full flex-col bg-[var(--bg-primary)]"><header className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-3"><button type="button" onClick={onClose} className="text-xs text-[var(--text-secondary)]">← Documents</button><strong className="text-sm">Untitled sheet</strong><button type="button" onClick={() => downloadDocumentFile('allternit-sheet.csv', cellsToCsv(cells), 'text/csv')} className="ml-auto rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold">Export CSV</button><span className="text-[10px] text-[var(--text-tertiary)]">Saved locally</span></header><div className="flex-1 overflow-auto"><table className="border-collapse text-xs"><thead><tr><th className="sticky left-0 top-0 z-20 size-8 bg-[var(--bg-secondary)]"/>{Array.from({length: COLS},(_,c)=><th key={c} className="sticky top-0 min-w-28 border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2">{String.fromCharCode(65+c)}</th>)}</tr></thead><tbody>{Array.from({length: ROWS},(_,r)=><tr key={r}><th className="sticky left-0 border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2">{r+1}</th>{Array.from({length: COLS},(_,c)=>{const id=`${r}:${c}`;return <td key={id} className="border border-[var(--border-subtle)]"><input aria-label={`Cell ${String.fromCharCode(65+c)}${r+1}`} value={cells[id]||''} onChange={(e)=>setCells((old)=>({...old,[id]:e.target.value}))} className="h-8 w-28 bg-transparent px-2 outline-none focus:ring-1 focus:ring-green-600"/></td>})}</tr>)}</tbody></table></div></div>;
}
