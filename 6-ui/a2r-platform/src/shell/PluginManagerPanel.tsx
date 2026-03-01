/**
 * PluginManagerPanel
 *
 * Slide-in drawer that lets users browse, enable, and disable
 * Feature Plugins — toggleable shell capabilities like Playground.
 *
 * Triggered by a "Plugins" button in the shell top bar.
 */

import React, { useCallback } from 'react';
import { useFeaturePlugins } from '../plugins/useFeaturePlugins';
import type { FeaturePlugin } from '../plugins/feature.types';

// ─── Icon map (Phosphor-style SVG paths for plugin card icons) ────────────────

function PluginIcon({ name, size = 22, color = 'currentColor' }: { name: string; size?: number; color?: string }) {
  const icons: Record<string, React.ReactElement> = {
    Flask: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3h6M10 3v5l-4 10a1 1 0 0 0 .9 1.4h10.2a1 1 0 0 0 .9-1.4L14 8V3"/>
        <path d="M7.5 14.5h9"/>
      </svg>
    ),
    TreeStructure: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <rect x="3" y="3" width="4" height="4" rx="1"/><rect x="10" y="10" width="4" height="4" rx="1"/>
        <rect x="17" y="3" width="4" height="4" rx="1"/><rect x="17" y="17" width="4" height="4" rx="1"/>
        <path d="M5 7v4h7M19 7v3M19 14v3"/><path d="M12 14v6"/>
      </svg>
    ),
    SquaresFour: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/>
        <rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>
      </svg>
    ),
    ChartBar: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <path d="M3 20h18M8 20V10M12 20V5M16 20V14"/>
      </svg>
    ),
    Sparkle: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M6.22 6.22l1.42 1.42M16.36 16.36l1.42 1.42M6.22 17.78l1.42-1.42M16.36 7.64l1.42-1.42M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
      </svg>
    ),
  };
  return icons[name] ?? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
      <circle cx="12" cy="12" r="9"/>
    </svg>
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      aria-label={on ? 'Disable plugin' : 'Enable plugin'}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        padding: 0, flexShrink: 0, position: 'relative',
        background: on ? '#d4b08c' : 'rgba(255,255,255,0.08)',
        transition: 'background 0.2s',
        boxShadow: on ? '0 0 10px rgba(212,176,140,0.3)' : 'none',
      }}
    >
      <span style={{
        position: 'absolute', top: 4, left: on ? 22 : 4, width: 16, height: 16,
        borderRadius: '50%', background: on ? '#1c1917' : '#57534e', transition: 'left 0.2s',
      }} />
    </button>
  );
}

// ─── Plugin Card ──────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  'dev-tools': 'Dev Tools',
  'ai': 'AI',
  'productivity': 'Productivity',
  'experimental': 'Experimental',
};

function PluginCard({
  plugin,
  enabled,
  onToggle,
}: {
  plugin: FeaturePlugin;
  enabled: boolean;
  onToggle: () => void;
}) {
  const accent = plugin.accentColor ?? '#d4b08c';

  return (
    <div style={{
      background: enabled ? `${accent}08` : '#1a1917',
      border: `1px solid ${enabled ? `${accent}30` : 'rgba(255,255,255,0.05)'}`,
      borderRadius: 12, padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start',
      transition: 'all 0.2s', cursor: 'default',
    }}>
      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: `${accent}15`,
        border: `1px solid ${accent}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <PluginIcon name={plugin.icon} size={20} color={accent} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: enabled ? accent : '#c9c5c2' }}>
            {plugin.name}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
            background: `${accent}12`, color: accent, textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>
            {CATEGORY_LABELS[plugin.category] ?? plugin.category}
          </span>
          {plugin.builtin && (
            <span style={{
              fontSize: 9, padding: '2px 5px', borderRadius: 4,
              background: 'rgba(255,255,255,0.05)', color: '#57534e',
              textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>
              Built-in
            </span>
          )}
        </div>

        <p style={{ fontSize: 12, color: '#78716c', lineHeight: 1.55, marginBottom: 10 }}>
          {plugin.description}
        </p>

        {/* Views contributed */}
        {plugin.views.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {plugin.views.map((v) => (
              <span key={v.viewType} style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 4,
                background: 'rgba(212,176,140,0.07)', color: '#6b6560',
                border: '1px solid rgba(212,176,140,0.1)',
              }}>
                + {v.label} view
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Toggle */}
      <div style={{ flexShrink: 0, paddingTop: 2 }}>
        <Toggle on={enabled} onChange={onToggle} />
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface PluginManagerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PluginManagerPanel({ isOpen, onClose }: PluginManagerPanelProps) {
  const { allPlugins, toggle, isEnabled } = useFeaturePlugins();

  const byCategory = allPlugins.reduce<Record<string, FeaturePlugin[]>>((acc, p) => {
    const cat = p.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const categoryOrder = ['dev-tools', 'ai', 'productivity', 'experimental'];

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const enabledCount = allPlugins.filter((p) => isEnabled(p.id)).length;

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div style={{
        width: 420, height: '100%', background: '#0f0e0d',
        borderLeft: '1px solid rgba(212,176,140,0.1)',
        display: 'flex', flexDirection: 'column',
        animation: 'pgSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid rgba(212,176,140,0.1)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(212,176,140,0.7)" strokeWidth="1.8" strokeLinecap="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5"/>
            <rect x="14" y="14" width="7" height="7" rx="1.5"/>
          </svg>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#e7e5e4', margin: 0 }}>
              Plugins
            </h2>
            <p style={{ fontSize: 11, color: '#44403c', margin: 0, marginTop: 1 }}>
              {enabledCount} of {allPlugins.length} enabled
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 7, border: 'none', background: 'rgba(255,255,255,0.06)',
            color: '#78716c', cursor: 'pointer', fontSize: 16, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {/* Scrollable plugin list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px' }}>
          {categoryOrder
            .filter((cat) => byCategory[cat]?.length > 0)
            .map((cat) => (
              <div key={cat} style={{ marginBottom: 24 }}>
                <h3 style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: '#44403c', marginBottom: 10, paddingLeft: 2,
                }}>
                  {CATEGORY_LABELS[cat] ?? cat}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {byCategory[cat].map((plugin) => (
                    <PluginCard
                      key={plugin.id}
                      plugin={plugin}
                      enabled={isEnabled(plugin.id)}
                      onToggle={() => toggle(plugin.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid rgba(212,176,140,0.07)',
          flexShrink: 0,
        }}>
          <p style={{ fontSize: 11, color: '#3a3733', lineHeight: 1.5, textAlign: 'center' }}>
            Enabled plugins appear in the sidebar navigation.
            Changes take effect immediately.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes pgSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
