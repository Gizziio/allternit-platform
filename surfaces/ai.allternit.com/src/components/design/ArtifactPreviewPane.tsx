"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { ArrowSquareOut, DownloadSimple, DeviceMobile, DeviceTablet, Monitor, MagnifyingGlassMinus, MagnifyingGlassPlus, ArrowsOut, Sliders, FileHtml, FilePdf, FileZip, Presentation, VideoCamera } from "@phosphor-icons/react";
import { parseEditModeConfig, updateEditModeTokensInHtml, type EditModeToken, type EditModeConfig } from "../../lib/design/editmode-parser";
import { exportArtifact, exportMp4, type ExportFormat } from "../../lib/design/artifact-export";
import { cn } from "@/lib/utils";

// ── Viewport presets ───────────────────────────────────────────────────────────

const VIEWPORTS = [
  { id: 'desktop', label: 'Desktop',  icon: <Monitor size={13} />,       w: 1440, h: 900  },
  { id: 'tablet',  label: 'Tablet',   icon: <DeviceTablet size={13} />,  w: 768,  h: 1024 },
  { id: 'mobile',  label: 'Mobile',   icon: <DeviceMobile size={13} />,  w: 390,  h: 844  },
] as const;

type ViewportId = typeof VIEWPORTS[number]['id'];

// ── Utils ──────────────────────────────────────────────────────────────────────

function openInNewTab(html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  html: string;
  title: string;
  identifier: string;
  className?: string;
  height?: number | string;
  onHtmlChange?: (updatedHtml: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ArtifactPreviewPane({ html, title, identifier, className, height = '100%', onHtmlChange }: Props) {
  const [viewport, setViewport] = useState<ViewportId>('desktop');
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [editConfig, setEditConfig] = useState<EditModeConfig | null>(null);
  const [editTokens, setEditTokens] = useState<EditModeToken[]>([]);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const vp = VIEWPORTS.find(v => v.id === viewport)!;

  // Compute fit-to-container scale whenever container or viewport changes
  const updateFit = useCallback(() => {
    if (!containerRef.current) return;
    const { offsetWidth, offsetHeight } = containerRef.current;
    const scaleW = (offsetWidth - 48) / vp.w;
    const scaleH = (offsetHeight - 48) / vp.h;
    setFitScale(Math.min(scaleW, scaleH, 1));
  }, [vp.w, vp.h]);

  const [prevHtml, setPrevHtml] = useState(html);
  if (html !== prevHtml) {
    setPrevHtml(html);
    const config = parseEditModeConfig(html);
    setEditConfig(config);
    setEditTokens(config?.tokens ?? []);
    setShowEditPanel(false);
  }

  useEffect(() => {
    updateFit();
    const ro = new ResizeObserver(updateFit);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateFit]);

  useEffect(() => {
    if (!showExportMenu) return;
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-export-menu]')) setShowExportMenu(false);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [showExportMenu]);

  function updateToken(id: string, value: string | number) {
    const updated = editTokens.map(t => t.id === id ? { ...t, value } : t);
    setEditTokens(updated);
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'EDITMODE_UPDATE', tokens: Object.fromEntries(updated.map(t => [`--${t.id}`, String(t.value)])) },
      '*'
    );
    if (onHtmlChange) {
      const updatedHtml = updateEditModeTokensInHtml(html, updated);
      onHtmlChange(updatedHtml);
    }
  }

  const scale = zoom === 'fit' ? fitScale : zoom / 100;
  const zoomPct = Math.round(scale * 100);

  function bumpZoom(delta: number) {
    const current = zoom === 'fit' ? fitScale : zoom / 100;
    const next = Math.min(2, Math.max(0.25, current + delta));
    setZoom(Math.round(next * 100));
  }

  return (
    <div
      className={cn("flex flex-col border border-solid border-[var(--border-subtle)] rounded-[10px] overflow-hidden bg-[var(--bg-secondary)]", className)}
      style={{ height }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-[7px_12px] bg-[var(--surface-panel)] border-b border-solid border-[var(--border-subtle)] shrink-0">

        {/* Title */}
        <span className="text-[12px] font-semibold text-[var(--text-secondary)] overflow-hidden text-ellipsis whitespace-nowrap max-w-[160px] flex-[0_1_auto]">
          {title}
        </span>

        <div className="flex-1" />

        {/* Viewport switcher */}
        <div className="flex gap-0.5 bg-[var(--bg-secondary)] rounded-[7px] p-0.5">
          {VIEWPORTS.map(v => (
            <button type="button"
              key={v.id}
              onClick={() => { setViewport(v.id); setZoom('fit'); }}
              title={`${v.label} (${v.w}×${v.h})`}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-[5px] border-none text-[12px] font-semibold cursor-pointer transition-all",
                viewport === v.id ? "bg-[var(--surface-panel)] text-[var(--text-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              )}
            >
              {v.icon} {v.label}
            </button>
          ))}
        </div>

        <div className="w-px h-[18px] bg-[var(--border-subtle)] mx-0.5" />

        {/* Zoom controls */}
        <button type="button" onClick={() => bumpZoom(-0.1)} className="flex items-center justify-center size-[26px] rounded-md border-none bg-transparent text-[var(--text-tertiary)] cursor-pointer hover:bg-white/5 transition-colors" title="Zoom out"><MagnifyingGlassMinus size={13} /></button>
        <span className="text-[12px] font-bold text-[var(--text-secondary)] min-w-[36px] text-center">{zoomPct}%</span>
        <button type="button" onClick={() => bumpZoom(0.1)} className="flex items-center justify-center size-[26px] rounded-md border-none bg-transparent text-[var(--text-tertiary)] cursor-pointer hover:bg-white/5 transition-colors" title="Zoom in"><MagnifyingGlassPlus size={13} /></button>
        <button type="button" onClick={() => setZoom('fit')} className={cn("flex items-center justify-center size-[26px] rounded-md border-none bg-transparent cursor-pointer hover:bg-white/5 transition-colors", zoom === 'fit' ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]')} title="Fit to window"><ArrowsOut size={13} /></button>

        <div className="w-px h-[18px] bg-[var(--border-subtle)] mx-0.5" />

        {/* Actions */}
        <button type="button" onClick={() => openInNewTab(html)} className="flex items-center gap-1 bg-transparent border border-solid border-[var(--border-subtle)] rounded-md p-[4px_8px] cursor-pointer text-[var(--text-secondary)] text-[12px] font-medium hover:bg-white/5 transition-colors" title="Open in new tab">
          <ArrowSquareOut size={12} /> Open
        </button>
        <div className="relative" data-export-menu>
          <button type="button" onClick={() => setShowExportMenu(p => !p)} className="flex items-center gap-1 bg-transparent border border-solid border-[var(--border-subtle)] rounded-md p-[4px_8px] cursor-pointer text-[var(--text-secondary)] text-[12px] font-medium hover:bg-white/5 transition-colors" title="Export artifact">
            <DownloadSimple size={12} /> Export
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--surface-panel)] border border-solid border-[var(--border-subtle)] rounded-lg shadow-lg py-1 min-w-[140px]">
              {[
                { id: 'html' as ExportFormat, label: 'HTML', icon: <FileHtml size={13} /> },
                { id: 'pdf' as ExportFormat, label: 'PDF', icon: <FilePdf size={13} /> },
                { id: 'zip' as ExportFormat, label: 'ZIP bundle', icon: <FileZip size={13} /> },
                { id: 'pptx' as ExportFormat, label: 'PPTX', icon: <Presentation size={13} /> },
                { id: 'mp4' as ExportFormat, label: 'MP4 (scaffold)', icon: <VideoCamera size={13} /> },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => {
                    if (fmt.id === 'mp4' && iframeRef.current) {
                      exportMp4({ html, title, identifier, iframe: iframeRef.current }).catch(() => {});
                    } else {
                      exportArtifact(fmt.id, { html, title, identifier }).catch(() => {});
                    }
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] cursor-pointer border-none bg-transparent"
                >
                  {fmt.icon} {fmt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {editConfig && editConfig.tokens.length > 0 && (
          <>
            <div className="w-px h-[18px] bg-[var(--border-subtle)] mx-0.5" />
            <button type="button"
              onClick={() => setShowEditPanel(p => !p)}
              className={cn("flex items-center justify-center size-[26px] rounded-md border-none bg-transparent cursor-pointer hover:bg-white/5 transition-colors", showEditPanel ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]')}
              title="Live token tweaks"
            >
              <Sliders size={13} />
            </button>
          </>
        )}
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 overflow-hidden flex items-center justify-center relative">
        <div 
          className={cn(
            "shrink-0 overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.06)] transition-transform",
            viewport === 'desktop' ? "rounded" : "rounded-lg"
          )}
          style={{
            width: vp.w,
            height: vp.h,
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          <iframe
            ref={iframeRef}
            srcDoc={html}
            sandbox="allow-scripts allow-same-origin allow-forms"
            className="border-none block size-full"
            title={title}
          />
        </div>
      </div>

      {showEditPanel && editConfig && (
        <div className="p-[12px_16px] border-t border-solid border-[var(--border-subtle)] bg-[var(--surface-panel)] flex flex-col gap-2.5 max-h-[220px] overflow-y-auto shrink-0">
          <span className="text-[12px] font-extrabold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">
            Live Tweaks
          </span>
          {editTokens.map(token => (
            <div key={token.id} className="flex items-center gap-2.5">
              <span className="text-[12px] font-semibold text-[var(--text-secondary)] min-w-[120px]">
                {token.label}
              </span>
              {token.type === 'color' && (
                <input aria-label="Input" type="color"
                  value={String(token.value)}
                  onChange={e => updateToken(token.id, e.target.value)}
                  className="w-8 h-[22px] border-none rounded cursor-pointer"
                />
              )}
              {token.type === 'range' && (
                <input aria-label="Input" type="range"
                  min={token.min ?? 0}
                  max={token.max ?? 100}
                  step={token.step ?? 1}
                  value={Number(token.value)}
                  onChange={e => updateToken(token.id, parseInt(e.target.value))}
                  className="flex-1 accent-[var(--accent-primary)]"
                />
              )}
              {token.type === 'select' && (
                <select aria-label="Selection" value={String(token.value)}
                  onChange={e => updateToken(token.id, e.target.value)}
                  className="bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-[6px] text-[12px] text-[var(--text-primary)] p-[3px_6px] outline-none"
                >
                  {(token.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              )}
              {token.type === 'text' && (
                <input aria-label="Input" type="text"
                  value={String(token.value)}
                  onChange={e => updateToken(token.id, e.target.value)}
                  className="flex-1 bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-[6px] text-[12px] text-[var(--text-primary)] p-[4px_8px] outline-none"
                />
              )}
              {token.type === 'range' && (
                <span className="text-[12px] text-[var(--text-tertiary)] min-w-[28px] text-right">
                  {token.value}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Status bar */}
      <div className="p-[4px_12px] bg-[var(--surface-panel)] border-t border-solid border-[var(--border-subtle)] flex items-center gap-2.5 shrink-0">
        <span className="text-[12px] text-[var(--text-tertiary)] font-semibold">{vp.w} × {vp.h}px</span>
        <span className="text-[12px] text-[var(--text-tertiary)]">·</span>
        <span className="text-[12px] text-[var(--text-tertiary)] font-semibold">{zoomPct}% zoom</span>
      </div>
    </div>
  );
}
