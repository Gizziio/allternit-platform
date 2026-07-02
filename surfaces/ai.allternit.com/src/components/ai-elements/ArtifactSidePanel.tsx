"use client";

import { useState, useCallback } from "react";
import {
  X,
  Copy,
  Check,
  Warning,
  FilmStrip,
  SpinnerGap,
} from '@phosphor-icons/react';
import { Markdown } from "./markdown";
import { CodeBlock } from "./code-block";
import { AllternitOpenUIRenderer } from '@/lib/openui/AllternitOpenUIRenderer';
import type { BundledLanguage } from "shiki";
import DOMPurify from 'dompurify';
import { KIND_META, type SelectedArtifact } from './artifact.types';
import { cn } from "@/lib/utils";
import { HtmlPreview } from './HtmlPreview';
import { MermaidRenderer } from './MermaidRenderer';

// ─── Sanitization helper ─────────────────────────────────────────────────────

const sanitizeContent = (dirty: string): string => {
  if (typeof window === 'undefined') return dirty;
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
    const hf = (window as any).allternit?.hyperframes;
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
    const unsub = hf.onProgress((msg: string) => setProgress(msg));

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

// ─── Sub-renderers ────────────────────────────────────────────────────────────

function ArtifactContent({ artifact }: { artifact: SelectedArtifact }) {
  const { kind, content, url, language } = artifact;

  if (kind === "document") {
    return (
      <div className="p-6 text-[14px] leading-relaxed">
        <Markdown>{content ?? "*No content*"}</Markdown>
      </div>
    );
  }

  if (kind === "html") {
    // Note: HtmlPreview would be imported if moved to separate file
    return <HtmlPreview html={content ?? ""} />;
  }

  if (kind === "code" || kind === "jsx") {
    const lang = (language ?? (kind === "jsx" ? "tsx" : "text")) as BundledLanguage;
    return (
      <CodeBlock
        code={content ?? ""}
        language={lang}
        showLineNumbers
        className="rounded-none m-0 h-full"
      />
    );
  }

  if (kind === "svg" && content) {
    const sanitizedSvg = sanitizeContent(content);
    return (
      <div className="p-6 flex justify-center">
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizedSvg)}`}
          alt="SVG artifact"
          className="max-w-full max-h-full"
        />
      </div>
    );
  }

  if (kind === "image") {
    const src = url ?? (content?.startsWith("data:") ? content : `data:image/png;base64,${content}`);
    return (
      <div className="p-6 flex justify-center">
        <img src={src} alt={artifact.title} className="max-w-full rounded-lg" />
      </div>
    );
  }

  if (kind === "mermaid") {
    return <MermaidRenderer content={content ?? ""} />;
  }

  if (kind === "openui") {
    return (
      <div className="p-5">
        <AllternitOpenUIRenderer stream={content ?? ""} />
      </div>
    );
  }

  if (kind === "sheet" && content) {
    try {
      const data: unknown[][] = JSON.parse(content);
      return (
        <div className="p-4 overflow-x-auto">
          <table className="border-collapse w-full text-[13px]">
            <tbody>
              {data.map((row, i) => (
                <tr key={`row-${i}`}>
                  {row.map((cell, j) => (
                    <td key={`cell-${i}-${j}`} className="border border-solid border-[var(--ui-border-muted)] p-2.5 text-[rgba(236,236,236,0.75)]">
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } catch { /* fall through */ }
  }

  return <div className="p-6 text-[rgba(236,236,236,0.5)] text-[13px]">{content ?? "No preview available."}</div>;
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface ArtifactSidePanelProps {
  artifact: SelectedArtifact | null;
  onClose: () => void;
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
      setCopyError(true);
      setTimeout(() => setCopyError(false), 3000);
    }
  }, [artifact]);

  const handleRender = useCallback(async () => {
    await hf.render(renderFormat);
  }, [hf, renderFormat]);

  if (!artifact) return null;
  const meta = KIND_META[artifact.kind] ?? KIND_META.document;

  return (
    <div className="w-[440px] min-w-[440px] flex flex-col border-l border-solid border-[var(--ui-border-muted)] bg-[#1e1a17] relative overflow-hidden animate-[allternit-panel-slidein_0.22s_cubic-bezier(0.22,1,0.36,1)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-solid border-[var(--ui-border-muted)] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ color: meta.accent }} className="flex items-center">{meta.icon}</span>
          <span className="text-[13px] font-semibold text-[rgba(236,236,236,0.88)] truncate max-w-[260px]">
            {artifact.title}
          </span>
          <span className="text-[10px] font-semibold tracking-wider uppercase text-[rgba(255,255,255,0.3)] bg-[var(--ui-border-muted)] border border-solid border-[var(--ui-border-muted)] px-2 py-0.5 rounded-full shrink-0">
            {meta.label}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {artifact.content && (
            <button type="button"
              onClick={handleCopy}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-solid text-[12px] font-medium transition-all duration-150 cursor-pointer",
                copyError ? "bg-[var(--status-error-bg)] border-red-500/50 text-red-500" : isCopied ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500" : "bg-[var(--surface-hover)] border-[var(--ui-border-muted)] text-[rgba(255,255,255,0.5)]"
              )}
            >
              {copyError ? <><Warning size={13} /> Failed</> : isCopied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
            </button>
          )}

          {artifact.kind === 'html' && hf.status !== 'unavailable' && (
            <button type="button"
              onClick={() => setShowRenderModal((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-solid text-[12px] font-medium transition-all duration-150 cursor-pointer",
                showRenderModal ? "bg-orange-500/10 border-orange-500/50 text-orange-500" : hf.status === 'done' ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500" : "bg-[var(--surface-hover)] border-[var(--ui-border-muted)] text-orange-500/80"
              )}
            >
              {hf.status === 'rendering' ? <><SpinnerGap size={13} className="animate-spin" /> Rendering…</> : hf.status === 'done' ? <><Check size={13} /> Saved</> : <><FilmStrip size={13} /> Video</>}
            </button>
          )}

          <button type="button"
            onClick={onClose}
            className="flex items-center justify-center size-7 rounded-md border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-hover)] text-[rgba(255,255,255,0.45)] cursor-pointer transition-colors duration-150 hover:bg-[var(--ui-border-muted)] hover:text-[rgba(255,255,255,0.8)]"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* HyperFrames Panel */}
      {showRenderModal && artifact.kind === 'html' && (
        <div className="border-b border-solid border-[var(--ui-border-muted)] p-4 bg-orange-500/5 shrink-0">
          <div className="text-[12px] font-semibold text-orange-500/70 tracking-wider uppercase mb-2">Export as Video</div>
          {hf.status === 'idle' || hf.status === 'error' ? (
            <>
              <div className="flex gap-1.5 mb-2.5">
                {(['mp4', 'webm', 'mov'] as RenderFormat[]).map((fmt) => (
                  <button type="button"
                    key={fmt}
                    onClick={() => setRenderFormat(fmt)}
                    className={cn(
                      "px-2.5 py-1 rounded-md border border-solid text-[12px] font-semibold uppercase tracking-wider cursor-pointer transition-colors duration-150",
                      renderFormat === fmt ? "bg-orange-500/10 border-orange-500/50 text-orange-500" : "bg-[var(--surface-hover)] border-[var(--ui-border-muted)] text-[rgba(255,255,255,0.4)]"
                    )}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
              {hf.status === 'error' && <div className="text-[12px] text-red-500/80 mb-2 break-words">{hf.error}</div>}
              <button type="button"
                onClick={handleRender}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md border border-solid border-orange-500/30 bg-orange-500/10 text-orange-500 text-[12px] font-semibold cursor-pointer"
              >
                <FilmStrip size={13} /> Render {renderFormat.toUpperCase()}
              </button>
            </>
          ) : hf.status === 'checking' || hf.status === 'rendering' ? (
            <div className="flex items-center gap-2 text-[12px] text-orange-500/70">
              <SpinnerGap size={14} className="animate-spin" />
              {hf.progress || (hf.status === 'checking' ? 'Checking dependencies…' : 'Rendering…')}
            </div>
          ) : hf.status === 'done' ? (
            <div className="text-[12px] text-emerald-500/85">
              <div className="font-semibold mb-1">Saved!</div>
              <div className="text-[rgba(255,255,255,0.35)] break-all font-mono text-[12px]">{hf.savedPath}</div>
              <button type="button" onClick={hf.reset} className="mt-2 px-2.5 py-1 rounded-md border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-hover)] text-[rgba(255,255,255,0.4)] text-[12px] cursor-pointer">Render another</button>
            </div>
          ) : null}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <ArtifactContent artifact={artifact} />
      </div>
    </div>
  );
}
