"use client";

import React, { useState, useCallback } from 'react';
import { Globe, ArrowClockwise, ArrowSquareOut } from '@phosphor-icons/react';

interface CodeCanvasTilePreviewProps {
  url?: string;
  filePath?: string;
}

export function CodeCanvasTilePreview({ url, filePath }: CodeCanvasTilePreviewProps) {
  const [currentUrl, setCurrentUrl] = useState(url || 'http://localhost:3000');
  const [inputUrl, setInputUrl] = useState(currentUrl);
  const [key, setKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setKey((k) => k + 1);
  }, []);

  const handleNavigate = useCallback(() => {
    setCurrentUrl(inputUrl);
    setKey((k) => k + 1);
  }, [inputUrl]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleNavigate();
      }
    },
    [handleNavigate],
  );

  const displayLabel = filePath || currentUrl;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* URL bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderBottom: '1px solid var(--ui-border-muted)',
          background: 'var(--surface-hover)',
          flexShrink: 0,
        }}
      >
        <Globe size={12} color="var(--text-tertiary)" />
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleNavigate}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 11,
            fontFamily: 'monospace',
            outline: 'none',
          }}
          placeholder="Enter URL..."
        />
        <button
          onClick={handleRefresh}
          title="Refresh"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ArrowClockwise size={12} />
        </button>
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in new tab"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ArrowSquareOut size={12} />
        </a>
      </div>

      {/* Iframe */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <iframe
          key={key}
          src={currentUrl}
          title={displayLabel}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            background: '#0a0c0e',
          }}
        />
      </div>
    </div>
  );
}
