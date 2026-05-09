"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { ArrowSquareOut, DownloadSimple, DeviceMobile, DeviceTablet, Monitor, MagnifyingGlassMinus, MagnifyingGlassPlus, ArrowsOut, Sliders } from "@phosphor-icons/react";
import { parseEditModeConfig, type EditModeToken, type EditModeConfig } from "../../lib/design/editmode-parser";

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

function exportHtml(html: string, identifier: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${identifier}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  html: string;
  title: string;
  identifier: string;
  className?: string;
  height?: number | string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ArtifactPreviewPane({ html, title, identifier, className, height = '100%' }: Props) {
  const [viewport, setViewport] = useState<ViewportId>('desktop');
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [editConfig, setEditConfig] = useState<EditModeConfig | null>(null);
  const [editTokens, setEditTokens] = useState<EditModeToken[]>([]);
  const [showEditPanel, setShowEditPanel] = useState(false);

  const vp = VIEWPORTS.find(v => v.id === viewport)!;

  // Compute fit-to-container scale whenever container or viewport changes
  const updateFit = useCallback(() => {
    if (!containerRef.current) return;
    const { offsetWidth, offsetHeight } = containerRef.current;
    const scaleW = (offsetWidth - 48) / vp.w;
    const scaleH = (offsetHeight - 48) / vp.h;
    setFitScale(Math.min(scaleW, scaleH, 1));
  }, [vp.w, vp.h]);

  useEffect(() => {
    updateFit();
    const ro = new ResizeObserver(updateFit);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateFit]);

  useEffect(() => {
    const config = parseEditModeConfig(html);
    setEditConfig(config);
    setEditTokens(config?.tokens ?? []);
    setShowEditPanel(false);
  }, [html]);

  function updateToken(id: string, value: string | number) {
    const updated = editTokens.map(t => t.id === id ? { ...t, value } : t);
    setEditTokens(updated);
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'EDITMODE_UPDATE', tokens: Object.fromEntries(updated.map(t => [`--${t.id}`, String(t.value)])) },
      '*'
    );
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
      className={className}
      style={{ display: 'flex', flexDirection: 'column', height, border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-secondary)' }}
    >
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'var(--surface-panel)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>

        {/* Title */}
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160, flex: '0 1 auto' }}>
          {title}
        </span>

        <div style={{ flex: 1 }} />

        {/* Viewport switcher */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-secondary)', borderRadius: 7, padding: 2 }}>
          {VIEWPORTS.map(v => (
            <button
              key={v.id}
              onClick={() => { setViewport(v.id); setZoom('fit'); }}
              title={`${v.label} (${v.w}×${v.h})`}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 5, border: 'none',
                background: viewport === v.id ? 'var(--surface-panel)' : 'transparent',
                color: viewport === v.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', boxShadow: viewport === v.id ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {v.icon} {v.label}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 2px' }} />

        {/* Zoom controls */}
        <button onClick={() => bumpZoom(-0.1)} style={iconBtn} title="Zoom out"><MagnifyingGlassMinus size={13} /></button>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', minWidth: 36, textAlign: 'center' }}>{zoomPct}%</span>
        <button onClick={() => bumpZoom(0.1)} style={iconBtn} title="Zoom in"><MagnifyingGlassPlus size={13} /></button>
        <button onClick={() => setZoom('fit')} style={{ ...iconBtn, color: zoom === 'fit' ? 'var(--accent-primary)' : 'var(--text-tertiary)' }} title="Fit to window"><ArrowsOut size={13} /></button>

        <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 2px' }} />

        {/* Actions */}
        <button onClick={() => openInNewTab(html)} style={actionBtn} title="Open in new tab">
          <ArrowSquareOut size={12} /> Open
        </button>
        <button onClick={() => exportHtml(html, identifier)} style={actionBtn} title="Export HTML">
          <DownloadSimple size={12} /> Export
        </button>

        {editConfig && editConfig.tokens.length > 0 && (
          <>
            <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 2px' }} />
            <button
              onClick={() => setShowEditPanel(p => !p)}
              style={{ ...iconBtn, color: showEditPanel ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}
              title="Live token tweaks"
            >
              <Sliders size={13} />
            </button>
          </>
        )}
      </div>

      {/* Canvas area */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{
          width: vp.w,
          height: vp.h,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0,
          borderRadius: viewport === 'desktop' ? 4 : 8,
          overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
        }}>
          <iframe
            ref={iframeRef}
            srcDoc={html}
            sandbox="allow-scripts allow-same-origin allow-forms"
            style={{ border: 'none', display: 'block', width: '100%', height: '100%' }}
            title={title}
          />
        </div>
      </div>

      {showEditPanel && editConfig && (
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--border-subtle)',
          background: 'var(--surface-panel)', display: 'flex', flexDirection: 'column', gap: 10,
          maxHeight: 220, overflowY: 'auto', flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Live Tweaks
          </span>
          {editTokens.map(token => (
            <div key={token.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 120 }}>
                {token.label}
              </span>
              {token.type === 'color' && (
                <input
                  type="color"
                  value={String(token.value)}
                  onChange={e => updateToken(token.id, e.target.value)}
                  style={{ width: 32, height: 22, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                />
              )}
              {token.type === 'range' && (
                <input
                  type="range"
                  min={token.min ?? 0}
                  max={token.max ?? 100}
                  step={token.step ?? 1}
                  value={Number(token.value)}
                  onChange={e => updateToken(token.id, parseInt(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
                />
              )}
              {token.type === 'select' && (
                <select
                  value={String(token.value)}
                  onChange={e => updateToken(token.id, e.target.value)}
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 6, fontSize: 11, color: 'var(--text-primary)', padding: '3px 6px' }}
                >
                  {(token.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              )}
              {token.type === 'text' && (
                <input
                  type="text"
                  value={String(token.value)}
                  onChange={e => updateToken(token.id, e.target.value)}
                  style={{ flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 6, fontSize: 11, color: 'var(--text-primary)', padding: '4px 8px', outline: 'none' }}
                />
              )}
              {token.type === 'range' && (
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', minWidth: 28, textAlign: 'right' }}>
                  {token.value}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Status bar */}
      <div style={{ padding: '4px 12px', background: 'var(--surface-panel)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>{vp.w} × {vp.h}px</span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>·</span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>{zoomPct}% zoom</span>
      </div>
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const iconBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 26, height: 26, borderRadius: 6, border: 'none',
  background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer',
};

const actionBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  background: 'none', border: '1px solid var(--border-subtle)',
  borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
  color: 'var(--text-secondary)', fontSize: 11, fontWeight: 500,
};
