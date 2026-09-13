"use client";

/**
 * Inline Artifact Renderer
 *
 * Renders rich artifacts (HTML previews, SVG graphics, Mermaid diagrams,
 * documents, and code) directly inline in the bot session transcript.
 *
 * Supports interactive preview with storage shim, raw source code view,
 * one-click copy, new tab / popout, and file download.
 *
 * @module bot-chat/InlineArtifactRenderer
 */

import React, { memo, useCallback, useMemo, useState } from "react";
import {
  ArrowSquareOut,
  ArrowsInSimple,
  ArrowsOutSimple,
  Check,
  Code,
  Copy,
  DownloadSimple,
  Eye,
  FileText,
  Globe,
  Sparkle,
} from "@phosphor-icons/react";
import ArtifactRenderer from "@/components/artifact/ArtifactRenderer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InlineArtifact } from "./types";

export interface InlineArtifactProps {
  artifact: InlineArtifact;
  className?: string;
  defaultExpanded?: boolean;
}

function normalizeKind(kind: string): {
  label: string;
  badge: string;
  icon: React.ElementType;
  rendererType: string;
  extension: string;
  mimeType: string;
} {
  const k = kind.toLowerCase().trim();
  if (k === "html" || k === "website" || k === "document/html" || k.includes("html")) {
    return {
      label: "Interactive HTML",
      badge: "HTML",
      icon: Globe,
      rendererType: "document/html",
      extension: "html",
      mimeType: "text/html",
    };
  }
  if (k === "svg" || k === "image/svg+xml" || k.includes("svg")) {
    return {
      label: "Vector Graphic",
      badge: "SVG",
      icon: Sparkle,
      rendererType: "image/svg+xml",
      extension: "svg",
      mimeType: "image/svg+xml",
    };
  }
  if (k === "mermaid" || k.includes("mermaid")) {
    return {
      label: "Mermaid Diagram",
      badge: "DIAGRAM",
      icon: Sparkle,
      rendererType: "application/lobe.artifacts.mermaid",
      extension: "mmd",
      mimeType: "text/plain",
    };
  }
  if (k === "react" || k === "jsx" || k === "tsx" || k.includes("react")) {
    return {
      label: "React Component",
      badge: "REACT",
      icon: Code,
      rendererType: "application/lobe.artifacts.react",
      extension: "tsx",
      mimeType: "text/typescript",
    };
  }
  if (k === "markdown" || k === "doc" || k === "document" || k.includes("markdown")) {
    return {
      label: "Document",
      badge: "DOC",
      icon: FileText,
      rendererType: "text/markdown",
      extension: "md",
      mimeType: "text/markdown",
    };
  }
  return {
    label: "Code Artifact",
    badge: k.toUpperCase().slice(0, 8),
    icon: Code,
    rendererType: "document/html",
    extension: "txt",
    mimeType: "text/plain",
  };
}

export const InlineArtifactRenderer = memo(function InlineArtifactRenderer({
  artifact,
  className,
  defaultExpanded = false,
}: InlineArtifactProps) {
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const { title, content, kind, url } = artifact;
  const meta = useMemo(() => normalizeKind(kind), [kind]);
  const Icon = meta.icon;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [content]);

  const handleDownload = useCallback(() => {
    try {
      const blob = new Blob([content], { type: meta.mimeType });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const safeTitle = (title || "artifact").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
      a.download = `${safeTitle}.${meta.extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch {
      // ignore
    }
  }, [content, meta.extension, meta.mimeType, title]);

  const handlePopout = useCallback(() => {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const blob = new Blob([content], { type: meta.mimeType });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch {
      // ignore
    }
  }, [content, meta.mimeType, url]);

  return (
    <div
      data-inline-artifact
      data-artifact-id={artifact.id}
      className={cn(
        "my-3 flex w-full flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel,#1c1c1f)] text-[var(--text-primary,#ededed)] shadow-lg transition-all",
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-card,#141416)] px-3 py-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-hover,#2c2c30)] text-[var(--accent-primary)]">
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-semibold tracking-tight text-[var(--text-primary)]">
                {title || meta.label}
              </span>
              <span className="rounded-full bg-[var(--surface-hover,#2a2a2e)] px-1.5 py-0.5 text-[10px] font-medium tracking-wider text-[var(--text-secondary)]">
                {meta.badge}
              </span>
            </div>
          </div>
        </div>

        {/* Action toolbar */}
        <div className="flex items-center gap-1 shrink-0">
          {/* View toggle */}
          <div className="mr-1 flex items-center rounded-lg bg-[var(--surface-hover,#26262a)] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                viewMode === "preview"
                  ? "bg-[var(--bg-elevated,#18181b)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
              title="Interactive Preview"
            >
              <Eye size={12} />
              <span>Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("code")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                viewMode === "code"
                  ? "bg-[var(--bg-elevated,#18181b)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
              title="View Source Code"
            >
              <Code size={12} />
              <span>Code</span>
            </button>
          </div>

          {/* Copy button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-7 w-7 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            title={copied ? "Copied!" : "Copy code"}
            aria-label="Copy artifact content"
          >
            {copied ? <Check size={14} className="text-[var(--status-success)]" /> : <Copy size={14} />}
          </Button>

          {/* Download button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="h-7 w-7 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            title={`Download .${meta.extension}`}
            aria-label="Download artifact file"
          >
            <DownloadSimple size={14} />
          </Button>

          {/* Popout button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handlePopout}
            className="h-7 w-7 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            title="Open in new window"
            aria-label="Open artifact in new window"
          >
            <ArrowSquareOut size={14} />
          </Button>

          {/* Expand toggle */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded((e) => !e)}
            className="h-7 w-7 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            title={isExpanded ? "Collapse" : "Expand"}
            aria-label={isExpanded ? "Collapse height" : "Expand height"}
          >
            {isExpanded ? <ArrowsInSimple size={14} /> : <ArrowsOutSimple size={14} />}
          </Button>
        </div>
      </div>

      {/* Artifact content viewport */}
      <div
        className="relative w-full overflow-hidden bg-[var(--bg-secondary,#09090b)] transition-all"
        style={{ height: isExpanded ? "640px" : "380px" }}
      >
        {viewMode === "preview" ? (
          <div className="h-full w-full overflow-auto p-1">
            <ArtifactRenderer
              content={content}
              type={meta.rendererType}
              height="100%"
              width="100%"
            />
          </div>
        ) : (
          <div className="h-full w-full overflow-auto p-3 font-mono text-xs leading-relaxed text-[var(--text-primary)]">
            <pre className="whitespace-pre-wrap break-words">
              <code>{content}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
});
