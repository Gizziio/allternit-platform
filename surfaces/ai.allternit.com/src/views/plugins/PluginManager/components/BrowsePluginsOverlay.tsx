import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  X, 
  CircleNotch, 
  PuzzlePiece as Puzzle, 
  Check, 
  UsersThree,
} from '@phosphor-icons/react';
import { THEME, CURATED_MARKETPLACE_SOURCES } from '../constants';
import { 
  PluginMarketplaceTab, 
  PersonalMarketplaceSource, 
  MarketplacePlugin 
} from '../types';
import { 
  searchMarketplace, 
  fetchPluginFromGitHub, 
} from '../../../../plugins/marketplaceApi';
import { 
  parseGitHubRepoRef, 
  normalizeMarketplacePluginPayload,
} from '../utils';
import { useErrorToast } from '../../ErrorBoundary';
import type { FileSystemAPI } from '../../../../plugins/fileSystem';
import { PublishTabView } from './PublishTabView';
import { CreatePluginModal, ValidatePluginModal, SubmitToMarketplaceModal } from './PublishModals';

function PluginCatalogView({
  plugins,
  installedIds,
  onInstall,
  onUpdate,
  onUninstall,
  isLoading,
  title,
  description,
  badgeLabel,
}: {
  plugins: MarketplacePlugin[];
  installedIds: string[];
  onInstall: (plugin: MarketplacePlugin) => void;
  onUpdate: (plugin: MarketplacePlugin) => void;
  onUninstall: (plugin: MarketplacePlugin) => void;
  isLoading: boolean;
  title: string;
  description: string;
  badgeLabel: string;
}) {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: THEME.textSecondary }}>
        <CircleNotch size={24} className="animate-spin" style={{ marginRight: 12 }} />
        Loading plugins...
      </div>
    );
  }

  if (plugins.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, color: THEME.textSecondary, textAlign: 'center' }}>
        <UsersThree size={48} weight="thin" color={THEME.textTertiary} style={{ marginBottom: 16 }} />
        <p style={{ fontSize: 18, fontWeight: 600, color: THEME.textPrimary, margin: '0 0 8px' }}>No plugins found</p>
        <p style={{ fontSize: 14, margin: 0 }}>Try enabling another marketplace source or adjusting the current filters.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #0891b2, #22d3ee)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <UsersThree size={22} weight="bold" color="#fff" />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: THEME.textPrimary }}>{title}</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: THEME.textSecondary }}>{description}</p>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info)', padding: '4px 10px', borderRadius: 9999, fontWeight: 600 }}>{plugins.length} available</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {plugins.map((plugin) => {
          const installed = installedIds.includes(plugin.id);
          return (
            <div key={plugin.id} style={{ backgroundColor: 'var(--surface-hover)', border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #0891b2, #22d3ee)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Puzzle size={20} weight="bold" color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: THEME.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plugin.name}</h4>
                    {installed && <Check size={14} weight="bold" color="#22d3ee" />}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: THEME.textSecondary, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{plugin.description || 'No description'}</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
                {plugin.author && <span style={{ fontSize: 12, color: THEME.textTertiary }}>by {plugin.author}</span>}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--status-info)', backgroundColor: 'var(--status-info-bg)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{badgeLabel}</span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {installed ? (
                  <>
                    <button type="button" onClick={() => onUpdate(plugin)} style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: 'none', backgroundColor: 'color-mix(in srgb, var(--status-info) 20%, transparent)', color: 'var(--status-info)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Update</button>
                    <button type="button" onClick={() => onUninstall(plugin)} style={{ padding: '8px 12px', borderRadius: 6, border: `1px solid ${THEME.border}`, backgroundColor: 'transparent', color: THEME.textSecondary, fontSize: 13, cursor: 'pointer' }}>Remove</button>
                  </>
                ) : (
                  <button type="button" onClick={() => onInstall(plugin)} style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: 'none', backgroundColor: 'var(--status-info)', color: 'var(--ui-text-inverse)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Install</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BrowsePluginsOverlay({
  initialTab = 'marketplace',
  marketplaceInstalledIds,
  installedVersions,
  curatedSourceEnabled,
  allowUntrustedMarketplaceSources,
  onInstall,
  onUpdate,
  onUninstall,
  onSetCuratedSourceEnabled,
  onSetAllowUntrustedMarketplaceSources,
  personalSources,
  onAddPersonalSource,
  onRemovePersonalSource,
  onClose,
  fs,
}: {
  initialTab?: PluginMarketplaceTab;
  marketplaceInstalledIds: string[];
  installedVersions: Record<string, string>;
  curatedSourceEnabled: Record<string, boolean>;
  allowUntrustedMarketplaceSources: boolean;
  onInstall: (plugin: MarketplacePlugin) => void;
  onUpdate: (plugin: MarketplacePlugin) => Promise<void> | void;
  onUninstall: (plugin: MarketplacePlugin) => void;
  onSetCuratedSourceEnabled: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onSetAllowUntrustedMarketplaceSources: React.Dispatch<React.SetStateAction<boolean>>;
  personalSources: PersonalMarketplaceSource[];
  onAddPersonalSource: (source: Omit<PersonalMarketplaceSource, 'id' | 'createdAt'>) => void;
  onRemovePersonalSource: (sourceId: string) => void;
  onClose: () => void;
  fs: FileSystemAPI;
}) {
  const [activeTab, setActiveTab] = useState<PluginMarketplaceTab>(initialTab);
  const searchQuery = '';
  const activeCategory = 'all';
  const [marketplacePlugins, setMarketplacePlugins] = useState<MarketplacePlugin[]>([]);
  const [isMarketplaceLoading, setIsMarketplaceLoading] = useState(true);
  const { showError, showInfo } = useErrorToast();

  const enabledCuratedSourceIds = useMemo(() => {
    return CURATED_MARKETPLACE_SOURCES
      .filter((source) => curatedSourceEnabled[source.id] !== false)
      .map((source) => source.id);
  }, [curatedSourceEnabled]);

  useEffect(() => {
    void (async () => {
      setIsMarketplaceLoading(true);
      try {
        const result = await searchMarketplace(searchQuery, {
          category: activeCategory === 'all' ? undefined : activeCategory,
          allowedCuratedSourceIds: enabledCuratedSourceIds,
        });
        setMarketplacePlugins(result.plugins.map((p) => ({
          ...p,
          installed: marketplaceInstalledIds.includes(p.id),
        })));
      } catch (e) {
        showError(e instanceof Error ? e.message : 'Failed to load marketplace');
        setMarketplacePlugins([]);
      } finally {
        setIsMarketplaceLoading(false);
      }
    })();
  }, [searchQuery, activeCategory, enabledCuratedSourceIds, marketplaceInstalledIds, showError]);

  const loadPersonalSources = useCallback(async () => {
    const seen = new Set<string>();

    for (const source of personalSources) {
      try {
        if (source.type === 'github') {
          const repo = parseGitHubRepoRef(source.value);
          if (!repo) { showError(`${source.label || source.value}: Invalid GitHub format.`); continue; }
          const plugin = await fetchPluginFromGitHub(repo.owner, repo.repo);
          if (!plugin) { showError(`${source.label || source.value}: Unable to fetch metadata.`); continue; }
          const candidate = { ...plugin, category: plugin.category || 'personal' };
          seen.add(candidate.id);
        } else if (source.type === 'url') {
          const response = await fetch(source.value);
          if (!response.ok) { showError(`${source.label || source.value}: Source unavailable (${response.status}).`); continue; }
          const payload = await response.json();
          const plugin = normalizeMarketplacePluginPayload(payload, { id: source.id, name: source.label || source.value });
          if (plugin) seen.add(plugin.id);
        }
      } catch (error) {
        showError(`${source.label || source.value}: ${error instanceof Error ? error.message : 'Failed to resolve source.'}`);
      }
    }
  }, [personalSources, showError]);

  useEffect(() => { void loadPersonalSources(); }, [loadPersonalSources]);

  const [showCreatePluginModal, setShowCreatePluginModal] = useState(false);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [newSourceValue, setNewSourceValue] = useState('');

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--shell-overlay-backdrop)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}
      onClick={onClose}
    >
      <section
        style={{ width: 'min(940px, calc(100vw - 80px))', height: 'min(700px, calc(100vh - 80px))', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 14, border: `1px solid ${THEME.border}`, backgroundColor: 'var(--surface-floating)', boxShadow: 'var(--shadow-xl)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Browse marketplace"
        onClick={(event) => event.stopPropagation()}
      >
      <header style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 40px 12px' }}>
        <button type="button" onClick={onClose} style={{ position: 'absolute', right: 24, top: 24, background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={24} color={THEME.textTertiary} /></button>
        <h2 style={{ fontSize: 28, fontWeight: 600, color: THEME.textPrimary, margin: 0 }}>Browse plugins</h2>
      </header>

      <div style={{ display: 'flex', gap: 8, padding: '16px 40px', borderBottom: `1px solid ${THEME.border}` }}>
        {(['marketplace', 'personal', 'directories', 'publish', 'cowork'] as PluginMarketplaceTab[]).map((t) => (
          <button type="button" key={t} onClick={() => setActiveTab(t)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', backgroundColor: activeTab === t ? 'var(--ui-border-default)' : 'transparent', color: activeTab === t ? THEME.textPrimary : THEME.textSecondary, cursor: 'pointer', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 6 }}>
            {t === 'cowork' && <UsersThree size={16} weight="bold" color={activeTab === t ? 'var(--status-info)' : THEME.textSecondary} />}
            {t === 'directories' ? 'Sources' : t === 'personal' ? 'Personal sources' : t}
            {t === 'cowork' && (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 16, borderRadius: 9999, backgroundColor: 'var(--status-info)', color: 'var(--ui-text-inverse)', fontSize: 12, fontWeight: 600, padding: '0 6px' }}>NEW</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '24px 40px' }}>
        {activeTab === 'marketplace' ? (
          <PluginCatalogView
            plugins={marketplacePlugins}
            installedIds={marketplaceInstalledIds}
            onInstall={onInstall}
            onUpdate={onUpdate}
            onUninstall={onUninstall}
            isLoading={isMarketplaceLoading}
            title="Marketplace plugins"
            description="Curated plugins from enabled marketplace sources"
            badgeLabel="plugin"
          />
        ) : activeTab === 'personal' ? (
          <div style={{ maxWidth: 720 }}>
            <h3 style={{ margin: '0 0 6px', color: THEME.textPrimary, fontSize: 18 }}>Personal sources</h3>
            <p style={{ margin: '0 0 18px', color: THEME.textSecondary, fontSize: 13 }}>Add a GitHub repository or manifest URL to your private capability sources.</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input
                value={newSourceValue}
                onChange={(event) => setNewSourceValue(event.target.value)}
                placeholder="owner/repository or https://..."
                aria-label="Personal marketplace source"
                style={{ flex: 1, height: 34, border: `1px solid ${THEME.border}`, borderRadius: 6, background: 'var(--surface-canvas)', color: THEME.textPrimary, padding: '0 10px', outline: 'none' }}
              />
              <button
                type="button"
                onClick={() => {
                  const value = newSourceValue.trim();
                  if (!value) return;
                  onAddPersonalSource({ type: value.startsWith('http') ? 'url' : 'github', value, label: value });
                  setNewSourceValue('');
                }}
                style={{ height: 34, padding: '0 12px', border: `1px solid ${THEME.border}`, borderRadius: 6, background: 'var(--surface-hover)', color: THEME.textPrimary }}
              >
                Add source
              </button>
            </div>
            {personalSources.length === 0 ? (
              <div style={{ padding: 28, border: `1px solid ${THEME.border}`, borderRadius: 8, color: THEME.textSecondary, textAlign: 'center', fontSize: 13 }}>No personal sources added.</div>
            ) : personalSources.map((source) => (
              <div key={source.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: `1px solid ${THEME.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ color: THEME.textPrimary, fontSize: 13, fontWeight: 600 }}>{source.label || source.value}</div><div style={{ color: THEME.textTertiary, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>{source.type} · {source.value}</div></div>
                <button type="button" onClick={() => onRemovePersonalSource(source.id)} style={{ border: `1px solid ${THEME.border}`, borderRadius: 6, background: 'transparent', color: THEME.textSecondary, padding: '6px 9px' }}>Remove</button>
              </div>
            ))}
          </div>
        ) : activeTab === 'directories' ? (
          <div style={{ maxWidth: 720 }}>
            <h3 style={{ margin: '0 0 6px', color: THEME.textPrimary, fontSize: 18 }}>Marketplace sources</h3>
            <p style={{ margin: '0 0 18px', color: THEME.textSecondary, fontSize: 13 }}>Choose which curated catalogs can contribute plugins to your library.</p>
            {CURATED_MARKETPLACE_SOURCES.map((source) => {
              const enabled = curatedSourceEnabled[source.id] !== false;
              return <div key={source.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: `1px solid ${THEME.border}` }}><div style={{ flex: 1 }}><div style={{ color: THEME.textPrimary, fontSize: 13, fontWeight: 600 }}>{source.label}</div><div style={{ color: THEME.textSecondary, fontSize: 11 }}>{source.description}</div></div><button type="button" aria-pressed={enabled} onClick={() => onSetCuratedSourceEnabled((current) => ({ ...current, [source.id]: !enabled }))} style={{ width: 38, height: 22, padding: 2, border: 'none', borderRadius: 11, background: enabled ? 'var(--accent-primary)' : 'var(--ui-border-default)' }}><span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: enabled ? 'translateX(16px)' : 'translateX(0)', transition: 'transform 150ms' }} /></button></div>;
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderTop: `1px solid ${THEME.border}` }}><div style={{ flex: 1 }}><div style={{ color: THEME.textPrimary, fontSize: 13, fontWeight: 600 }}>Allow untrusted sources</div><div style={{ color: THEME.textSecondary, fontSize: 11 }}>Require explicit confirmation before installing unknown packages.</div></div><button type="button" aria-pressed={allowUntrustedMarketplaceSources} onClick={() => onSetAllowUntrustedMarketplaceSources((value) => !value)} style={{ width: 38, height: 22, padding: 2, border: 'none', borderRadius: 11, background: allowUntrustedMarketplaceSources ? 'var(--accent-primary)' : 'var(--ui-border-default)' }}><span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: allowUntrustedMarketplaceSources ? 'translateX(16px)' : 'translateX(0)', transition: 'transform 150ms' }} /></button></div>
          </div>
        ) : activeTab === 'publish' ? (
          <PublishTabView fs={fs} onOpenCreateModal={() => setShowCreatePluginModal(true)} onOpenValidateModal={() => setShowValidateModal(true)} onOpenSubmitModal={() => setShowSubmitModal(true)} />
        ) : activeTab === 'cowork' ? (
          <PluginCatalogView
            plugins={marketplacePlugins.filter((p) => p.category === 'cowork')}
            installedIds={marketplaceInstalledIds}
            onInstall={onInstall}
            onUpdate={onUpdate}
            onUninstall={onUninstall}
            isLoading={isMarketplaceLoading}
            title="Cowork plugins"
            description="Team skills and agent collaboration tools"
            badgeLabel="cowork"
          />
        ) : null}
      </div>
      </section>

      {showCreatePluginModal && <CreatePluginModal fs={fs} onClose={() => setShowCreatePluginModal(false)} showInfo={showInfo} showError={showError} />}
      {showValidateModal && <ValidatePluginModal onClose={() => setShowValidateModal(false)} showInfo={showInfo} showError={showError} />}
      {showSubmitModal && <SubmitToMarketplaceModal onClose={() => setShowSubmitModal(false)} onSubmit={() => {}} showInfo={showInfo} />}
    </div>
  );
}
