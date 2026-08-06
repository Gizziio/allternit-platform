import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { api, type TrashItem } from '../lib/api';
import Icon from './Icon';

/** Trash browser (FR-1): list items moved to `.trash`, restore them, or delete
 *  them permanently. Items land here when delete mode is "Move to trash". */
export default function TrashView() {
  const open = useStore((s) => s.trashOpen);
  const close = useStore((s) => s.setTrash);
  const notify = useStore((s) => s.notify);
  const loadTree = useStore((s) => s.loadTree);

  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    api
      .listTrash()
      .then((r) => setItems(r.items))
      .catch((e) => notify(e.message || 'Failed to load trash'))
      .finally(() => setLoading(false));
  }, [notify]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  if (!open) return null;

  const restore = async (it: TrashItem) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.restoreTrash(it.path);
      notify(`Restored ${r.restored}`);
      await loadTree();
      refresh();
    } catch (e: any) {
      notify(e.message || 'Restore failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (it: TrashItem) => {
    if (busy) return;
    if (!confirm(`Permanently delete "${it.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.deleteTrashItem(it.path);
      notify('Deleted permanently');
      refresh();
    } catch (e: any) {
      notify(e.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const empty = async () => {
    if (busy || items.length === 0) return;
    if (!confirm(`Empty trash? ${items.length} item(s) will be permanently deleted.`)) return;
    setBusy(true);
    try {
      await api.emptyTrash();
      notify('Trash emptied');
      refresh();
    } catch (e: any) {
      notify(e.message || 'Empty trash failed');
    } finally {
      setBusy(false);
    }
  };

  const fmtSize = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };
  const fmtDate = (ms: number) => {
    if (!ms) return '';
    const d = new Date(ms);
    return isNaN(d.getTime()) ? '' : d.toLocaleString();
  };

  return (
    <div className="modal-bg" onClick={() => close(false)}>
      <div className="modal trash-view" onClick={(e) => e.stopPropagation()}>
        <div className="vh-head">
          <Icon name="trash" size={16} />
          <div className="vh-title">Trash</div>
          <div className="vh-path">{items.length} item(s)</div>
          <button className="tool-btn" title="Refresh" onClick={refresh}>
            <Icon name="refresh-cw" size={16} />
          </button>
          <button className="tool-btn" title="Close" onClick={() => close(false)}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="trash-body">
          {loading && <div className="vh-empty">Loading…</div>}
          {!loading && items.length === 0 && (
            <div className="vh-empty">Trash is empty.</div>
          )}
          {!loading &&
            items.map((it) => (
              <div className="trash-item" key={it.path} title={it.original}>
                <Icon name="file-text" size={14} />
                <div className="trash-item-info">
                  <div className="trash-item-name">{it.name}</div>
                  <div className="trash-item-meta">
                    {it.original}
                    {it.mtime ? ` · ${fmtDate(it.mtime)}` : ''}
                    {it.size ? ` · ${fmtSize(it.size)}` : ''}
                  </div>
                </div>
                <button
                  className="btn secondary trash-act"
                  title="Restore to original location"
                  disabled={busy}
                  onClick={() => restore(it)}
                >
                  Restore
                </button>
                <button
                  className="tool-btn trash-del"
                  title="Delete permanently"
                  disabled={busy}
                  onClick={() => remove(it)}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
        </div>
        <div className="vh-foot">
          <button className="btn secondary" onClick={() => close(false)}>
            Close
          </button>
          <button className="btn danger" onClick={empty} disabled={busy || items.length === 0}>
            Empty trash
          </button>
        </div>
      </div>
    </div>
  );
}
