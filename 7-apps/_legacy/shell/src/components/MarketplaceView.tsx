import React, { useEffect, useState, useMemo } from 'react';
import { marketplaceClient, Asset as MarketplaceAsset, SearchParams } from '../runtime/marketplaceClient';

type AssetType = 'capsule' | 'agent' | 'pack' | 'tool' | 'workflow';

interface MarketplaceFilters {
  search: string;
  type: AssetType | 'all';
  sortBy: 'popular' | 'newest' | 'name' | 'rating';
}

// Using the Asset interface from marketplaceClient
type Asset = MarketplaceAsset & { type: AssetType };

export const MarketplaceView: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [filters, setFilters] = useState<MarketplaceFilters>({
    search: '',
    type: 'all',
    sortBy: 'popular',
  });

  useEffect(() => {
    loadAssets();
  }, [filters]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      // Prepare search parameters based on filters
      const searchParams: SearchParams = {
        query: filters.search || undefined,
        // We can map filters.type to a category if needed
        category: filters.type !== 'all' ? filters.type : undefined,
      };

      const results = await marketplaceClient.searchAssets(searchParams);
      // Transform the results to match our Asset type
      const transformedAssets: Asset[] = results.items.map(item => ({
        ...item,
        type: 'capsule' as AssetType, // Default type, could be mapped differently
        downloadCount: item.downloadCount || 0,
      }));
      setAssets(transformedAssets);
    } catch (err) {
      console.error('Failed to load marketplace:', err);
      // Set an empty array in case of error
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets = useMemo(() => {
    let result = assets;

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(asset =>
        asset.name.toLowerCase().includes(searchLower) ||
        asset.description.toLowerCase().includes(searchLower)
      );
    }

    if (filters.type !== 'all') {
      result = result.filter(asset => asset.type === filters.type);
    }

    return result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'popular':
          return b.downloadCount - a.downloadCount;
        case 'newest':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'rating':
          return b.rating - a.rating;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  }, [assets, filters]);

  const handleImport = async (id: string) => {
    try {
      await marketplaceClient.importAsset(id);
      await loadAssets(); // Refresh the asset list to reflect the imported status
    } catch (err) {
      console.error('Failed to import asset:', err);
      alert('Failed to import asset');
    }
  };

  const getTrustTierColor = (tier: string) => {
    switch (tier) {
      case 'verified': return '#10b981';
      case 'trusted': return '#3b82f6';
      case 'community': return '#f59e0b';
      case 'experimental': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getTrustTierLabel = (tier: string) => {
    switch (tier) {
      case 'verified': return 'Verified';
      case 'trusted': return 'Trusted';
      case 'community': return 'Community';
      case 'experimental': return 'Experimental';
      default: return 'Unknown';
    }
  };

  const getStarRating = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    return { fullStars, hasHalfStar, emptyStars };
  };

  const getAssetTypeIcon = (type: AssetType) => {
    switch (type) {
      case 'capsule': return '📦';
      case 'agent': return '🤖';
      case 'pack': return '📚';
      case 'tool': return '🔧';
      case 'workflow': return '⚙️';
      default: return '📄';
    }
  };

  if (loading) {
    return (
      <div className="marketplace-loading">
        <div className="loading-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        <h2>Loading Marketplace...</h2>
      </div>
    );
  }

  return (
    <div className="marketplace-view enhanced">
      <div className="marketplace-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Marketplace</h1>
            <p>Discover and import amazing capabilities for your A2rchitech experience</p>
          </div>
          <div className="header-stats">
            <div className="stat-item">
              <span className="stat-value">{assets.length}</span>
              <span className="stat-label">Assets</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{assets.filter(a => a.isImported).length}</span>
              <span className="stat-label">Imported</span>
            </div>
          </div>
        </div>
      </div>

      <div className="marketplace-filters">
        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search assets, tools, workflows..."
            className="search-input"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>

        <div className="filter-group">
          <button
            className={`filter-type ${filters.type === 'all' ? 'active' : ''}`}
            onClick={() => setFilters({ ...filters, type: 'all' })}
          >
            All
          </button>
          <button
            className={`filter-type ${filters.type === 'capsule' ? 'active' : ''}`}
            onClick={() => setFilters({ ...filters, type: 'capsule' })}
          >
            📦 Capsules
          </button>
          <button
            className={`filter-type ${filters.type === 'agent' ? 'active' : ''}`}
            onClick={() => setFilters({ ...filters, type: 'agent' })}
          >
            🤖 Agents
          </button>
          <button
            className={`filter-type ${filters.type === 'pack' ? 'active' : ''}`}
            onClick={() => setFilters({ ...filters, type: 'pack' })}
          >
            📚 Packs
          </button>
        </div>

        <div className="sort-group">
          <span className="sort-label">Sort by:</span>
          <button
            className={`sort-option ${filters.sortBy === 'popular' ? 'active' : ''}`}
            onClick={() => setFilters({ ...filters, sortBy: 'popular' })}
          >
            🔥 Popular
          </button>
          <button
            className={`sort-option ${filters.sortBy === 'newest' ? 'active' : ''}`}
            onClick={() => setFilters({ ...filters, sortBy: 'newest' })}
          >
            🆕 Newest
          </button>
          <button
            className={`sort-option ${filters.sortBy === 'rating' ? 'active' : ''}`}
            onClick={() => setFilters({ ...filters, sortBy: 'rating' })}
          >
            ⭐ Top Rated
          </button>
        </div>
      </div>

      <div className="assets-container">
        {filteredAssets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No assets found</h3>
            <p>Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          filteredAssets.map((asset, index) => {
            const { fullStars, hasHalfStar, emptyStars } = getStarRating(parseFloat(asset.rating));
            return (
              <div
                key={asset.id}
                className={`asset-card ${asset.isImported ? 'imported' : ''} ${selectedAsset?.id === asset.id ? 'selected' : ''}`}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => setSelectedAsset(selectedAsset?.id === asset.id ? null : asset)}
              >
                <div className="asset-header">
                  <div className="asset-icon">
                    {getAssetTypeIcon(asset.type)}
                  </div>
                  <div className="asset-title-group">
                    <h3 className="asset-name">{asset.name}</h3>
                    <span className="asset-version">v{asset.version}</span>
                  </div>
                  <div className="asset-badges">
                    <span
                      className="trust-badge"
                      style={{ background: getTrustTierColor(asset.trustTier) }}
                    >
                      {getTrustTierLabel(asset.trustTier)}
                    </span>
                    {asset.isImported && (
                      <span className="installed-badge">✓ Imported</span>
                    )}
                  </div>
                </div>

                <div className="asset-rating">
                  <div className="stars">
                    {Array(fullStars).fill(0).map((_, i) => (
                      <span key={`full-${i}`} className="star filled">★</span>
                    ))}
                    {hasHalfStar && <span className="star half">★</span>}
                    {Array(emptyStars).fill(0).map((_, i) => (
                      <span key={`empty-${i}`} className="star empty">★</span>
                    ))}
                    <span className="rating-number">{asset.rating}</span>
                  </div>
                  <span className="rating-count">({asset.ratingCount} reviews)</span>
                </div>

                <div className="asset-stats">
                  <div className="stat">
                    <span className="stat-icon">📥</span>
                    <span className="stat-value">{asset.downloadCount.toLocaleString()}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-icon">👤</span>
                    <span className="stat-value">{asset.author}</span>
                  </div>
                </div>

                <p className="asset-description">{asset.description}</p>

                <div className="asset-tags">
                  {asset.tags.map((tag, i) => (
                    <span key={i} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="asset-actions">
                  {asset.isImported ? (
                    <button disabled className="btn btn-installed">
                      <span className="btn-icon">✓</span>
                      Imported
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleImport(asset.id); }}
                      className="btn btn-primary"
                    >
                      <span className="btn-icon">⬇️</span>
                      Import
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); }}
                    className="btn btn-secondary"
                  >
                    <span className="btn-icon">ℹ️</span>
                    Details
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedAsset && (
        <div className="asset-modal" onClick={() => setSelectedAsset(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedAsset(null)}>✕</button>
            <div className="modal-body">
              <div className="modal-header">
                <div className="modal-icon">{getAssetTypeIcon(selectedAsset.type)}</div>
                <div>
                  <h2>{selectedAsset.name}</h2>
                  <span className="modal-version">v{selectedAsset.version}</span>
                </div>
              </div>
              <p className="modal-description">{selectedAsset.description}</p>
              <div className="modal-meta">
                <div className="meta-item">
                  <span className="meta-label">Author</span>
                  <span className="meta-value">{selectedAsset.author}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Downloads</span>
                  <span className="meta-value">{selectedAsset.downloadCount.toLocaleString()}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Rating</span>
                  <div className="rating-stars">
                    {Array(getStarRating(parseFloat(selectedAsset.rating)).fullStars).fill(0).map((_, i) => (
                      <span key={`modal-full-${i}`} className="star filled">★</span>
                    ))}
                    <span className="rating-number">{selectedAsset.rating}</span>
                  </div>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Reviews</span>
                  <span className="meta-value">{selectedAsset.ratingCount}</span>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  onClick={() => { handleImport(selectedAsset.id); setSelectedAsset(null); }}
                  className="btn btn-primary btn-large"
                  disabled={selectedAsset.isImported}
                >
                  {selectedAsset.isImported ? '✓ Already Imported' : '⬇️ Import Asset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
