'use client';

import React, { useState } from 'react';
import { FileCode } from '@phosphor-icons/react';
import { CodeCanvasTileDiff } from '@/components/canvas/CodeCanvasTileDiff';

interface CodeDiffPanelProps {
  initialDiff?: string;
  filePath?: string;
}

export function CodeDiffPanel({ initialDiff = '', filePath }: CodeDiffPanelProps): React.ReactNode {
  const [diffText, setDiffText] = useState(initialDiff);

  return (
    <div
      data-testid="code-diff-panel"
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
          gap: 10,
          padding: '12px 14px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'rgba(12, 15, 18, 0.12)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          <FileCode size={14} />
          Diff review
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <CodeCanvasTileDiff diffText={diffText} filePath={filePath} />
      </div>

      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          flexShrink: 0,
        }}
      >
        <textarea
          aria-label="Diff input"
          data-testid="code-diff-panel-input"
          value={diffText}
          onChange={(e) => setDiffText(e.target.value)}
          placeholder="Paste a unified diff to review…"
          style={{
            width: '100%',
            height: 80,
            resize: 'none',
            background: 'var(--surface-panel)',
            border: '1px solid var(--ui-border-default)',
            borderRadius: 8,
            padding: 10,
            color: 'var(--ui-text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );
}
