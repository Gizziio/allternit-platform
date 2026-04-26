"use client";

import React from 'react';
import { FileCode } from '@phosphor-icons/react';

interface DiffLine {
  type: 'addition' | 'deletion' | 'context';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

interface CodeCanvasTileDiffProps {
  diffText?: string;
  filePath?: string;
}

function parseUnifiedDiff(diffText: string): { filePath: string; lines: DiffLine[] }[] {
  const files: { filePath: string; lines: DiffLine[] }[] = [];
  const lines = diffText.split('\n');
  let currentFile: { filePath: string; lines: DiffLine[] } | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const rawLine of lines) {
    // Detect file header
    if (rawLine.startsWith('diff --git')) {
      if (currentFile) files.push(currentFile);
      const match = rawLine.match(/diff --git a\/(.+?) b\//);
      currentFile = { filePath: match?.[1] || 'unknown', lines: [] };
      continue;
    }
    // Detect hunk header
    if (rawLine.startsWith('@@')) {
      const match = rawLine.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      if (currentFile) {
        currentFile.lines.push({ type: 'context', content: rawLine });
      }
      continue;
    }
    if (!currentFile) continue;

    if (rawLine.startsWith('+')) {
      currentFile.lines.push({
        type: 'addition',
        newLineNumber: newLine++,
        content: rawLine.slice(1),
      });
    } else if (rawLine.startsWith('-')) {
      currentFile.lines.push({
        type: 'deletion',
        oldLineNumber: oldLine++,
        content: rawLine.slice(1),
      });
    } else {
      currentFile.lines.push({
        type: 'context',
        oldLineNumber: oldLine,
        newLineNumber: newLine,
        content: rawLine,
      });
      oldLine++;
      newLine++;
    }
  }

  if (currentFile) files.push(currentFile);
  return files;
}

export function CodeCanvasTileDiff({ diffText, filePath }: CodeCanvasTileDiffProps) {
  if (!diffText) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: 13,
          gap: 8,
        }}
      >
        <FileCode size={24} opacity={0.3} />
        <span>No diff content</span>
      </div>
    );
  }

  const files = parseUnifiedDiff(diffText);

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        fontFamily: 'monospace',
        fontSize: 12,
        lineHeight: 1.6,
      }}
    >
      {files.map((file, fi) => (
        <div key={fi}>
          <div
            style={{
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.03)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            <FileCode size={12} color="var(--accent-code)" />
            {filePath || file.filePath}
          </div>
          <div style={{ padding: '8px 0' }}>
            {file.lines.map((line, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  background:
                    line.type === 'addition'
                      ? 'rgba(52, 199, 89, 0.08)'
                      : line.type === 'deletion'
                        ? 'rgba(255, 59, 48, 0.08)'
                        : 'transparent',
                  padding: '0 12px',
                }}
              >
                <div
                  style={{
                    width: 36,
                    opacity: 0.25,
                    userSelect: 'none',
                    textAlign: 'right',
                    paddingRight: 8,
                    flexShrink: 0,
                  }}
                >
                  {line.oldLineNumber ?? ''}
                </div>
                <div
                  style={{
                    width: 36,
                    opacity: 0.25,
                    userSelect: 'none',
                    textAlign: 'right',
                    paddingRight: 8,
                    flexShrink: 0,
                  }}
                >
                  {line.newLineNumber ?? ''}
                </div>
                <div
                  style={{
                    color:
                      line.type === 'addition'
                        ? '#34c759'
                        : line.type === 'deletion'
                          ? '#ff3b30'
                          : 'inherit',
                    paddingLeft: 4,
                    whiteSpace: 'pre',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' '}
                  {line.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
