"use client";

import React, { useEffect, useRef, useState } from 'react';
import { ArrowsOut, CursorClick, DotsThree, Globe, NotePencil, X } from '@phosphor-icons/react';
import { ACIComputerUseView } from '@/capsules/browser/ACIComputerUseView';
import { useBrowserAgentStore } from '@/capsules/browser/browserAgent.store';
import { getPlatformComputerUseBaseUrl } from '@/integration/computer-use-engine';

type PersistenceMode = 'dont-keep' | 'shared' | 'separate';

export function CodeAciPane({ onClose }: { onClose: () => void }): React.ReactNode {
  const screenshot = useBrowserAgentStore((state) => state.screenshot);
  const captureScreenshot = useBrowserAgentStore((state) => state.captureScreenshot);
  const allowedSites = useBrowserAgentStore((state) => state.allowedSites);
  const setAllowedSites = useBrowserAgentStore((state) => state.setAllowedSites);
  const openLinks = useBrowserAgentStore((state) => state.openLinksInBrowser);
  const setOpenLinks = useBrowserAgentStore((state) => state.setOpenLinksInBrowser);
  const autoVerify = useBrowserAgentStore((state) => state.autoVerify);
  const setAutoVerify = useBrowserAgentStore((state) => state.setAutoVerify);
  const persistence = useBrowserAgentStore((state) => state.sessionPersistence);
  const setPersistence = useBrowserAgentStore((state) => state.setSessionPersistence);
  const engineHealthy = useBrowserAgentStore((state) => state.engineHealthy);
  const engineStatusMessage = useBrowserAgentStore((state) => state.engineStatusMessage);
  const setEngineBaseUrl = useBrowserAgentStore((state) => state.setEngineBaseUrl);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [tool, setTool] = useState<'annotate' | 'select' | null>(null);
  const [annotations, setAnnotations] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const [selectedPoint, setSelectedPoint] = useState<{ x: number; y: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEngineBaseUrl(getPlatformComputerUseBaseUrl());
    queueMicrotask(() => void useBrowserAgentStore.getState().refreshEngineHealth());
  }, [setEngineBaseUrl]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const saveScreenshot = async () => {
    const captured = await captureScreenshot();
    const image = captured ?? screenshot;
    if (!image) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${image}`;
    link.download = `aci-${Date.now()}.png`;
    link.click();
    setMenuOpen(false);
  };
  const manageSites = () => {
    const value = window.prompt('Allowed sites (comma separated)', allowedSites.join(', '));
    if (value !== null) {
      setAllowedSites(value.split(',').map((site) => site.trim()).filter(Boolean));
      setMenuOpen(false);
    }
  };
  const openFile = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const opened = window.open(url, openLinks ? '_blank' : 'aci-local-file');
    if (!opened) window.location.assign(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setMenuOpen(false);
  };
  const useCanvasTool = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!tool) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (tool === 'annotate') setAnnotations((items) => [...items, { ...point, id: Date.now() }]);
    else setSelectedPoint(point);
  };

  const headerButton: React.CSSProperties = { width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' };
  const menuButton: React.CSSProperties = { width: '100%', minHeight: 30, display: 'flex', alignItems: 'center', padding: '0 9px', border: 'none', borderRadius: 7, background: 'transparent', color: 'var(--text-primary)', fontSize: 12, textAlign: 'left', cursor: 'pointer' };

  return (
    <div data-testid="code-aci-pane" style={{ position: fullscreen ? 'fixed' : 'relative', inset: fullscreen ? 10 : undefined, zIndex: fullscreen ? 80 : undefined, height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--surface-canvas)' }}>
      <div style={{ height: 40, display: 'flex', alignItems: 'center', gap: 3, padding: '0 7px 0 11px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <Globe size={16} weight="duotone" style={{ color: 'var(--accent-browser)' }} />
        <span style={{ fontSize: 12, fontWeight: 650, marginRight: 'auto' }}>ACI dev server</span>
        <button type="button" aria-label="Annotate" title="Annotate" onClick={() => setTool((value) => value === 'annotate' ? null : 'annotate')} style={{ ...headerButton, background: tool === 'annotate' ? 'var(--surface-active)' : 'transparent' }}><NotePencil size={15} /></button>
        <button type="button" aria-label="Select element" title="Select element" onClick={() => setTool((value) => value === 'select' ? null : 'select')} style={{ ...headerButton, background: tool === 'select' ? 'var(--surface-active)' : 'transparent' }}><CursorClick size={15} /></button>
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button type="button" aria-label="ACI actions" onClick={() => setMenuOpen((value) => !value)} style={headerButton}><DotsThree size={18} /></button>
          {menuOpen ? (
            <div style={{ position: 'absolute', top: 34, right: 0, zIndex: 10, width: 222, padding: 5, border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--surface-floating)', boxShadow: '0 14px 30px rgba(0,0,0,.24)' }}>
              <input ref={fileRef} type="file" hidden onChange={(event) => openFile(event.target.files?.[0])} />
              <button type="button" style={menuButton} onClick={() => fileRef.current?.click()}>Open file</button>
              <button type="button" style={menuButton} onClick={() => void saveScreenshot()}>Save screenshot</button>
              <button type="button" style={menuButton} onClick={manageSites}>Manage allowed sites</button>
              <label style={{ ...menuButton, justifyContent: 'space-between' }}>Open links in browser<input type="checkbox" checked={openLinks} onChange={(event) => setOpenLinks(event.target.checked)} /></label>
              <label style={{ ...menuButton, justifyContent: 'space-between' }}>Disable auto verify<input type="checkbox" checked={!autoVerify} onChange={(event) => setAutoVerify(!event.target.checked)} /></label>
              <label style={{ ...menuButton, height: 'auto', paddingTop: 6, paddingBottom: 6, flexDirection: 'column', alignItems: 'stretch', gap: 5 }}>Persist sessions<select value={persistence} onChange={(event) => setPersistence(event.target.value as PersistenceMode)} style={{ fontSize: 12, background: 'var(--surface-panel)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 5 }}><option value="dont-keep">Don’t keep</option><option value="shared">Shared</option><option value="separate">Separate</option></select></label>
            </div>
          ) : null}
        </div>
        <button type="button" aria-label="Expand ACI" onClick={() => setFullscreen((value) => !value)} style={headerButton}><ArrowsOut size={15} /></button>
        <button type="button" aria-label="Close ACI" onClick={onClose} style={headerButton}><X size={15} /></button>
      </div>
      {!engineHealthy ? <div role="status" style={{ padding: '7px 10px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--status-warning)', fontSize: 11 }}>ACI backend unavailable{engineStatusMessage ? ` · ${engineStatusMessage}` : ''}</div> : null}
      <div onClick={useCanvasTool} style={{ position: 'relative', flex: 1, minHeight: 0, cursor: tool === 'select' ? 'crosshair' : tool === 'annotate' ? 'cell' : 'default' }}>
        <ACIComputerUseView agentBarHeight={0} />
        {annotations.map((annotation, index) => <span key={annotation.id} style={{ position: 'absolute', zIndex: 30, left: annotation.x - 9, top: annotation.y - 9, width: 18, height: 18, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--accent-primary)', color: 'var(--surface-canvas)', fontSize: 10, fontWeight: 700, pointerEvents: 'none' }}>{index + 1}</span>)}
        {selectedPoint ? <span style={{ position: 'absolute', zIndex: 30, left: selectedPoint.x - 12, top: selectedPoint.y - 12, width: 24, height: 24, border: '1px solid var(--accent-primary)', borderRadius: 5, boxShadow: '0 0 0 3px color-mix(in srgb, var(--accent-primary) 18%, transparent)', pointerEvents: 'none' }} /> : null}
      </div>
    </div>
  );
}
