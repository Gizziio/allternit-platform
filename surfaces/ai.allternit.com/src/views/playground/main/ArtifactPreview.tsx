"use client";

import React, { useRef, useEffect } from "react";
import type { Artifact } from "./PlaygroundView.types";

interface ArtifactPreviewProps {
  artifact: Artifact | null;
}

export const ArtifactPreview: React.FC<ArtifactPreviewProps> = ({ artifact }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!artifact || !iframeRef.current) return;
    const iframe = iframeRef.current;
    if (artifact.type === 'html') {
      iframe.srcdoc = artifact.content;
    } else if (artifact.type === 'svg') {
      iframe.srcdoc = `<!DOCTYPE html><html><body style="margin:0;background:#0f0f0f;display:flex;align-items:center;justify-content:center;min-height:100vh">${artifact.content}</body></html>`;
    }
  }, [artifact]);

  if (!artifact || artifact.type === 'none') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--ui-text-muted)] gap-3">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="8" width="32" height="32" rx="8" stroke="currentColor" strokeWidth="2" />
          <path d="M16 24h16M24 16v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-[13px] text-center max-w-[220px] leading-relaxed">
          Hit <strong className="text-[var(--ui-text-muted)]">Run</strong> to generate and preview an artifact here
        </p>
      </div>
    );
  }

  if (artifact.type === 'mermaid') {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <pre className="bg-[var(--surface-canvas)] p-5 rounded-xl text-[var(--accent-primary)] text-[12px] font-mono overflow-x-auto shadow-inner border border-solid border-[var(--ui-border-muted)]">
          {artifact.content}
        </pre>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts allow-modals"
      className="flex-1 border-none bg-[var(--surface-canvas)] w-full block"
      title="Artifact Preview"
    />
  );
};
