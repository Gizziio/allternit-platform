'use client';

import React, { useState } from 'react';
import type { Citation } from '../hooks/useNotebookApi';

interface CitationMarkerProps {
  citation: Citation;
  onClick?: (sourceId: string) => void;
}

export function CitationMarker({ citation, onClick }: CitationMarkerProps) {
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    setOpen(!open);
    onClick?.(citation.source_id);
  };

  return (
    <span className="relative inline-block">
      <sup
        onClick={handleClick}
        className="cursor-pointer font-semibold text-[11px] ml-0.5 select-none"
        style={{ color: '#a78bfa' }}
        title={`Source ${citation.index}${citation.page_number ? `, Page ${citation.page_number}` : ''}`}
      >
        [{citation.index}]
      </sup>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
          />
          <div className="research-citation-popover">
            <div className="flex items-center gap-2 mb-2">
              <span className="research-badge">
                Source {citation.index}
              </span>
              {citation.page_number && (
                <span className="text-[11px] text-[var(--text-muted,#a1a1aa)]">
                  Page {citation.page_number}
                </span>
              )}
            </div>
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary,#d4d4d8)] m-0 italic pl-2 border-l-2 border-purple-400/30">
              &ldquo;{citation.excerpt}&rdquo;
            </p>
            {onClick && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(citation.source_id);
                  setOpen(false);
                }}
                className="mt-2 text-[11px] text-purple-400 bg-transparent border-none cursor-pointer p-0"
              >
                Jump to source →
              </button>
            )}
          </div>
        </>
      )}
    </span>
  );
}
