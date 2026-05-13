"use client";

import { useEffect, useRef, useState, useCallback, memo } from "react";
import { IconCopy, IconCheck, IconDownload, IconMaximize, IconMinimize } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type MermaidArtifactProps = {
  content: string;
  /** When true, debounces rendering so partial token streams don't cause parse errors */
  isStreaming?: boolean;
  className?: string;
};

let mermaidModule: typeof import("mermaid") | null = null;

async function initMermaid() {
  if (mermaidModule) return mermaidModule;
  mermaidModule = await import("mermaid");
  mermaidModule.default.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "strict",
    fontFamily: "inherit",
  });
  return mermaidModule;
}

export const MermaidArtifact = memo(function MermaidArtifact({
  content,
  isStreaming = false,
  className,
}: MermaidArtifactProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const renderDiagram = useCallback(async (source: string) => {
    if (!source.trim()) return;
    try {
      const m = await initMermaid();
      const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
      const { svg: renderedSvg } = await m.default.render(id, source.trim());
      setSvg(renderedSvg);
      setError(null);
    } catch (err) {
      // Suppress errors during streaming — partial syntax always fails
      if (!isStreaming) {
        setError(err instanceof Error ? err.message : "Failed to render diagram");
        setSvg("");
      }
    }
  }, [isStreaming]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (isStreaming) {
      debounceRef.current = setTimeout(() => renderDiagram(content), 500);
    } else {
      renderDiagram(content);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [content, isStreaming, renderDiagram]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleDownloadSvg = useCallback(() => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagram-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [svg]);

  return (
    <div
      className={cn(
        "rounded-an-tool-border-radius border border-border bg-an-tool-background overflow-hidden flex flex-col",
        isFullscreen && "fixed inset-4 z-[100] shadow-2xl",
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-an-tool-border-color bg-background/50">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Mermaid Diagram
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title="Copy source"
          >
            {copied ? (
              <IconCheck className="size-3.5  text-emerald-500" />
            ) : (
              <IconCopy className="size-3.5  text-muted-foreground" />
            )}
          </button>
          <button
            onClick={handleDownloadSvg}
            disabled={!svg}
            className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30"
            title="Download SVG"
          >
            <IconDownload className="size-3.5  text-muted-foreground" />
          </button>
          <button
            onClick={() => setIsFullscreen((f) => !f)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <IconMinimize className="size-3.5  text-muted-foreground" />
            ) : (
              <IconMaximize className="size-3.5  text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Diagram */}
      <div className="relative flex-1 min-h-[200px] max-h-[600px] overflow-auto bg-background p-4 flex items-center justify-center">
        {error ? (
          <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3 max-w-md">
            <p className="font-medium mb-1">Diagram Error</p>
            <p className="text-destructive/80">{error}</p>
          </div>
        ) : svg ? (
          <div
            ref={containerRef}
            className="w-full flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="size-4  border-2 border-muted-foreground/20 border-t-muted-foreground/60 rounded-full animate-spin" />
            {isStreaming ? "Waiting for complete diagram..." : "Rendering diagram..."}
          </div>
        )}
      </div>

      {/* Source toggle */}
      <details className="border-t border-an-tool-border-color">
        <summary className="px-3 py-2 text-xs text-muted-foreground cursor-pointer hover:bg-muted/30 transition-colors select-none">
          View source
        </summary>
        <pre className="px-3 py-2 text-xs text-foreground/80 bg-muted/30 overflow-x-auto max-h-[200px]">
          <code>{content}</code>
        </pre>
      </details>
    </div>
  );
});
