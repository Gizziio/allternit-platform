/**
 * Allternit Wiki View
 * Surface for the forked Docmost engine (reskinned as Allternit Wiki).
 * Connects via the DocmostAdapter service client.
 */

import React, { useEffect, useState } from 'react';
import { BookOpen, Plus, X } from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';
import { DocmostAdapter } from '@/services/docmost/DocmostAdapter';
import type { AllternitArtifact } from '@/lib/artifacts/schema';

const DOCmost_URL = process.env.NEXT_PUBLIC_DOCMOST_URL || 'http://localhost:3000';
const adapter = new DocmostAdapter({ baseUrl: `${DOCmost_URL}/api` });

interface WikiViewProps {
  defaultEdit?: boolean;
}

export const WikiView: React.FC<WikiViewProps> = ({ defaultEdit = false }) => {
  const [pages, setPages] = useState<AllternitArtifact[]>([]);
  const [selectedPage, setSelectedPage] = useState<AllternitArtifact | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const loadPages = async () => {
    setLoading(true);
    try {
      const list = await adapter.listPages('default');
      setPages(list);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to load wiki');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPages();
  }, []);

  const openPage = async (pageId: string) => {
    setLoading(true);
    try {
      const [page, rawPage] = await Promise.all([
        adapter.getPage(pageId),
        adapter.getPageRaw(pageId),
      ]);
      setSelectedPage(page);
      setEditTitle(page.title);
      setEditContent(JSON.stringify(rawPage.content, null, 2));
      setIsEditing(defaultEdit);
      setStatus(null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to open page');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePage = async () => {
    const title = newPageTitle.trim();
    if (!title) return;
    setLoading(true);
    try {
      const page = await adapter.createPage('default', title);
      setPages((prev) => [page, ...prev]);
      setSelectedPage(page);
      setIsCreating(false);
      setNewPageTitle('');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to create page');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePage = async () => {
    if (!selectedPage) return;
    setLoading(true);
    try {
      let contentJson: Record<string, unknown>;
      try {
        contentJson = JSON.parse(editContent);
      } catch {
        setStatus('Invalid JSON content');
        setLoading(false);
        return;
      }
      const updated = await adapter.updatePage(selectedPage.id, {
        title: editTitle,
        content: contentJson,
      });
      setSelectedPage(updated);
      setIsEditing(false);
      setStatus(null);
      await loadPages();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save page');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 'var(--spacing-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <BookOpen size={24} color="#af52de" />
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '24px', fontWeight: 600 }}>Wiki</h1>
        </div>
        {!isCreating && !selectedPage && (
          <button
            onClick={() => setIsCreating(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent-cowork)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Plus size={14} />
            New Page
          </button>
        )}
      </div>

      {status ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', borderRadius: 6, background: 'rgba(248,113,113,0.1)', color: 'var(--status-error)', fontSize: '12px' }}>
          <span>{status}</span>
          <button onClick={() => setStatus(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            <X size={12} />
          </button>
        </div>
      ) : null}

      {isCreating && !selectedPage && (
        <GlassSurface style={{ padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>
            New Wiki Page
          </div>
          <input
            value={newPageTitle}
            onChange={(e) => setNewPageTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleCreatePage(); }}
            placeholder="Page title"
            autoFocus
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              marginBottom: 'var(--spacing-sm)',
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setIsCreating(false); setNewPageTitle(''); }}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => void handleCreatePage()}
              disabled={!newPageTitle.trim() || loading}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--accent-cowork)',
                color: '#fff',
                cursor: newPageTitle.trim() && !loading ? 'pointer' : 'not-allowed',
                fontSize: 12,
                fontWeight: 600,
                opacity: newPageTitle.trim() && !loading ? 1 : 0.5,
              }}
            >
              Create Page
            </button>
          </div>
        </GlassSurface>
      )}

      {selectedPage ? (
        <GlassSurface style={{ padding: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
            <button
              onClick={() => { setSelectedPage(null); setIsEditing(false); }}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              ← Back to Wiki
            </button>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Edit Page
              </button>
            )}
          </div>

          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Page title"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: 15,
                  fontWeight: 600,
                }}
              />
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={12}
                placeholder="ProseMirror JSON content"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-panel)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  resize: 'vertical',
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setIsEditing(false)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border-subtle)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSavePage()}
                  disabled={!editTitle.trim() || loading}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'var(--accent-cowork)',
                    color: '#fff',
                    cursor: editTitle.trim() && !loading ? 'pointer' : 'not-allowed',
                    fontSize: 12,
                    fontWeight: 600,
                    opacity: editTitle.trim() && !loading ? 1 : 0.5,
                  }}
                >
                  Save Page
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 style={{ margin: '0 0 var(--spacing-md)', color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600 }}>
                {selectedPage.title}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                {selectedPage.sections.map((section) => (
                  <div key={section.id} style={{ padding: 'var(--spacing-md)', borderRadius: 8, background: 'var(--bg-secondary)' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: 6 }}>{section.kind}</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600, marginBottom: 8 }}>{section.heading}</div>
                    <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)', fontSize: '13px' }}>{section.body}</pre>
                  </div>
                ))}
              </div>
            </>
          )}
        </GlassSurface>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {loading && pages.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading wiki pages…</div>
          ) : (
            pages.map((page) => (
              <GlassSurface
                key={page.id}
                style={{ padding: 'var(--spacing-md)', cursor: 'pointer' }}
                onClick={() => openPage(page.id)}
              >
                <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>{page.title}</div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginTop: 4 }}>
                  Updated {new Date(page.updatedAt).toLocaleDateString()}
                </div>
              </GlassSurface>
            ))
          )}
          {pages.length === 0 && !loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: '14px' }}>No wiki pages yet</p>
              <p style={{ fontSize: '12px' }}>Ensure the Allternit Wiki service (Docmost fork) is running at {DOCmost_URL}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default WikiView;
