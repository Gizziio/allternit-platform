'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, FloppyDisk, X } from '@phosphor-icons/react';
import { filesApi } from '@/lib/agents/files-api';

interface CodeFileEditorProps {
  filePath: string;
  onClose: () => void;
  onSaved?: (path: string) => void;
}

export function CodeFileEditor({ filePath, onClose, onSaved }: CodeFileEditorProps): React.ReactNode {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    filesApi
      .readFile({ path: filePath })
      .then((res) => {
        if (cancelled) return;
        setContent(res.content);
        setDirty(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to read file');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await filesApi.writeFile({ path: filePath, content });
      setDirty(false);
      onSaved?.(filePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-testid="code-file-editor"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <button
            type="button"
            data-testid="code-file-editor-back"
            onClick={onClose}
            title="Back to files"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={14} />
          </button>
          <span
            data-testid="code-file-editor-path"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={filePath}
          >
            {filePath}
          </span>
          {dirty && (
            <span
              style={{
                fontSize: 11,
                color: 'var(--status-warning)',
                fontWeight: 600,
              }}
            >
              Modified
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            data-testid="code-file-editor-save"
            onClick={handleSave}
            disabled={saving || loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'var(--accent-primary)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              cursor: saving || loading ? 'not-allowed' : 'pointer',
              opacity: saving || loading ? 0.7 : 1,
            }}
          >
            <FloppyDisk size={14} />
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            data-testid="code-file-editor-close"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '8px 12px',
            background: 'rgba(255, 59, 48, 0.10)',
            color: 'var(--status-error)',
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {loading ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 13,
            }}
          >
            Loading…
          </div>
        ) : (
          <textarea
            data-testid="code-file-editor-textarea"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setDirty(true);
            }}
            spellCheck={false}
            style={{
              width: '100%',
              height: '100%',
              resize: 'none',
              border: 'none',
              outline: 'none',
              padding: 12,
              background: 'transparent',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              lineHeight: 1.6,
            }}
          />
        )}
      </div>
    </div>
  );
}
