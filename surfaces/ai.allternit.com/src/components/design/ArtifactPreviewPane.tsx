"use client";

import { ArrowSquareOut, DownloadSimple } from "@phosphor-icons/react";

interface Props {
  html: string;
  title: string;
  identifier: string;
  className?: string;
  height?: number | string;
}

function openInNewTab(html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function exportHtml(html: string, identifier: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${identifier}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function ArtifactPreviewPane({ html, title, identifier, className, height = 600 }: Props) {
  return (
    <div
      className={className}
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--surface-panel)",
          borderBottom: "1px solid var(--border-default)",
          padding: "8px 12px",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "60%",
          }}
        >
          {title}
        </span>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <button
            onClick={() => openInNewTab(html)}
            title="Open in new tab"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "none",
              border: "1px solid var(--border-default)",
              borderRadius: "4px",
              padding: "4px 8px",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: "11px",
              fontWeight: 500,
            }}
          >
            <ArrowSquareOut size={12} />
            Open
          </button>
          <button
            onClick={() => exportHtml(html, identifier)}
            title="Export HTML"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "none",
              border: "1px solid var(--border-default)",
              borderRadius: "4px",
              padding: "4px 8px",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: "11px",
              fontWeight: 500,
            }}
          >
            <DownloadSimple size={12} />
            Export
          </button>
        </div>
      </div>
      <iframe
        srcDoc={html}
        sandbox="allow-scripts allow-same-origin"
        style={{ border: "none", display: "block", width: "100%", height }}
        title={title}
      />
    </div>
  );
}
