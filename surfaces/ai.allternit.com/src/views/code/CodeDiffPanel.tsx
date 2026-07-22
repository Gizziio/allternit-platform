'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  CheckCircle,
  FileCode,
  GitDiff,
  Warning,
} from '@phosphor-icons/react';
import { CodeCanvasTileDiff } from '@/components/canvas/CodeCanvasTileDiff';
import { runtimeApiUrl } from '@/lib/agents/api-config';

interface CodeDiffPanelProps {
  initialDiff?: string;
  filePath?: string;
  workingDir?: string;
}

interface GitDiffFile {
  path: string;
  diff: string;
}

interface GitDiffResponse {
  files?: GitDiffFile[];
}

function countChangedLines(files: GitDiffFile[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const file of files) {
    for (const line of file.diff.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) additions += 1;
      if (line.startsWith('-') && !line.startsWith('---')) deletions += 1;
    }
  }
  return { additions, deletions };
}

export function CodeDiffPanel({ initialDiff = '', filePath, workingDir }: CodeDiffPanelProps): React.ReactNode {
  const [files, setFiles] = useState<GitDiffFile[]>(() => (
    initialDiff ? [{ path: filePath || 'Working diff', diff: initialDiff }] : []
  ));
  const [selectedPath, setSelectedPath] = useState(filePath || '');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    if (initialDiff) {
      const path = filePath || 'Working diff';
      setFiles([{ path, diff: initialDiff }]);
      setSelectedPath(path);
      setError(null);
      return;
    }

    if (!workingDir) {
      setFiles([]);
      setSelectedPath('');
      setError(null);
      return;
    }

    const controller = new AbortController();
    setError(null);
    setIsLoading(true);
    fetch(runtimeApiUrl('/git/diff'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: workingDir, staged: false, file: filePath }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Diff service returned ${response.status}`);
        return response.json() as Promise<GitDiffResponse>;
      })
      .then((result) => {
        const nextFiles = (result.files ?? []).filter((file) => Boolean(file.diff));
        setFiles(nextFiles);
        setSelectedPath((current) => (
          nextFiles.some((file) => file.path === current) ? current : (nextFiles[0]?.path ?? '')
        ));
        setIsLoading(false);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Unable to load working tree');
          setIsLoading(false);
        }
      });
    return () => controller.abort();
  }, [filePath, initialDiff, reloadVersion, workingDir]);

  const stats = useMemo(() => countChangedLines(files), [files]);
  const selected = files.find((file) => file.path === selectedPath) ?? files[0];

  return (
    <div
      data-testid="code-diff-panel"
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-canvas)',
        color: 'var(--text-primary)',
      }}
    >
      <div
        style={{
          minHeight: 42,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 10px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--glass-bg-thick)',
          backdropFilter: 'blur(16px) saturate(150%)',
          WebkitBackdropFilter: 'blur(16px) saturate(150%)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 7,
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-panel)',
            color: 'var(--accent-code)',
          }}
        >
          <GitDiff size={14} weight="duotone" />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700 }}>Working changes</div>
          <div style={{ marginTop: 1, fontSize: 9, color: 'var(--text-tertiary)' }}>
            {workingDir ? workingDir.split('/').pop() : 'Paste or select a workspace diff'}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {files.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 9 }}>
            <span style={{ padding: '3px 6px', borderRadius: 5, background: 'var(--status-success-bg)', color: 'var(--status-success)' }}>
              +{stats.additions}
            </span>
            <span style={{ padding: '3px 6px', borderRadius: 5, background: 'var(--status-error-bg)', color: 'var(--status-error)' }}>
              −{stats.deletions}
            </span>
            <span style={{ color: 'var(--text-tertiary)', marginLeft: 2 }}>
              {files.length} file{files.length === 1 ? '' : 's'}
            </span>
          </div>
        )}

        {workingDir && !initialDiff && (
          <button
            type="button"
            aria-label="Refresh working changes"
            title="Refresh working changes"
            onClick={() => setReloadVersion((version) => version + 1)}
            disabled={isLoading}
            style={{
              width: 28,
              height: 28,
              display: 'grid',
              placeItems: 'center',
              border: '1px solid var(--border-subtle)',
              borderRadius: 7,
              background: 'var(--surface-panel)',
              color: 'var(--text-secondary)',
              cursor: isLoading ? 'wait' : 'pointer',
            }}
          >
            <ArrowsClockwise size={13} className={isLoading ? 'animate-spin' : undefined} />
          </button>
        )}
      </div>

      {files.length > 1 && (
        <div
          style={{
            minHeight: 34,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            overflowX: 'auto',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--surface-panel)',
            flexShrink: 0,
          }}
        >
          {files.map((file) => {
            const active = file.path === selected?.path;
            return (
              <button
                type="button"
                key={file.path}
                onClick={() => setSelectedPath(file.path)}
                style={{
                  height: 25,
                  maxWidth: 220,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '0 8px',
                  border: `1px solid ${active ? 'var(--border-strong)' : 'transparent'}`,
                  borderRadius: 6,
                  background: active ? 'var(--surface-active)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontSize: 10,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <FileCode size={11} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.path}</span>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <CenteredState
            icon={<ArrowsClockwise size={18} className="animate-spin" />}
            title="Reading working tree"
            description="Collecting changed files and diff hunks…"
          />
        ) : error ? (
          <CenteredState
            tone="error"
            icon={<Warning size={18} />}
            title="Changes are unavailable"
            description={error}
            action={workingDir ? (
              <button type="button" onClick={() => setReloadVersion((version) => version + 1)} style={stateButtonStyle}>
                Try again
              </button>
            ) : undefined}
          />
        ) : selected ? (
          <CodeCanvasTileDiff diffText={selected.diff} filePath={selected.path} />
        ) : workingDir ? (
          <CenteredState
            tone="success"
            icon={<CheckCircle size={19} weight="fill" />}
            title="Working tree is clean"
            description="There are no unstaged changes to review in this workspace."
          />
        ) : (
          <CodeCanvasTileDiff diffText="" filePath={filePath} />
        )}
      </div>
    </div>
  );
}

const stateButtonStyle: React.CSSProperties = {
  marginTop: 4,
  padding: '5px 10px',
  border: '1px solid var(--border-subtle)',
  borderRadius: 6,
  background: 'var(--surface-panel)',
  color: 'var(--text-secondary)',
  fontSize: 10,
  fontWeight: 650,
  cursor: 'pointer',
};

function CenteredState({
  icon,
  title,
  description,
  tone = 'neutral',
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tone?: 'neutral' | 'success' | 'error';
  action?: React.ReactNode;
}) {
  const color = tone === 'success'
    ? 'var(--status-success)'
    : tone === 'error'
      ? 'var(--status-error)'
      : 'var(--text-tertiary)';
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 330, textAlign: 'center' }}>
        <span
          style={{
            width: 38,
            height: 38,
            margin: '0 auto',
            display: 'grid',
            placeItems: 'center',
            border: '1px solid var(--border-subtle)',
            borderRadius: 9,
            background: 'var(--surface-panel)',
            color,
          }}
        >
          {icon}
        </span>
        <div style={{ marginTop: 10, fontSize: 12, fontWeight: 650, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ marginTop: 3, fontSize: 10, lineHeight: 1.5, color: 'var(--text-tertiary)' }}>{description}</div>
        {action}
      </div>
    </div>
  );
}
