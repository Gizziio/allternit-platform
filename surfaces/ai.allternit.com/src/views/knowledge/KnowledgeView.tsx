/**
 * Allternit Knowledge View
 * RAG knowledge panel — upload documents and query via vector retrieval.
 * Connects to the Allternit AI backend retrieval API.
 */

import React, { useState, useRef } from 'react';
import { Brain, Upload, MagnifyingGlass, X, FileText } from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';

export const KnowledgeView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ source: string; text: string; score?: number }>>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadStatus('Uploading…');

    const form = new FormData();
    for (const file of Array.from(files)) {
      form.append('file', file);
    }

    try {
      const res = await fetch('/api/v1/ai/rag/upload', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadStatus(`Uploaded ${files.length} document(s)`);
        setUploadedFiles((prev) => [...prev, ...Array.from(files).map((f) => f.name)]);
      } else {
        setUploadStatus(data.error || 'Upload failed');
      }
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearchStatus('Searching…');
    setResults([]);

    try {
      const res = await fetch('/api/v1/ai/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), collection: 'default' }),
      });
      const data = await res.json();
      if (res.ok && data.documents) {
        const docs = data.documents as Array<{ source?: string; text?: string; score?: number }>;
        setResults(docs.map((d) => ({ source: d.source || 'Unknown', text: d.text || '', score: d.score })));
        setSearchStatus(null);
      } else {
        setSearchStatus(data.error || 'Query failed');
      }
    } catch (err) {
      setSearchStatus(err instanceof Error ? err.message : 'Query failed');
    }
  };

  return (
    <div style={{ padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
        <Brain size={24} color="#af52de" />
        <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '24px', fontWeight: 600 }}>Knowledge</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)', flex: 1, minHeight: 0 }}>
        {/* Upload Panel */}
        <GlassSurface style={{ padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Upload size={18} />
            Upload Documents
          </div>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void handleUpload(e.dataTransfer.files);
            }}
            style={{
              border: '2px dashed var(--border-subtle)',
              borderRadius: 12,
              padding: 'var(--spacing-xl)',
              textAlign: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: 14,
            }}
          >
            <Upload size={32} style={{ marginBottom: 8 }} />
            <div>Drop files here or click to upload</div>
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>PDF, TXT, MD supported</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => void handleUpload(e.target.files)}
          />
          {uploadStatus && (
            <div style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12 }}>
              {uploadStatus}
            </div>
          )}
          {uploadedFiles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflow: 'auto' }}>
              {uploadedFiles.map((name, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-secondary)' }}>
                  <FileText size={14} />
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{name}</span>
                  <button onClick={() => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </GlassSurface>

        {/* Search Panel */}
        <GlassSurface style={{ padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MagnifyingGlass size={18} />
            Query Knowledge
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
              placeholder="Ask anything about your documents…"
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: 14,
              }}
            />
            <button
              onClick={() => void handleSearch()}
              disabled={!query.trim()}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent-cowork)',
                color: '#fff',
                cursor: query.trim() ? 'pointer' : 'not-allowed',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Search
            </button>
          </div>
          {searchStatus && (
            <div style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12 }}>
              {searchStatus}
            </div>
          )}
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((r, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-cowork)' }}>{r.source}</span>
                  {r.score !== undefined && (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{(r.score * 100).toFixed(1)}% match</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{r.text}</div>
              </div>
            ))}
            {results.length === 0 && !searchStatus && (
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-secondary)', fontSize: 14 }}>
                Upload documents and ask a question to see RAG results
              </div>
            )}
          </div>
        </GlassSurface>
      </div>
    </div>
  );
};

export default KnowledgeView;
