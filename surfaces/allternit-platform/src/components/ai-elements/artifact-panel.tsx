"use client";

/**
 * ArtifactCard + ArtifactSidePanel
 *
 * ArtifactCard  — inline clickable card that appears inside the chat stream
 *                 whenever the AI produces a document, code block, or file.
 *
 * ArtifactSidePanel — the right-side viewer that slides in when a card is clicked.
 *                     Renders the content as Markdown (for docs), Shiki code,
 *                     or an image depending on the kind.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  X,
  Copy,
  Check,
  FileText,
  Code,
  Image,
  Globe,
  CaretRight,
  GitBranch,
  Warning,
  Image as ImageIcon,
} from '@phosphor-icons/react';
import { Markdown } from "./markdown";
import { CodeBlock } from "./code-block";
import type { BundledLanguage } from "shiki";
import DOMPurify from 'dompurify';

// ─── Sanitization helper ─────────────────────────────────────────────────────

/**
 * Sanitize HTML/SVG content to prevent XSS attacks
 * Configured to allow SVG elements while blocking scripts
 */
const sanitizeContent = (dirty: string): string => {
  if (typeof window === 'undefined') return dirty; // SSR safety
  
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 
               'ellipse', 'g', 'defs', 'use', 'text', 'tspan', 'tref',
               'marker', 'linearGradient', 'radialGradient', 'stop',
               'pattern', 'clipPath', 'mask', 'filter'],
    ADD_ATTR: ['viewBox', 'preserveAspectRatio', 'cx', 'cy', 'r', 'rx', 'ry',
               'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height',
               'transform', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
               'stroke-linejoin', 'opacity', 'd', 'points', 'marker-end',
               'marker-start', 'marker-mid', 'gradientUnits', 'gradientTransform',
               'offset', 'stop-color', 'stop-opacity', 'clip-path', 'mask',
               'filter', 'xmlns', 'xmlns:xlink', 'version'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout',
                  'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset'],
  });
};

// ─── Shared types ────────────────────────────────────────────────────────────

export type ArtifactKind =
  | "document"
  | "code"
  | "image"
  | "svg"
  | "html"
  | "jsx"
  | "mermaid"
  | "sheet";

export interface SelectedArtifact {
  title: string;
  kind: ArtifactKind;
  content?: string;
  url?: string;
  /** Optional: language hint for code kind */
  language?: string;
}

// ─── Kind metadata helpers ────────────────────────────────────────────────────

const KIND_META: Record<
  ArtifactKind,
  { label: string; icon: React.ReactNode; accent: string }
> = {
  document: {
    label: "Document",
    icon: <FileText size={15} />,
    accent: "rgba(212,176,140,0.7)",
  },
  code: {
    label: "Code",
    icon: <Code size={15} />,
    accent: "rgba(97,175,239,0.7)",
  },
  image: {
    label: "Image",
    icon: <ImageIcon size={15} />,
    accent: "rgba(74,222,128,0.7)",
  },
  svg: {
    label: "SVG",
    icon: <GitBranch size={15} />,
    accent: "rgba(192,132,252,0.7)",
  },
  html: {
    label: "HTML",
    icon: <Globe size={15} />,
    accent: "rgba(248,165,113,0.7)",
  },
  jsx: {
    label: "React",
    icon: <Code size={15} />,
    accent: "rgba(97,218,251,0.7)",
  },
  mermaid: {
    label: "Diagram",
    icon: <GitBranch size={15} />,
    accent: "rgba(192,132,252,0.7)",
  },
  sheet: {
    label: "Spreadsheet",
    icon: <FileText size={15} />,
    accent: "rgba(74,222,128,0.7)",
  },
};

// ─── ArtifactCard ─────────────────────────────────────────────────────────────

interface ArtifactCardProps {
  artifact: SelectedArtifact;
  isSelected?: boolean;
  onClick: () => void;
}

export function ArtifactCard({ artifact, isSelected, onClick }: ArtifactCardProps) {
  const [hovered, setHovered] = useState(false);
  const meta = KIND_META[artifact.kind] ?? KIND_META.document;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        width: "100%",
        maxWidth: "340px",
        padding: "10px 14px",
        borderRadius: "10px",
        border: isSelected
          ? `1.5px solid rgba(212,176,140,0.55)`
          : `1.5px solid ${hovered ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.09)"}`,
        background: isSelected
          ? "rgba(212,176,140,0.07)"
          : hovered
          ? "rgba(255,255,255,0.04)"
          : "rgba(255,255,255,0.025)",
        cursor: "pointer",
        textAlign: "left",
        boxShadow: isSelected
          ? "0 0 0 3px rgba(212,176,140,0.10)"
          : "none",
        transition: "border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease",
        marginTop: "8px",
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "8px",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: meta.accent,
        }}
      >
        {meta.icon}
      </div>

      {/* Text */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "rgba(236,236,236,0.92)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {artifact.title}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "rgba(236,236,236,0.38)",
            marginTop: "1px",
          }}
        >
          {meta.label}
        </div>
        {/* Content preview snippet — first line of document/code content */}
        {artifact.content && (artifact.kind === "document" || artifact.kind === "code") && (
          <div
            style={{
              fontSize: "11px",
              color: "rgba(255,255,255,0.22)",
              marginTop: "3px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontFamily: artifact.kind === "code" ? "ui-monospace, monospace" : undefined,
            }}
          >
            {artifact.content
              .split("\n")
              .find((l) => l.trim().replace(/^#+\s*/, "").length > 2)
              ?.trim()
              .replace(/^#+\s*/, "")
              .slice(0, 72) ?? ""}
          </div>
        )}
      </div>

      {/* Chevron */}
      <CaretRight
        size={14}
        style={{
          color: "rgba(255,255,255,0.25)",
          flexShrink: 0,
          transform: isSelected ? "rotate(90deg)" : "none",
          transition: "transform 0.15s ease",
        }}
      />
    </button>
  );
}

// ─── ArtifactSidePanel ────────────────────────────────────────────────────────

interface ArtifactSidePanelProps {
  artifact: SelectedArtifact | null;
  onClose: () => void;
}

export function ArtifactSidePanel({ artifact, onClose }: ArtifactSidePanelProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!artifact?.content) return;
    
    try {
      await navigator.clipboard.writeText(artifact.content);
      setIsCopied(true);
      setCopyError(false);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('[ArtifactPanel] Failed to copy to clipboard:', error);
      setCopyError(true);
      setIsCopied(false);
      setTimeout(() => setCopyError(false), 3000);
    }
  }, [artifact]);

  if (!artifact) return null;

  const meta = KIND_META[artifact.kind] ?? KIND_META.document;

  return (
    <div
      style={{
        width: "440px",
        minWidth: "440px",
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        background: "#1e1a17",
        position: "relative",
        overflow: "hidden",
        animation: "allternit-panel-slidein 0.22s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <span style={{ color: meta.accent, display: "flex", alignItems: "center" }}>
            {meta.icon}
          </span>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "rgba(236,236,236,0.88)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "260px",
            }}
          >
            {artifact.title}
          </span>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              padding: "2px 7px",
              borderRadius: "100px",
              flexShrink: 0,
            }}
          >
            {meta.label}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          {artifact.content && (
            <button
              onClick={handleCopy}
              title={copyError ? "Failed to copy" : "Copy content"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 10px",
                borderRadius: "7px",
                border: "1px solid rgba(255,255,255,0.09)",
                background: copyError 
                  ? "rgba(239,68,68,0.15)" 
                  : isCopied 
                    ? "rgba(74,222,128,0.10)" 
                    : "rgba(255,255,255,0.04)",
                color: copyError 
                  ? "rgba(239,68,68,0.9)" 
                  : isCopied 
                    ? "rgba(74,222,128,0.9)" 
                    : "rgba(255,255,255,0.5)",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 500,
                transition: "all 0.15s ease",
              }}
            >
              {copyError ? (
                <>
                  <Warning size={13} /> Failed
                </>
              ) : isCopied ? (
                <>
                  <Check size={13} /> Copied!
                </>
              ) : (
                <>
                  <Copy size={13} /> Copy
                </>
              )}
            </button>
          )}
          <button
            onClick={onClose}
            title="Close"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "7px",
              border: "1px solid rgba(255,255,255,0.09)",
              background: "rgba(255,255,255,0.03)",
              color: "rgba(255,255,255,0.45)",
              cursor: "pointer",
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "rgba(255,255,255,0.8)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              e.currentTarget.style.color = "rgba(255,255,255,0.45)";
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <ArtifactContent artifact={artifact} />
      </div>
    </div>
  );
}

// ─── Content renderers ────────────────────────────────────────────────────────

function ArtifactContent({ artifact }: { artifact: SelectedArtifact }) {
  const { kind, content, url, language } = artifact;

  // ── Document: render as rich Markdown ──
  if (kind === "document") {
    return (
      <div style={{ padding: "20px 24px", fontSize: "14px", lineHeight: 1.75 }}>
        <Markdown>{content ?? "*No content*"}</Markdown>
      </div>
    );
  }

  // ── HTML: live sandboxed iframe preview + source tab ──
  if (kind === "html") {
    return <HtmlPreview html={content ?? ""} />;
  }

  // ── JSX/Code: syntax-highlighted code block ──
  if (kind === "code" || kind === "jsx") {
    const lang = (language ?? (kind === "jsx" ? "tsx" : "text")) as BundledLanguage;
    return (
      <CodeBlock
        code={content ?? ""}
        language={lang}
        showLineNumbers
        style={{ borderRadius: 0, margin: 0, height: "100%" }}
      />
    );
  }

  // ── SVG: rendered inline ──
  if (kind === "svg" && content) {
    const sanitizedSvg = sanitizeContent(content);
    return (
      <div style={{ padding: "24px", display: "flex", justifyContent: "center" }}>
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizedSvg)}`}
          alt="SVG artifact"
          style={{ maxWidth: "100%", maxHeight: "100%" }}
        />
      </div>
    );
  }

  // ── Image ──
  if (kind === "image") {
    const src = url ?? (content?.startsWith("data:") ? content : `data:image/png;base64,${content}`);
    return (
      <div style={{ padding: "24px", display: "flex", justifyContent: "center" }}>
        <img
          src={src}
          alt={artifact.title}
          style={{ maxWidth: "100%", borderRadius: "8px" }}
        />
      </div>
    );
  }

  // ── Mermaid: live rendered diagram ──
  if (kind === "mermaid") {
    return <MermaidRenderer content={content ?? ""} />;
  }

  // ── Sheet: simple table ──
  if (kind === "sheet" && content) {
    try {
      const data: unknown[][] = JSON.parse(content);
      return (
        <div style={{ padding: "16px", overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
            <tbody>
              {data.map((row, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: table rows
                <tr key={i}>
                  {row.map((cell, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: table cells
                    <td
                      key={j}
                      style={{
                        border: "1px solid rgba(255,255,255,0.08)",
                        padding: "6px 10px",
                        color: "rgba(236,236,236,0.75)",
                      }}
                    >
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } catch {
      /* fall through */
    }
  }

  // ── Fallback ──
  return (
    <div style={{ padding: "24px", color: "rgba(236,236,236,0.5)", fontSize: "13px" }}>
      {content ?? "No preview available."}
    </div>
  );
}

// ─── Mermaid live renderer ────────────────────────────────────────────────────

function MermaidRenderer({ content }: { content: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!content) return;
    let cancelled = false;
    setSvg(null);
    setError(null);

    import("@streamdown/mermaid")
      .then(({ mermaid }) => {
        // getMermaid() returns the actual render interface
        const mm = mermaid.getMermaid();
        return mm.render(idRef.current, content);
      })
      .then(({ svg: rendered }: { svg: string }) => {
        if (!cancelled) setSvg(rendered);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(String(err));
      });

    return () => { cancelled = true; };
  }, [content]);

  if (error) {
    return (
      <div style={{ padding: "20px 24px" }}>
        <div style={{ fontSize: "11px", color: "rgba(248,113,113,0.7)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Diagram error
        </div>
        <pre style={{ fontSize: "12px", color: "#abb2bf", whiteSpace: "pre-wrap", lineHeight: 1.65, fontFamily: "ui-monospace, monospace" }}>
          {content}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div style={{ padding: "32px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "rgba(212,176,140,0.5)", animation: "allternit-fadein 0.6s ease-in-out infinite alternate" }} />
        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>Rendering diagram…</span>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", display: "flex", justifyContent: "center", overflowX: "auto" }}>
      <img
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizeContent(svg))}`}
        alt="SVG artifact"
        style={{ maxWidth: "100%", maxHeight: "100%" }}
      />
    </div>
  );
}

// ─── HTML live preview ────────────────────────────────────────────────────────

type HtmlTab = "preview" | "source";

function HtmlPreview({ html }: { html: string }) {
  const [tab, setTab] = useState<HtmlTab>("preview");

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 14px",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    border: "none",
    background: "none",
    color: active ? "rgba(212,176,140,0.9)" : "rgba(255,255,255,0.35)",
    borderBottom: active ? "1.5px solid rgba(212,176,140,0.7)" : "1.5px solid transparent",
    transition: "color 0.12s, border-color 0.12s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 8px", flexShrink: 0 }}>
        <button style={tabStyle(tab === "preview")} onClick={() => setTab("preview")}>Preview</button>
        <button style={tabStyle(tab === "source")} onClick={() => setTab("source")}>Source</button>
      </div>

      {/* Preview iframe */}
      {tab === "preview" && (
        <iframe
          srcDoc={html}
          sandbox="allow-scripts allow-same-origin allow-forms"
          style={{
            flex: 1,
            border: "none",
            width: "100%",
            background: "#ffffff",
            minHeight: "400px",
          }}
          title="HTML preview"
        />
      )}

      {/* Source view */}
      {tab === "source" && (
        <div style={{ flex: 1, overflow: "auto" }}>
          <pre
            style={{
              padding: "16px 20px",
              fontSize: "12px",
              color: "#abb2bf",
              whiteSpace: "pre-wrap",
              lineHeight: 1.65,
              fontFamily: "ui-monospace, monospace",
              margin: 0,
            }}
          >
            {html}
          </pre>
        </div>
      )}
    </div>
  );
}
