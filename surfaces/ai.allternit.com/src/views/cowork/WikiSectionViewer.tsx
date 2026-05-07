/**
 * Wiki Section Viewer
 * Renders a Docmost wiki page inline inside an artifact section.
 */

import React, { useEffect, useState } from 'react';
import { DocmostAdapter } from '@/services/docmost/DocmostAdapter';
import type { AllternitArtifact } from '@/lib/artifacts/schema';

const DOCmost_URL = process.env.NEXT_PUBLIC_DOCMOST_URL || 'http://localhost:3000';
const adapter = new DocmostAdapter({ baseUrl: `${DOCmost_URL}/api` });

export const WikiSectionViewer: React.FC<{ pageId: string }> = ({ pageId }) => {
  const [page, setPage] = useState<AllternitArtifact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pageId) return;
    setLoading(true);
    adapter.getPage(pageId)
      .then((p) => { setPage(p); setError(null); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load wiki page'))
      .finally(() => setLoading(false));
  }, [pageId]);

  if (loading) return <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading wiki page…</div>;
  if (error) return <div style={{ color: 'var(--status-error)', fontSize: '13px' }}>{error}</div>;
  if (!page) return <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No wiki page selected</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>{page.title}</div>
      {page.sections.map((section) => (
        <div key={section.id} style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--bg-secondary)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: 4 }}>{section.kind}</div>
          <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, marginBottom: 4 }}>{section.heading}</div>
          <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)', fontSize: '13px', margin: 0 }}>{section.body}</pre>
        </div>
      ))}
    </div>
  );
};

export default WikiSectionViewer;
