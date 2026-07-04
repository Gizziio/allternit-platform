"use client";
import React, { useMemo, useState } from 'react';
import { X, MagnifyingGlass, PuzzlePiece, Download, Lightning, Warning, Check } from '@phosphor-icons/react';
import { BUNDLED_PLUGINS, getBundledPluginById } from '../../lib/design/bundled-plugins';
import type { PluginManifest } from '../../lib/design/plugin-manifest';
import { downloadInstallScript, installPluginViaApi } from '../../lib/design/plugin-install-scripts';
import type { Agent } from '@/lib/agents/agent.types';

interface PluginPickerProps {
  onSelect: (plugin: PluginManifest) => void;
  onClose: () => void;
  agent?: Agent;
}

const CATEGORY_LABELS: Record<string, string> = {
  scenarios: 'Scenarios',
  'image-templates': 'Image Templates',
  'video-templates': 'Video Templates',
  'design-systems': 'Design Systems',
  atoms: 'Atoms',
  examples: 'Examples',
  utility: 'Utility',
};

export function PluginPicker({ onSelect, onClose, agent }: PluginPickerProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installResult, setInstallResult] = useState<{ id: string; ok: boolean; message: string } | null>(null);

  const canInstall = !agent || (agent.capabilities ?? []).includes('plugin-install');

  const categories = useMemo(() => {
    const set = new Set(BUNDLED_PLUGINS.map((p) => p.category ?? 'utility'));
    return Array.from(set);
  }, []);

  const plugins = useMemo(() => {
    let list = [...BUNDLED_PLUGINS];
    if (category !== 'all') list = list.filter((p) => p.category === category);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q) ||
          (p.tags ?? []).some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [category, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, PluginManifest[]>();
    for (const plugin of plugins) {
      const cat = plugin.category ?? 'utility';
      const list = map.get(cat) ?? [];
      list.push(plugin);
      map.set(cat, list);
    }
    return map;
  }, [plugins]);

  return (
    <div style={overlayStyles} onClick={onClose}>
      <div style={panelStyles} onClick={(e) => e.stopPropagation()}>
        <header style={headerStyles}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>Plugin marketplace</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
              Open Design plugins extend the agent with reusable workflows.
            </p>
          </div>
          <button type="button" onClick={onClose} style={iconButtonStyles}><X size={18} /></button>
        </header>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <MagnifyingGlass size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              aria-label="Search plugins"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search plugins, tags…"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 36px',
                borderRadius: 10, border: '1px solid var(--border-subtle)',
                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                fontSize: 13, outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setCategory('all')}
              style={{
                padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)',
                background: category === 'all' ? 'var(--accent-primary)' : 'var(--bg-primary)',
                color: category === 'all' ? '#fff' : 'var(--text-secondary)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                style={{
                  padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)',
                  background: category === cat ? 'var(--accent-primary)' : 'var(--bg-primary)',
                  color: category === cat ? '#fff' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px 20px' }}>
          {plugins.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No plugins match.</div>
          ) : (
            Array.from(grouped.entries()).map(([cat, list]) => (
              <div key={cat} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  {CATEGORY_LABELS[cat] ?? cat}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {list.map((plugin) => (
                    <button
                      key={plugin.id}
                      type="button"
                      onClick={() => onSelect(plugin)}
                      style={{
                        textAlign: 'left', padding: 14, borderRadius: 12,
                        border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)',
                        cursor: 'pointer', transition: 'all 0.12s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <PuzzlePiece size={16} color="var(--text-tertiary)" />
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{plugin.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>v{plugin.version}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{plugin.description}</p>
                      {(plugin.tags ?? []).length > 0 && (
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                          {(plugin.tags ?? []).map((tag) => (
                            <span key={tag} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', background: 'var(--surface-hover)', borderRadius: 4, padding: '2px 6px' }}>{tag}</span>
                          ))}
                        </div>
                      )}
                      {agent && (
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {!canInstall && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(234,179,8,0.12)' }}>
                              <Warning size={12} color="#eab308" weight="fill" />
                              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                                Add the <strong>plugin-install</strong> capability to {agent.name} to install directly.
                              </span>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadInstallScript({ agent, plugin });
                              }}
                              title={`Download install script for ${agent.name}`}
                              style={{
                                flex: 1,
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '6px 10px', borderRadius: 8,
                                border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)',
                                color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              <Download size={12} />
                              Script
                            </button>
                            <button
                              type="button"
                              disabled={!canInstall || installingId === plugin.id}
                              onClick={async (e) => {
                                e.stopPropagation();
                                setInstallingId(plugin.id);
                                setInstallResult(null);
                                try {
                                  const result = await installPluginViaApi({ agent, plugin });
                                  setInstallResult({ id: plugin.id, ok: true, message: result.message });
                                } catch (err: any) {
                                  setInstallResult({ id: plugin.id, ok: false, message: err.message ?? 'Install failed' });
                                } finally {
                                  setInstallingId(null);
                                }
                              }}
                              title={`Install ${plugin.name} into ${agent.name}'s skill directory`}
                              style={{
                                flex: 1,
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '6px 10px', borderRadius: 8,
                                border: '1px solid var(--border-subtle)',
                                background: canInstall && installingId !== plugin.id ? 'var(--accent-primary)' : 'var(--surface-hover)',
                                color: canInstall && installingId !== plugin.id ? '#fff' : 'var(--text-tertiary)', fontSize: 11, fontWeight: 700,
                                cursor: canInstall && installingId !== plugin.id ? 'pointer' : 'default',
                              }}
                            >
                              {installingId === plugin.id ? (
                                <span style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                              ) : (
                                <Lightning size={12} weight="fill" />
                              )}
                              Install
                            </button>
                          </div>
                          {installResult?.id === plugin.id && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 6, background: installResult.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }}>
                              {installResult.ok ? <Check size={12} color="#22c55e" weight="bold" /> : <Warning size={12} color="#ef4444" weight="fill" />}
                              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{installResult.message}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const overlayStyles: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100,
  background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 24,
};

const panelStyles: React.CSSProperties = {
  width: '100%', maxWidth: 720, maxHeight: '85vh',
  background: 'var(--surface-panel)', borderRadius: 16,
  boxShadow: '0 24px 80px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column',
  border: '1px solid var(--border-subtle)',
};

const headerStyles: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
  padding: '20px 20px 16px', borderBottom: '1px solid var(--border-subtle)',
};

const iconButtonStyles: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-subtle)',
  background: 'transparent', color: 'var(--text-secondary)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};
