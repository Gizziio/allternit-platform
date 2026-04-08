import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  X, 
  MagnifyingGlass, 
  CircleNotch, 
  ArrowsClockwise, 
  Folder, 
  PuzzlePiece as Puzzle, 
  Check, 
  ArrowSquareOut, 
  Shield, 
  DownloadSimple 
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
  fetchExternalMarketplaceDirectories,
  type ExternalMarketplaceDirectoryEntry 
} from '../../../../plugins/marketplaceApi';
import { 
  parseGitHubRepoRef, 
  isVersionNewer, 
  isPluginBlockedByTrustPolicy, 
  normalizeMarketplacePluginPayload,
  extractPluginRecordsFromZip
} from '../utils';
import { useErrorToast } from '../../ErrorBoundary';
import type { FileSystemAPI } from '../../../../plugins/fileSystem';
import { StarRating } from '../../../../components/StarRating';
import { PublishTabView } from './PublishTabView';
import { CreatePluginModal, ValidatePluginModal, SubmitToMarketplaceModal } from './PublishModals';

export function BrowsePluginsOverlay({
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
  const [activeTab, setActiveTab] = useState<PluginMarketplaceTab>('marketplace');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [marketplacePlugins, setMarketplacePlugins] = useState<MarketplacePlugin[]>([]);
  const [marketplaceSource, setMarketplaceSource] = useState<'api' | 'curated' | 'github' | 'none'>('none');
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);
  const [personalEntries, setPersonalEntries] = useState<Array<{ source: PersonalMarketplaceSource; plugin: MarketplacePlugin }>>([]);
  const [isMarketplaceLoading, setIsMarketplaceLoading] = useState(true);
  const [isPersonalLoading, setIsPersonalLoading] = useState(false);
  const [personalSourceWarnings, setPersonalSourceWarnings] = useState<Record<string, string>>({});
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);
  const [externalDirectories, setExternalDirectories] = useState<ExternalMarketplaceDirectoryEntry[]>([]);
  const [isExternalDirectoriesLoading, setIsExternalDirectoriesLoading] = useState(false);
  const { showError, showInfo, showWarning } = useErrorToast();

  const enabledCuratedSourceIds = useMemo(() => {
    return CURATED_MARKETPLACE_SOURCES
      .filter((source) => curatedSourceEnabled[source.id] !== false)
      .map((source) => source.id);
  }, [curatedSourceEnabled]);

  useEffect(() => {
    void (async () => {
      setIsMarketplaceLoading(true);
      setMarketplaceError(null);
      try {
        const result = await searchMarketplace(searchQuery, {
          category: activeCategory === 'all' ? undefined : activeCategory,
          allowedCuratedSourceIds: enabledCuratedSourceIds,
        });
        setMarketplaceSource(result.source);
        setMarketplacePlugins(result.plugins.map((p) => ({
          ...p,
          installed: marketplaceInstalledIds.includes(p.id),
        })));
      } catch (e) {
        showError('Failed to load marketplace');
        setMarketplacePlugins([]);
        setMarketplaceError(e instanceof Error ? e.message : 'Unable to load marketplace data.');
      } finally {
        setIsMarketplaceLoading(false);
      }
    })();
  }, [searchQuery, activeCategory, enabledCuratedSourceIds, marketplaceInstalledIds, refreshNonce, showError]);

  const loadPersonalSources = useCallback(async () => {
    setIsPersonalLoading(true);
    const warnings: Record<string, string> = {};
    const loadedEntries: Array<{ source: PersonalMarketplaceSource; plugin: MarketplacePlugin }> = [];
    const seen = new Set<string>();

    for (const source of personalSources) {
      try {
        if (source.type === 'github') {
          const repo = parseGitHubRepoRef(source.value);
          if (!repo) { warnings[source.id] = 'Invalid GitHub format.'; continue; }
          const plugin = await fetchPluginFromGitHub(repo.owner, repo.repo);
          if (!plugin) { warnings[source.id] = 'Unable to fetch metadata.'; continue; }
          const candidate = { ...plugin, category: plugin.category || 'personal' };
          if (!seen.has(candidate.id)) { seen.add(candidate.id); loadedEntries.push({ source, plugin: candidate }); }
        } else if (source.type === 'url') {
          const response = await fetch(source.value);
          if (!response.ok) { warnings[source.id] = `Source unavailable (${response.status}).`; continue; }
          const payload = await response.json();
          const plugin = normalizeMarketplacePluginPayload(payload, { id: source.id, name: source.label || source.value });
          if (plugin && !seen.has(plugin.id)) { seen.add(plugin.id); loadedEntries.push({ source, plugin }); }
        }
      } catch (error) {
        warnings[source.id] = error instanceof Error ? error.message : 'Failed to resolve source.';
      }
    }
    setPersonalSourceWarnings(warnings);
    setPersonalEntries(loadedEntries);
    setIsPersonalLoading(false);
  }, [personalSources]);

  useEffect(() => { void loadPersonalSources(); }, [loadPersonalSources]);

  const filteredMarketplace = marketplacePlugins.filter((plugin) => activeCategory === 'all' || plugin.category === activeCategory);

  const handleUpdateAll = useCallback(async () => {
    const updatable = filteredMarketplace.filter(p => marketplaceInstalledIds.includes(p.id) && isVersionNewer(p.version, installedVersions[p.id]));
    if (updatable.length === 0) return;
    setIsUpdatingAll(true);
    try {
      for (const plugin of updatable) await onUpdate(plugin);
      showInfo(`Updated ${updatable.length} plugins.`);
    } finally { setIsUpdatingAll(false); setRefreshNonce(n => n + 1); }
  }, [filteredMarketplace, marketplaceInstalledIds, installedVersions, onUpdate, showInfo]);

  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [addSourceType, setAddSourceType] = useState<'github' | 'url' | 'upload' | 'local' | null>(null);
  const [sourceInputValue, setSourceInputValue] = useState('');
  const [sourceAccepted, setSourceAccepted] = useState(false);
  const [showCreatePluginModal, setShowCreatePluginModal] = useState(false);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.92)', backdropFilter: 'blur(12px)', zIndex: 200, display: 'flex', flexDirection: 'column' }} role="dialog">
      <header style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 40px 16px', borderBottom: `1px solid ${THEME.border}`, backgroundColor: 'rgba(12, 10, 9, 0.8)' }}>
        <button onClick={onClose} style={{ position: 'absolute', right: 24, top: 24, background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={24} color={THEME.textTertiary} /></button>
        <h2 style={{ fontSize: 28, fontWeight: 600, color: THEME.textPrimary, margin: 0 }}>Browse plugins</h2>
      </header>

      <div style={{ display: 'flex', gap: 8, padding: '16px 40px', borderBottom: `1px solid ${THEME.border}` }}>
        {['marketplace', 'personal', 'directories', 'publish'].map((t) => (
          <button key={t} onClick={() => setActiveTab(t as any)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', backgroundColor: activeTab === t ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === t ? THEME.textPrimary : THEME.textSecondary, cursor: 'pointer', textTransform: 'capitalize' }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '24px 40px' }}>
        {activeTab === 'publish' ? (
          <PublishTabView fs={fs} onOpenCreateModal={() => setShowCreatePluginModal(true)} onOpenValidateModal={() => setShowValidateModal(true)} onOpenSubmitModal={() => setShowSubmitModal(true)} />
        ) : (
          <div style={{ color: THEME.textPrimary }}>Tab {activeTab} content here (simplified for now)</div>
        )}
      </div>

      {showCreatePluginModal && <CreatePluginModal fs={fs} onClose={() => setShowCreatePluginModal(false)} showInfo={showInfo} showError={showError} />}
      {showValidateModal && <ValidatePluginModal onClose={() => setShowValidateModal(false)} showInfo={showInfo} showError={showError} />}
      {showSubmitModal && <SubmitToMarketplaceModal onClose={() => setShowSubmitModal(false)} onSubmit={() => {}} showInfo={showInfo} />}
    </div>
  );
}
