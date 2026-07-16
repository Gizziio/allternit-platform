"use client";

import React, { useMemo, useState } from 'react';
import { FileCode, CaretLeft, CaretRight, Check, X } from '@phosphor-icons/react';

interface DiffLine {
  type: 'addition' | 'deletion' | 'context' | 'hunk-header';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

interface ParsedDiffFile {
  filePath: string;
  extension: string;
  hunks: DiffHunk[];
}

interface CodeCanvasTileDiffProps {
  diffText?: string;
  filePath?: string;
  onApplyHunk?: (filePath: string, hunkIndex: number) => void;
  onRejectHunk?: (filePath: string, hunkIndex: number) => void;
}

function getFileExtension(path: string): string {
  const match = path.match(/\.([^.\/]+)$/);
  return match ? match[1].toLowerCase() : '';
}

function parseUnifiedDiff(diffText: string, fallbackPath = 'Working diff'): ParsedDiffFile[] {
  const files: ParsedDiffFile[] = [];
  const lines = diffText.split('\n');
  let currentFile: ParsedDiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  const pushHunk = () => {
    if (currentHunk && currentFile) {
      currentFile.hunks.push(currentHunk);
    }
    currentHunk = null;
  };

  const pushFile = () => {
    if (currentFile) {
      pushHunk();
      files.push(currentFile);
    }
    currentFile = null;
  };

  for (const rawLine of lines) {
    if (rawLine.startsWith('diff --git')) {
      pushFile();
      const match = rawLine.match(/diff --git a\/(.+?) b\//);
      const filePath = match?.[1] || 'unknown';
      currentFile = { filePath, extension: getFileExtension(filePath), hunks: [] };
      continue;
    }

    if (rawLine.startsWith('--- ') && !currentFile) {
      const oldPath = rawLine.slice(4).trim().replace(/^a\//, '');
      const resolvedPath = oldPath === '/dev/null' ? fallbackPath : oldPath;
      currentFile = { filePath: resolvedPath || fallbackPath, extension: getFileExtension(resolvedPath), hunks: [] };
      continue;
    }

    if (rawLine.startsWith('+++ ')) {
      const nextPath = rawLine.slice(4).trim().replace(/^b\//, '');
      if (!currentFile) {
        const resolvedPath = nextPath === '/dev/null' ? fallbackPath : nextPath;
        currentFile = { filePath: resolvedPath || fallbackPath, extension: getFileExtension(resolvedPath), hunks: [] };
      } else if (nextPath !== '/dev/null') {
        currentFile.filePath = nextPath || currentFile.filePath;
        currentFile.extension = getFileExtension(currentFile.filePath);
      }
      continue;
    }

    if (rawLine.startsWith('@@')) {
      if (!currentFile) {
        currentFile = { filePath: fallbackPath, extension: getFileExtension(fallbackPath), hunks: [] };
      }
      pushHunk();
      const match = rawLine.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      currentHunk = { header: rawLine, lines: [{ type: 'hunk-header', content: rawLine }] };
      continue;
    }

    if (!currentFile) continue;

    if (!currentHunk) continue;

    if (rawLine.startsWith('+')) {
      currentHunk.lines.push({
        type: 'addition',
        newLineNumber: newLine++,
        content: rawLine.slice(1),
      });
    } else if (rawLine.startsWith('-')) {
      currentHunk.lines.push({
        type: 'deletion',
        oldLineNumber: oldLine++,
        content: rawLine.slice(1),
      });
    } else {
      if (rawLine.startsWith('\\ No newline at end of file')) continue;
      currentHunk.lines.push({
        type: 'context',
        oldLineNumber: oldLine,
        newLineNumber: newLine,
        content: rawLine.startsWith(' ') ? rawLine.slice(1) : rawLine,
      });
      oldLine++;
      newLine++;
    }
  }

  pushFile();
  return files;
}

function HunkActions({
  filePath,
  hunkIndex,
  totalHunks,
  activeHunk,
  onPrev,
  onNext,
  onApply,
  onReject,
  canDecide,
}: {
  filePath: string;
  hunkIndex: number;
  totalHunks: number;
  activeHunk: number;
  onPrev: () => void;
  onNext: () => void;
  onApply: () => void;
  onReject: () => void;
  canDecide: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '6px 12px',
        background: 'var(--surface-hover)',
        borderBottom: '1px solid var(--ui-border-muted)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ui-text-secondary)' }}>
          Hunk {activeHunk + 1} of {totalHunks}
        </span>
        <button
          type="button"
          data-testid={`code-diff-hunk-prev-${filePath}`}
          onClick={onPrev}
          disabled={activeHunk === 0}
          style={iconButtonStyle(activeHunk > 0)}
        >
          <CaretLeft size={12} />
        </button>
        <button
          type="button"
          data-testid={`code-diff-hunk-next-${filePath}`}
          onClick={onNext}
          disabled={activeHunk >= totalHunks - 1}
          style={iconButtonStyle(activeHunk < totalHunks - 1)}
        >
          <CaretRight size={12} />
        </button>
      </div>
      {canDecide && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          data-testid={`code-diff-hunk-reject-${filePath}`}
          onClick={onReject}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid rgba(255, 59, 48, 0.30)',
            background: 'rgba(255, 59, 48, 0.10)',
            color: 'var(--status-error)',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <X size={12} />
          Reject
        </button>
        <button
          type="button"
          data-testid={`code-diff-hunk-apply-${filePath}`}
          onClick={onApply}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid rgba(52, 199, 89, 0.30)',
            background: 'rgba(52, 199, 89, 0.10)',
            color: 'var(--status-success)',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Check size={12} />
          Apply
        </button>
      </div>}
    </div>
  );
}

function iconButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 6,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'transparent',
    color: enabled ? 'var(--text-secondary)' : 'var(--text-tertiary)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.5,
  };
}

export function CodeCanvasTileDiff({
  diffText,
  filePath,
  onApplyHunk,
  onRejectHunk,
}: CodeCanvasTileDiffProps) {
  const [pastedDiff, setPastedDiff] = useState('');
  const [hunkIndexByFile, setHunkIndexByFile] = useState<Record<string, number>>({});
  const activeDiff = diffText || pastedDiff;

  const files = useMemo(
    () => (activeDiff ? parseUnifiedDiff(activeDiff, filePath || 'Working diff') : []),
    [activeDiff, filePath],
  );

  const setHunkIndex = (filePath: string, index: number) => {
    setHunkIndexByFile((prev) => ({ ...prev, [filePath]: index }));
  };

  if (!activeDiff) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ui-text-muted)',
          fontSize: 12,
          gap: 10,
          padding: 24,
        }}
      >
        <span style={{ width: 38, height: 38, display: 'grid', placeItems: 'center', border: '1px solid var(--border-subtle)', borderRadius: 9, background: 'var(--surface-panel)' }}>
          <FileCode size={18} opacity={0.55} />
        </span>
        <span style={{ fontWeight: 650, color: 'var(--text-secondary)' }}>No diff selected</span>
        <span style={{ fontSize: 10, lineHeight: 1.5, color: 'var(--text-tertiary)', textAlign: 'center' }}>
          Select a workspace to load the working tree diff, or paste a unified diff below.
        </span>
        <textarea
          aria-label="Text Area"
          value={pastedDiff}
          onChange={(e) => setPastedDiff(e.target.value)}
          placeholder="Paste unified diff here…"
          style={{
            width: '100%',
            maxWidth: 460,
            height: 96,
            background: 'var(--surface-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 10,
            color: 'var(--ui-text-secondary)',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            resize: 'none',
            outline: 'none',
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        lineHeight: 1.55,
        background: 'rgba(0,0,0,0.08)',
      }}
    >
      {files.map((file) => {
        const displayPath = filePath || file.filePath;
        const totalHunks = file.hunks.length;
        const activeHunk = hunkIndexByFile[displayPath] ?? 0;
        const hunk = file.hunks[Math.min(activeHunk, Math.max(0, totalHunks - 1))] ?? file.hunks[0];

        return (
          <div key={`codecanvastilediff-${displayPath}`}>
            <div
              style={{
                minHeight: 32,
                padding: '5px 10px',
                background: 'var(--surface-panel)',
                borderBottom: '1px solid var(--ui-border-muted)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--ui-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                position: 'sticky',
                top: 0,
                zIndex: 1,
              }}
            >
              <FileCode size={12} color="var(--accent-code)" />
              {displayPath}
            </div>

            {totalHunks > 1 && hunk && (
              <HunkActions
                filePath={displayPath}
                hunkIndex={activeHunk}
                totalHunks={totalHunks}
                activeHunk={activeHunk}
                onPrev={() => setHunkIndex(displayPath, Math.max(0, activeHunk - 1))}
                onNext={() => setHunkIndex(displayPath, Math.min(totalHunks - 1, activeHunk + 1))}
                onApply={() => onApplyHunk?.(displayPath, activeHunk)}
                onReject={() => onRejectHunk?.(displayPath, activeHunk)}
                canDecide={Boolean(onApplyHunk || onRejectHunk)}
              />
            )}

            <div style={{ padding: '8px 0' }}>
              {hunk?.lines.map((line, i) => (
                <div
                  key={`codecanvastilediff-${displayPath}-${i}`}
                  className={`code-diff-line code-diff-line-${line.type} code-diff-line-lang-${file.extension}`}
                  style={{
                    display: 'flex',
                    background:
                      line.type === 'addition'
                        ? 'rgba(52, 199, 89, 0.08)'
                        : line.type === 'deletion'
                          ? 'rgba(255, 59, 48, 0.08)'
                          : line.type === 'hunk-header'
                            ? 'rgba(255, 255, 255, 0.04)'
                            : 'transparent',
                    minHeight: 18,
                    padding: '0 10px 0 0',
                    borderLeft: line.type === 'addition'
                      ? '2px solid rgba(52,199,89,0.55)'
                      : line.type === 'deletion'
                        ? '2px solid rgba(255,59,48,0.55)'
                        : '2px solid transparent',
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      opacity: line.type === 'hunk-header' ? 0 : 0.25,
                      userSelect: 'none',
                      textAlign: 'right',
                      paddingRight: 7,
                      background: 'rgba(0,0,0,0.08)',
                      flexShrink: 0,
                    }}
                  >
                    {line.oldLineNumber ?? ''}
                  </div>
                  <div
                    style={{
                      width: 34,
                      opacity: line.type === 'hunk-header' ? 0 : 0.25,
                      userSelect: 'none',
                      textAlign: 'right',
                      paddingRight: 7,
                      background: 'rgba(0,0,0,0.08)',
                      flexShrink: 0,
                    }}
                  >
                    {line.newLineNumber ?? ''}
                  </div>
                  <div
                    style={{
                      color:
                        line.type === 'addition'
                          ? 'var(--status-success)'
                          : line.type === 'deletion'
                            ? 'var(--status-error)'
                            : line.type === 'hunk-header'
                              ? 'var(--ui-text-muted)'
                              : 'inherit',
                      paddingLeft: 4,
                      whiteSpace: 'pre',
                      minWidth: 'max-content',
                      fontWeight: line.type === 'hunk-header' ? 600 : 400,
                    }}
                  >
                    {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : line.type === 'hunk-header' ? ' ' : ' '}
                    {line.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
