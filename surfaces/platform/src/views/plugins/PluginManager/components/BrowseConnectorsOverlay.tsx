import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { X, MagnifyingGlass, CircleNotch, Check } from '@phosphor-icons/react';
import { THEME, CONNECTOR_TYPE_OPTIONS } from '../constants';
import { ConnectorMarketplaceTab, ConnectorMarketplaceItem } from '../types';
import { fetchConnectorMarketplaceCatalog } from '../../../../plugins/marketplaceApi';

export function BrowseConnectorsOverlay({
  onInstallConnector,
  onCreateCustomConnector,
  onClose,
  existingConnectorNames,
}: {
  onInstallConnector: (connector: ConnectorMarketplaceItem) => void;
  onCreateCustomConnector: () => void;
  onClose: () => void;
  existingConnectorNames: Set<string>;
}) {
  const [tab, setTab] = useState<ConnectorMarketplaceTab>('featured');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [connectorCatalog, setConnectorCatalog] = useState<ConnectorMarketplaceItem[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const loadConnectorCatalog = useCallback(async () => {
    setIsCatalogLoading(true);
    setCatalogError(null);

    try {
      const result = await fetchConnectorMarketplaceCatalog();
      setConnectorCatalog(result.connectors);
    } catch (error) {
      setConnectorCatalog([]);
      setCatalogError(
        error instanceof Error ? error.message : 'Unable to load connector catalog from runtime sources.',
      );
    } finally {
      setIsCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConnectorCatalog();
  }, [loadConnectorCatalog]);

  const categories = useMemo(() => {
    const set = new Set<string>(connectorCatalog.map((item) => item.category));
    return ['all', ...Array.from(set).sort()];
  }, [connectorCatalog]);

  useEffect(() => {
    if (selectedCategory !== 'all' && !categories.includes(selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [categories, selectedCategory]);

  const filteredConnectors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return connectorCatalog.filter((item) => {
      if (tab === 'featured' && !item.featured) return false;
      if (selectedType !== 'all' && item.connectorType !== selectedType) return false;
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [connectorCatalog, tab, selectedType, selectedCategory, searchQuery]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
        zIndex: 210,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
      }}
      role="dialog"
      aria-label="Browse connectors"
    >
      <div
        style={{
          width: 'min(980px, 100%)',
          maxHeight: 'calc(100vh - 80px)',
          backgroundColor: '#1b1917',
          border: `1px solid ${THEME.borderStrong}`,
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '18px 20px 12px',
            borderBottom: `1px solid ${THEME.border}`,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 28, color: THEME.textPrimary, fontWeight: 600 }}>
              Connectors
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: THEME.textSecondary }}>
              Connect apps, files, and services to expand execution context across your workspace.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', color: THEME.textTertiary, cursor: 'pointer' }}
            aria-label="Close connectors browser"
          >
            <X size={18} />
          </button>
        </header>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 20px',
            borderBottom: `1px solid ${THEME.border}`,
          }}
        >
          <button
            onClick={() => setTab('featured')}
            style={{
              padding: '7px 10px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: tab === 'featured' ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: tab === 'featured' ? THEME.textPrimary : THEME.textSecondary,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Featured
          </button>
          <button
            onClick={() => setTab('all')}
            style={{
              padding: '7px 10px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: tab === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: tab === 'all' ? THEME.textPrimary : THEME.textSecondary,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            All
          </button>

          <div style={{ flex: 1 }} />

          <div
            style={{
              width: 240,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: `1px solid ${THEME.border}`,
              borderRadius: 8,
              padding: '7px 10px',
              backgroundColor: 'rgba(255,255,255,0.03)',
            }}
          >
            <MagnifyingGlass size={14} color={THEME.textTertiary} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search"
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: THEME.textPrimary,
                fontSize: 13,
              }}
              aria-label="Search connectors"
            />
          </div>

          <select
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value)}
            style={{
              borderRadius: 8,
              border: `1px solid ${THEME.border}`,
              backgroundColor: 'rgba(255,255,255,0.03)',
              color: THEME.textSecondary,
              fontSize: 12,
              padding: '7px 9px',
            }}
          >
            {CONNECTOR_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            style={{
              borderRadius: 8,
              border: `1px solid ${THEME.border}`,
              backgroundColor: 'rgba(255,255,255,0.03)',
              color: THEME.textSecondary,
              fontSize: 12,
              padding: '7px 9px',
            }}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category === 'all' ? 'Categories' : category}
              </option>
            ))}
          </select>
        </div>

        <div style={{ padding: '12px 20px 0' }}>
          <button
            onClick={onCreateCustomConnector}
            style={{
              border: 'none',
              background: 'transparent',
              color: THEME.accent,
              padding: 0,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Create custom connector
          </button>
        </div>

        <div style={{ padding: 20, overflow: 'auto' }}>
          {isCatalogLoading && (
            <div
              style={{
                textAlign: 'center',
                color: THEME.textTertiary,
                fontSize: 13,
                padding: 30,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CircleNotch size={16} />
              Loading connectors...
            </div>
          )}

          {!isCatalogLoading && catalogError && (
            <div
              style={{
                border: `1px solid ${THEME.borderStrong}`,
                borderRadius: 10,
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                padding: 14,
              }}
            >
              <div style={{ color: THEME.textPrimary, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                Failed to load connector marketplace
              </div>
              <div style={{ color: THEME.textSecondary, fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>
                {catalogError}
              </div>
              <button
                onClick={() => void loadConnectorCatalog()}
                style={{
                  border: `1px solid ${THEME.borderStrong}`,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  color: THEME.textPrimary,
                  borderRadius: 8,
                  padding: '7px 11px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {!isCatalogLoading && !catalogError && filteredConnectors.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))', gap: 10 }}>
              {filteredConnectors.map((item) => {
                const alreadyAdded = existingConnectorNames.has(item.name.toLowerCase());
                return (
                  <div
                    key={item.id}
                    style={{
                      border: `1px solid ${THEME.border}`,
                      borderRadius: 10,
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      padding: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: THEME.accentMuted,
                        border: `1px solid ${THEME.borderStrong}`,
                        color: THEME.textPrimary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: THEME.textPrimary, fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                        {item.name}
                      </div>
                      <div style={{ color: THEME.textSecondary, fontSize: 12, lineHeight: 1.4 }}>
                        {item.description}
                      </div>
                    </div>
                    <button
                      onClick={() => onInstallConnector(item)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        border: `1px solid ${THEME.borderStrong}`,
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        color: THEME.textPrimary,
                        cursor: alreadyAdded ? 'default' : 'pointer',
                        flexShrink: 0,
                        opacity: alreadyAdded ? 0.5 : 1,
                      }}
                      aria-label={alreadyAdded ? `${item.name} already added` : `Add ${item.name}`}
                      disabled={alreadyAdded}
                    >
                      {alreadyAdded ? <Check size={14} /> : '+'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!isCatalogLoading && !catalogError && filteredConnectors.length === 0 && (
            <div style={{ textAlign: 'center', color: THEME.textTertiary, fontSize: 13, padding: 30 }}>
              {connectorCatalog.length === 0
                ? 'No connectors are currently available from configured marketplace sources.'
                : 'No connectors match the current filters.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
