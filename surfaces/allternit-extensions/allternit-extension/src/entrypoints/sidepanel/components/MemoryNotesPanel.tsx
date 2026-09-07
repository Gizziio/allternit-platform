import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createMemoryNote,
  deleteMemoryNote,
  listMemoryNotes,
  updateMemoryNote,
  type MemoryNote,
} from '@/lib/memory/api';

interface MemoryNotesPanelProps {
  onBack: () => void;
}

const NOTE_TYPES: MemoryNote['note_type'][] = ['person', 'website', 'episodic', 'general'];

export function MemoryNotesPanel({ onBack }: MemoryNotesPanelProps) {
  const [notes, setNotes] = useState<MemoryNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [noteType, setNoteType] = useState<MemoryNote['note_type']>('general');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listMemoryNotes();
      setNotes(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setNoteType('general');
    setTitle('');
    setContent('');
    setTags('');
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setError(null);
    try {
      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (editingId) {
        await updateMemoryNote(editingId, { title: title.trim(), content, tags: tagList });
      } else {
        await createMemoryNote({
          note_type: noteType,
          title: title.trim(),
          content,
          tags: tagList,
        });
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleEdit = (note: MemoryNote) => {
    setEditingId(note.id);
    setNoteType(note.note_type);
    setTitle(note.title);
    setContent(note.content);
    setTags(note.tags.join(', '));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    setError(null);
    try {
      await deleteMemoryNote(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          ←
        </button>
        <span className="text-sm font-medium">Memory Notes</span>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium">{editingId ? 'Edit note' : 'Add note'}</p>
          <div>
            <Label className="text-[10px] text-muted-foreground">Type</Label>
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value as MemoryNote['note_type'])}
              className="h-8 w-full rounded-md border bg-background px-2 text-xs"
            >
              {NOTE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Project Phoenix login process"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Content (markdown)</Label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# Notes\n- step one\n- step two"
              className="min-h-[80px] w-full rounded-md border bg-background px-2 py-1 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Tags (comma-separated)</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="work, login, recurring"
              className="h-8 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!title.trim()} onClick={handleSave} className="h-8 flex-1 text-xs">
              {editingId ? 'Update' : 'Save'}
            </Button>
            {editingId && (
              <Button variant="outline" size="sm" onClick={resetForm} className="h-8 text-xs">
                Cancel
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium">Saved notes</p>
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No notes yet.</p>
          ) : (
            <div className="space-y-1.5">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-md border bg-muted/20 px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium">{note.title}</p>
                    <span className="shrink-0 rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">
                      {note.note_type}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-[10px] text-muted-foreground">{note.content}</p>
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(note)}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(note.id)}
                      className="text-[10px] text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
