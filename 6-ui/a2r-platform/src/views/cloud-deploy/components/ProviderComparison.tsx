/**
 * Provider Comparison Component
 * 
 * Side-by-side comparison of all cloud providers with
 * detailed feature matrix, pricing, and recommendations.
 */

import React, { useState, useMemo } from 'react';
import { PROVIDERS, Provider, InstanceType } from '../data/providers';
import './ProviderComparison.css';

interface ProviderComparisonProps {
  selectedProvider: string;
  onSelectProvider: (providerId: string) => void;
  onClose: () => void;
}

type SortField = 'price' | 'ram' | 'cpu' | 'regions' | 'setup';
type FilterCriteria = 'all' | 'automated' | 'budget' | 'performance' | 'global';

export const ProviderComparison: React.FC<ProviderComparisonProps> = ({
  selectedProvider,
  onSelectProvider,
  onClose,
}) => {
  const [sortBy, setSortBy] = useState<SortField>('price');
  const [filterBy, setFilterBy] = useState<FilterCriteria>('all');
  const [showDetails, setShowDetails] = useState<string | null>(null);

  // Filter and sort providers
  const filteredProviders = useMemo(() => {
    let filtered = [...PROVIDERS];

    // Apply filters
    switch (filterBy) {
      case 'automated':
        filtered = filtered.filter(p => p.apiConsoleUrl);
        break;
      case 'budget':
        filtered = filtered.filter(p => p.startingPrice < 10);
        break;
      case 'performance':
        filtered = filtered.filter(p => 
          p.instanceTypes.some(i => i.memoryGb >= 8)
        );
        break;
      case 'global':
        filtered = filtered.filter(p => p.regions.length >= 5);
        break;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return a.startingPrice - b.startingPrice;
        case 'ram':
          return b.instanceTypes[0]?.memoryGb - a.instanceTypes[0]?.memoryGb;
        case 'cpu':
          return b.instanceTypes[0]?.vcpus - a.instanceTypes[0]?.vcpus;
        case 'regions':
          return b.regions.length - a.regions.length;
        case 'setup':
          return parseInt(a.setupTime) - parseInt(b.setupTime);
        default:
          return 0;
      }
    });

    return filtered;
  }, [sortBy, filterBy]);

  // Get recommended provider based on criteria
  const recommendedProvider = useMemo(() => {
    // Recommend based on best value (RAM per dollar)
    return PROVIDERS.reduce((best, current) => {
      const bestValue = best.instanceTypes[0]?.memoryGb / best.startingPrice;
      const currentValue = current.instanceTypes[0]?.memoryGb / current.startingPrice;
      return currentValue > bestValue ? current : best;
    });
  }, []);

  const getAutomationLevel = (provider: Provider) => {
    if (provider.apiConsoleUrl) {
      return { level: 'Full', color: 'green', icon: '✓' };
    }
    return { level: 'Manual', color: 'orange', icon: '⚠' };
  };

  const getBestInstance = (provider: Provider) => {
    return provider.instanceTypes.find(i => i.recommended) || provider.instanceTypes[0];
  };

  return (
    <div className="provider-comparison-overlay">
      <div className="provider-comparison-modal">
        <div className="comparison-header">
          <div>
            <h2>🔍 Provider Comparison</h2>
            <p>Compare all {PROVIDERS.length} cloud providers side-by-side</p>
          </div>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        {/* Recommendation Banner */}
        <div className="recommendation-banner">
          <span className="rec-badge">🏆 Recommended</span>
          <span className="rec-text">
            <strong>{recommendedProvider.name}</strong> offers the best value with{' '}
            {getBestInstance(recommendedProvider)?.memoryGb}GB RAM starting at {' '}
            {recommendedProvider.currency === 'EUR' ? '€' : '$'}
            {recommendedProvider.startingPrice}/mo
          </span>
          <button 
            className="btn-rec-select"
            onClick={() => onSelectProvider(recommendedProvider.id)}
          >
            Select {recommendedProvider.name}
          </button>
        </div>

        {/* Filters */}
        <div className="comparison-filters">
          <div className="filter-group">
            <label>Filter:</label>
            <select value={filterBy} onChange={(e) => setFilterBy(e.target.value as FilterCriteria)}>
              <option value="all">All Providers</option>
              <option value="automated">Automated Deployment</option>
              <option value="budget">Budget Friendly (&lt;$10)</option>
              <option value="performance">High Performance</option>
              <option value="global">Global Coverage</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortField)}>
              <option value="price">Lowest Price</option>
              <option value="ram">Most RAM</option>
              <option value="cpu">Most CPU</option>
              <option value="regions">Most Regions</option>
              <option value="setup">Fastest Setup</option>
            </select>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="comparison-table-container">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Starting Price</th>
                <th>Best Value Plan</th>
                <th>Regions</th>
                <th>Automation</th>
                <th>Setup Time</th>
                <th>Best For</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProviders.map((provider) => {
                const automation = getAutomationLevel(provider);
                const bestInstance = getBestInstance(provider);
                const isSelected = selectedProvider === provider.id;
                const isRecommended = provider.id === recommendedProvider.id;

                return (
                  <React.Fragment key={provider.id}>
                    <tr 
                      className={`provider-row ${isSelected ? 'selected' : ''} ${isRecommended ? 'recommended' : ''}`}
                      onClick={() => setShowDetails(showDetails === provider.id ? null : provider.id)}
                    >
                      <td className="provider-cell">
                        <span className="provider-logo">{provider.logo}</span>
                        <div className="provider-info">
                          <span className="provider-name">{provider.name}</span>
                          {isRecommended && <span className="rec-tag">🏆 Best Value</span>}
                        </div>
                      </td>
                      <td className="price-cell">
                        <span className="price">
                          {provider.currency === 'EUR' ? '€' : '$'}{provider.startingPrice}
                        </span>
                        <span className="price-period">/mo</span>
                      </td>
                      <td className="plan-cell">
                        {bestInstance && (
                          <div className="plan-details">
                            <span className="plan-name">{bestInstance.name}</span>
                            <span className="plan-specs">
                              {bestInstance.vcpus} vCPU · {bestInstance.memoryGb}GB RAM
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="regions-cell">
                        <span className="region-count">{provider.regions.length}</span>
                        <span className="region-preview">
                          {provider.regions.slice(0, 2).map(r => r.flag).join(' ')}
                          {provider.regions.length > 2 && ' +' + (provider.regions.length - 2)}
                        </span>
                      </td>
                      <td className="automation-cell">
                        <span className={`automation-badge ${automation.color}`}>
                          {automation.icon} {automation.level}
                        </span>
                      </td>
                      <td className="setup-cell">{provider.setupTime}</td>
                      <td className="best-for-cell">
                        <span className="best-for-tag">{provider.bestFor}</span>
                      </td>
                      <td className="action-cell">
                        <button
                          className={`btn-select ${isSelected ? 'selected' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProvider(provider.id);
                          }}
                        >
                          {isSelected ? '✓ Selected' : 'Select'}
                        </button>
                      </td>
                    </tr>
                    {showDetails === provider.id && (
                      <tr className="details-row">
                        <td colSpan={8}>
                          <ProviderDetails provider={provider} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="comparison-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {selectedProvider && (
            <button 
              className="btn-primary"
              onClick={onClose}
            >
              Continue with {PROVIDERS.find(p => p.id === selectedProvider)?.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Detailed provider view
const ProviderDetails: React.FC<{ provider: Provider }> = ({ provider }) => {
  return (
    <div className="provider-details">
      <div className="details-section">
        <h4>Features</h4>
        <ul className="feature-list">
          {provider.features.map((feature, i) => (
            <li key={i}>✓ {feature}</li>
          ))}
        </ul>
      </div>
      
      <div className="details-section">
        <h4>Available Regions</h4>
        <div className="region-list">
          {provider.regions.map(region => (
            <span key={region.id} className="region-tag">
              {region.flag} {region.name}
            </span>
          ))}
        </div>
      </div>

      <div className="details-section">
        <h4>Instance Types</h4>
        <div className="instance-list">
          {provider.instanceTypes.map(instance => (
            <div key={instance.id} className={`instance-card ${instance.recommended ? 'recommended' : ''}`}>
              {instance.recommended && <span className="rec-badge">★ Recommended</span>}
              <span className="instance-name">{instance.name}</span>
              <span className="instance-specs">{instance.vcpus} vCPU · {instance.memoryGb}GB RAM · {instance.storageGb}GB SSD</span>
              <span className="instance-price">
                {provider.currency === 'EUR' ? '€' : '$'}{instance.priceMonthly}/mo
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="details-section">
        <h4>Links</h4>
        <div className="link-list">
          <a href={provider.website} target="_blank" rel="noopener noreferrer">
            🌐 Website
          </a>
          <a href={provider.signupUrl} target="_blank" rel="noopener noreferrer">
            📝 Sign Up
          </a>
          <a href={provider.apiDocsUrl} target="_blank" rel="noopener noreferrer">
            📚 API Docs
          </a>
          {provider.apiConsoleUrl && (
            <a href={provider.apiConsoleUrl} target="_blank" rel="noopener noreferrer">
              🔧 API Console
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProviderComparison;
