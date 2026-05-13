"use client";

import { useState, useEffect, useCallback } from "react";
import { ArtifactPreviewPane } from "../../components/design/ArtifactPreviewPane";
import { renderLiveArtifact, parseLiveArtifactData, type LiveArtifact } from "../../lib/design/live-artifact";
import { FloppyDisk, Plus } from "@phosphor-icons/react";

const DEFAULT_TEMPLATE = `<!doctype html>
<html>
<head>
  <style>
    body { font-family: system-ui; padding: 40px; background: var(--bg, #f4f4f0); color: var(--fg, #111); }
    h1 { font-size: 28px; margin-bottom: 8px; }
    p { font-size: 14px; opacity: 0.7; }
    .metric { display: inline-block; padding: 8px 16px; background: #fff; border-radius: 8px; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>{{title}}</h1>
  <p>{{subtitle}}</p>
  <div class="metric">Active users: {{metrics.users}}</div>
</body>
</html>`;

const DEFAULT_DATA = JSON.stringify({
  title: "Daily Briefing",
  subtitle: "Your autonomous design digest",
  metrics: { users: 1240 }
}, null, 2);

const STORAGE_KEY = 'allternit-design-live-artifacts';

function loadArtifacts(): LiveArtifact[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveArtifacts(artifacts: LiveArtifact[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(artifacts));
}

export function LiveArtifactEditor() {
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [dataJson, setDataJson] = useState(DEFAULT_DATA);
  const [renderedHtml, setRenderedHtml] = useState('');
  const [artifacts, setArtifacts] = useState<LiveArtifact[]>([]);
  const [name, setName] = useState('Untitled');

  useEffect(() => {
    setArtifacts(loadArtifacts());
  }, []);

  useEffect(() => {
    const data = parseLiveArtifactData(dataJson);
    setRenderedHtml(renderLiveArtifact(template, data));
  }, [template, dataJson]);

  const handleSave = useCallback(() => {
    const artifact: LiveArtifact = {
      id: `live-${Date.now()}`,
      name,
      templateHtml: template,
      dataJson,
      createdAt: new Date().toISOString(),
    };
    const next = [artifact, ...artifacts];
    setArtifacts(next);
    saveArtifacts(next);
  }, [name, template, dataJson, artifacts]);

  const handleLoad = useCallback((artifact: LiveArtifact) => {
    setTemplate(artifact.templateHtml);
    setDataJson(artifact.dataJson);
    setName(artifact.name);
  }, []);

  const handleNew = useCallback(() => {
    setTemplate(DEFAULT_TEMPLATE);
    setDataJson(DEFAULT_DATA);
    setName('Untitled');
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-panel)', flexShrink: 0 }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ background: 'transparent', border: 'none', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', outline: 'none', flex: 1 }}
        />
        <button onClick={handleNew} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <Plus size={12} /> New
        </button>
        <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--accent-primary)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          <FloppyDisk size={12} /> Save
        </button>
      </div>

      {/* Main split */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Template editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-subtle)', minWidth: 0 }}>
          <div style={{ padding: '6px 12px', fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--bg-secondary)' }}>Template</div>
          <textarea
            value={template}
            onChange={e => setTemplate(e.target.value)}
            style={{ flex: 1, padding: 12, border: 'none', outline: 'none', fontSize: 12, fontFamily: 'var(--font-mono, monospace)', background: 'var(--bg-primary)', color: 'var(--text-primary)', resize: 'none' }}
          />
        </div>

        {/* Right: Preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '6px 12px', fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--bg-secondary)' }}>Live Preview</div>
          <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column' }}>
            <ArtifactPreviewPane html={renderedHtml} title="Live Preview" identifier="live-preview" height="100%" />
          </div>
        </div>
      </div>

      {/* Bottom: Data editor + saved list */}
      <div style={{ height: 180, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexShrink: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-subtle)', minWidth: 0 }}>
          <div style={{ padding: '6px 12px', fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--bg-secondary)' }}>Data (JSON)</div>
          <textarea
            value={dataJson}
            onChange={e => setDataJson(e.target.value)}
            style={{ flex: 1, padding: 12, border: 'none', outline: 'none', fontSize: 12, fontFamily: 'var(--font-mono, monospace)', background: 'var(--bg-primary)', color: 'var(--text-primary)', resize: 'none' }}
          />
        </div>
        <div style={{ width: 220, display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', overflowY: 'auto' }}>
          <div style={{ padding: '6px 12px', fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Saved ({artifacts.length})</div>
          {artifacts.map(a => (
            <button
              key={a.id}
              onClick={() => handleLoad(a)}
              style={{ padding: '8px 12px', textAlign: 'left', border: 'none', background: 'transparent', borderBottom: '1px solid var(--border-subtle)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
