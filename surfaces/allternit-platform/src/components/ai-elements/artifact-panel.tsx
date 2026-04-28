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
  FilmStrip,
  SpinnerGap,
  ArrowsOut,
} from '@phosphor-icons/react';
import { useNav } from '@/nav/useNav';
import { Markdown } from "./markdown";
import { CodeBlock } from "./code-block";
import { AllternitOpenUIRenderer } from '@/lib/openui/AllternitOpenUIRenderer';
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
  | "sheet"
  | "openui";

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
  openui: {
    label: "Interactive UI",
    icon: <GitBranch size={15} />,
    accent: "rgba(212,176,140,0.7)",
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
  const { dispatch } = useNav();
  const meta = KIND_META[artifact.kind] ?? KIND_META.document;

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({
      type: 'PUSH_VIEW',
      viewType: 'allternit-ix' as any,
      viewId: `canvas-${artifact.title}`,
      title: artifact.title,
      context: {
        stream: artifact.content,
      } as any,
    });
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative"
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
          : `1.5px solid ${hovered ? "var(--ui-border-strong)" : "var(--ui-border-muted)"}`,
        background: isSelected
          ? "color-mix(in srgb, var(--accent-primary) 7%, transparent)"
          : hovered
          ? "var(--surface-hover)"
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
          background: "var(--ui-border-muted)",
          border: "1px solid var(--ui-border-muted)",
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

      {artifact.kind === 'openui' && hovered && (
        <div 
          onClick={handleExpand}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'var(--accent-primary)',
            color: 'var(--bg-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
            zIndex: 10,
            transition: 'transform 0.2s ease',
          }}
          className="hover:scale-110 active:scale-95"
          title="Expand to Full Canvas"
        >
          <ArrowsOut size={14} weight="bold" />
        </div>
      )}

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

// ─── HyperFrames render hook ──────────────────────────────────────────────────

type RenderFormat = 'mp4' | 'mov' | 'webm';
type RenderStatus = 'idle' | 'checking' | 'rendering' | 'done' | 'error' | 'unavailable';

function useHyperFrames(html: string | undefined) {
  const [status, setStatus] = useState<RenderStatus>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [savedPath, setSavedPath] = useState('');

  const render = useCallback(async (format: RenderFormat = 'mp4') => {
    if (!html) return;

    // Only available in Electron
    const hf = (window as Window & { allternit?: { hyperframes?: { check: () => Promise<{ available: boolean }>; render: (html: string, opts: { format: RenderFormat }) => Promise<{ success: boolean; savedPath?: string; error?: string }>; onProgress: (h: (m: string) => void) => () => void } } }).allternit?.hyperframes;
    if (!hf) {
      setStatus('unavailable');
      return;
    }

    setStatus('checking');
    setProgress('');
    setError('');
    setSavedPath('');

    const check = await hf.check();
    if (!check.available) {
      setStatus('unavailable');
      setError('HyperFrames not installed. Run: npx skills add heygen-com/hyperframes');
      return;
    }

    setStatus('rendering');
    const unsub = hf.onProgress((msg) => setProgress(msg));

    try {
      const result = await hf.render(html, { format });
      unsub();
      if (result.success && result.savedPath) {
        setStatus('done');
        setSavedPath(result.savedPath);
      } else {
        setStatus('error');
        setError(result.error ?? 'Render failed');
      }
    } catch (err) {
      unsub();
      setStatus('error');
      setError(String(err));
    }
  }, [html]);

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress('');
    setError('');
    setSavedPath('');
  }, []);

  return { status, progress, error, savedPath, render, reset };
}

export function ArtifactSidePanel({ artifact, onClose }: ArtifactSidePanelProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [showRenderModal, setShowRenderModal] = useState(false);
  const [renderFormat, setRenderFormat] = useState<RenderFormat>('mp4');
  const hf = useHyperFrames(artifact?.kind === 'html' ? artifact.content : undefined);

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

  const handleRender = useCallback(async () => {
    await hf.render(renderFormat);
  }, [hf, renderFormat]);

  if (!artifact) return null;

  const meta = KIND_META[artifact.kind] ?? KIND_META.document;

  return (
    <div
      style={{
        width: "440px",
        minWidth: "440px",
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid var(--ui-border-muted)",
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
          borderBottom: "1px solid var(--ui-border-muted)",
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
              background: "var(--ui-border-muted)",
              border: "1px solid var(--ui-border-muted)",
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
                border: "1px solid var(--ui-border-muted)",
                background: copyError 
                  ? "var(--status-error-bg)" 
                  : isCopied 
                    ? "rgba(74,222,128,0.10)" 
                    : "var(--surface-hover)",
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

          {/* Render as Video — only for HTML artifacts, only in Electron */}
          {artifact.kind === 'html' && hf.status !== 'unavailable' && (
            <button
              onClick={() => setShowRenderModal((v) => !v)}
              title="Render as video"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 10px",
                borderRadius: "7px",
                border: "1px solid var(--ui-border-muted)",
                background: showRenderModal
                  ? "rgba(248,165,113,0.12)"
                  : hf.status === 'done'
                  ? "rgba(74,222,128,0.10)"
                  : "var(--surface-hover)",
                color: hf.status === 'done'
                  ? "rgba(74,222,128,0.9)"
                  : "rgba(248,165,113,0.8)",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 500,
                transition: "all 0.15s ease",
              }}
            >
              {hf.status === 'rendering' ? (
                <><SpinnerGap size={13} style={{ animation: 'spin 1s linear infinite' }} /> Rendering…</>
              ) : hf.status === 'done' ? (
                <><Check size={13} /> Saved</>
              ) : (
                <><FilmStrip size={13} /> Video</>
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
              border: "1px solid var(--ui-border-muted)",
              background: "var(--surface-hover)",
              color: "rgba(255,255,255,0.45)",
              cursor: "pointer",
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--ui-border-muted)";
              e.currentTarget.style.color = "rgba(255,255,255,0.8)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--surface-hover)";
              e.currentTarget.style.color = "rgba(255,255,255,0.45)";
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── HyperFrames render panel ── */}
      {showRenderModal && artifact.kind === 'html' && (
        <div
          style={{
            borderBottom: "1px solid var(--ui-border-muted)",
            padding: "12px 16px",
            background: "rgba(248,165,113,0.04)",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 600, color: "rgba(248,165,113,0.7)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>
            Export as Video
          </div>

          {/* Format selector */}
          {hf.status === 'idle' || hf.status === 'error' ? (
            <>
              <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                {(['mp4', 'webm', 'mov'] as RenderFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setRenderFormat(fmt)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: `1px solid ${renderFormat === fmt ? "rgba(248,165,113,0.5)" : "var(--ui-border-muted)"}`,
                      background: renderFormat === fmt ? "rgba(248,165,113,0.12)" : "var(--surface-hover)",
                      color: renderFormat === fmt ? "rgba(248,165,113,0.9)" : "rgba(255,255,255,0.4)",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
              {hf.status === 'error' && (
                <div style={{ fontSize: "11px", color: "rgba(239,68,68,0.8)", marginBottom: "8px", wordBreak: "break-word" }}>
                  {hf.error}
                </div>
              )}
              <button
                onClick={handleRender}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  borderRadius: "7px",
                  border: "1px solid rgba(248,165,113,0.3)",
                  background: "rgba(248,165,113,0.12)",
                  color: "rgba(248,165,113,0.9)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <FilmStrip size={13} />
                Render {renderFormat.toUpperCase()}
              </button>
            </>
          ) : hf.status === 'checking' || hf.status === 'rendering' ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "rgba(248,165,113,0.7)" }}>
              <SpinnerGap size={14} style={{ animation: 'spin 1s linear infinite' }} />
              {hf.progress || (hf.status === 'checking' ? 'Checking dependencies…' : 'Rendering…')}
            </div>
          ) : hf.status === 'done' ? (
            <div style={{ fontSize: "12px", color: "rgba(74,222,128,0.85)" }}>
              <div style={{ fontWeight: 600, marginBottom: "3px" }}>Saved!</div>
              <div style={{ color: "rgba(255,255,255,0.35)", wordBreak: "break-all", fontFamily: "ui-monospace, monospace", fontSize: "11px" }}>{hf.savedPath}</div>
              <button
                onClick={hf.reset}
                style={{ marginTop: "8px", padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--ui-border-muted)", background: "var(--surface-hover)", color: "rgba(255,255,255,0.4)", fontSize: "11px", cursor: "pointer" }}
              >
                Render another
              </button>
            </div>
          ) : null}
        </div>
      )}

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

  // ── OpenUI: Generative UI ──
  if (kind === "openui") {
    return (
      <div style={{ padding: "20px" }}>
        <AllternitOpenUIRenderer stream={content ?? ""} />
      </div>
    );
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
                        border: "1px solid var(--ui-border-muted)",
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
      <div style={{ display: "flex", borderBottom: "1px solid var(--ui-border-muted)", padding: "0 8px", flexShrink: 0 }}>
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
