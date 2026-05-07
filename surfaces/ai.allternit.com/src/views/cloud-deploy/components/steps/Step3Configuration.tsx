/**
 * Step 3: Configuration
 * 
 * Select region, instance type, and storage with live data.
 */

import React, { useState, useEffect } from 'react';
import { getProvider, getProviderRegion, getProviderInstance } from '../../data/providers';
import type { DeploymentConfig } from '../../CloudDeployView';

interface Step3ConfigurationProps {
  config: Partial<DeploymentConfig>;
  onNext: (config: Partial<DeploymentConfig>) => void;
  onBack: () => void;
}

export const Step3Configuration: React.FC<Step3ConfigurationProps> = ({ config, onNext, onBack }) => {
  const [regionId, setRegionId] = useState(config.regionId || '');
  const [instanceTypeId, setInstanceTypeId] = useState(config.instanceTypeId || '');
  const [storageGb, setStorageGb] = useState(config.storageGb || 100);
  const [instanceName, setInstanceName] = useState(config.instanceName || `allternit-instance-${Math.random().toString(36).substring(7)}`);
  
  const provider = config.providerId ? getProvider(config.providerId) : null;
  const selectedRegion = provider && regionId ? getProviderRegion(provider.id, regionId) : null;
  const selectedInstance = provider && instanceTypeId ? getProviderInstance(provider.id, instanceTypeId) : null;

  useEffect(() => {
    // Auto-select first region and recommended instance
    if (provider && !regionId && provider.regions.length > 0) {
      setRegionId(provider.regions[0].id);
    }
    if (provider && !instanceTypeId) {
      const recommended = provider.instanceTypes.find(i => i.recommended) || provider.instanceTypes[0];
      setInstanceTypeId(recommended.id);
    }
  }, [provider]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext({ regionId, instanceTypeId, storageGb, instanceName });
  };

  if (!provider) {
    return (
      <div className="step-configuration">
        <h2>Configure Your Instance</h2>
        <p>Please select a provider first.</p>
        <button type="button" className="btn-secondary" onClick={onBack}>
          ← Back to Providers
        </button>
      </div>
    );
  }

  const totalMonthly = (selectedInstance?.priceMonthly || 0) + (storageGb * 0.10);

  return (
    <div className="step-configuration">
      <h2>Configure Your {provider.name} Instance</h2>
      <p className="step-description">Choose your deployment settings.</p>

      <form onSubmit={handleSubmit}>
        {/* Instance Name */}
        <div className="form-group">
          <label>Instance Name</label>
          <input
            type="text"
            value={instanceName}
            onChange={(e) => setInstanceName(e.target.value)}
            placeholder="my-allternit-instance"
            required
          />
        </div>

        {/* Region Selection */}
        <div className="form-group">
          <label>Region</label>
          <div className="region-grid">
            {provider.regions.map((region) => (
              <label
                key={region.id}
                className={`region-option ${regionId === region.id ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="region"
                  value={region.id}
                  checked={regionId === region.id}
                  onChange={(e) => setRegionId(e.target.value)}
                />
                <span className="region-flag">{region.flag}</span>
                <span className="region-name">{region.name}</span>
                <span className="region-location">{region.location}</span>
              </label>
            ))}
          </div>
          {selectedRegion && (
            <p className="region-hint">
              📍 Deploying to {selectedRegion.name}, {selectedRegion.location}
            </p>
          )}
        </div>

        {/* Instance Type */}
        <div className="form-group">
          <label>Instance Size</label>
          <div className="instance-grid">
            {provider.instanceTypes.map((instance) => (
              <label
                key={instance.id}
                className={`instance-option ${instanceTypeId === instance.id ? 'selected' : ''} ${instance.recommended ? 'recommended' : ''}`}
              >
                {instance.recommended && <span className="recommended-badge">Recommended</span>}
                <input
                  type="radio"
                  name="instance"
                  value={instance.id}
                  checked={instanceTypeId === instance.id}
                  onChange={(e) => setInstanceTypeId(e.target.value)}
                />
                <h4>{instance.name}</h4>
                <div className="instance-specs">
                  <span>{instance.vcpus} vCPU</span>
                  <span>{instance.memoryGb}GB RAM</span>
                  <span>{instance.storageGb}GB SSD</span>
                </div>
                <span className="instance-price">
                  {provider.currency === 'EUR' ? '€' : '$'}{instance.priceMonthly}/mo
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Storage */}
        <div className="form-group">
          <label>Additional Storage: {storageGb} GB</label>
          <input
            type="range"
            min="0"
            max="1000"
            step="10"
            value={storageGb}
            onChange={(e) => setStorageGb(Number(e.target.value))}
          />
          <div className="storage-hint">
            <span>0 GB</span>
            <span>500 GB</span>
            <span>1000 GB</span>
          </div>
          <p className="storage-cost">+${(storageGb * 0.10).toFixed(2)}/month</p>
        </div>

        {/* Cost Summary */}
        <div className="cost-summary">
          <h4>Estimated Monthly Cost</h4>
          <div className="cost-breakdown">
            <span>Instance ({selectedInstance?.name}):</span>
            <span>{provider.currency === 'EUR' ? '€' : '$'}{selectedInstance?.priceMonthly.toFixed(2)}</span>
          </div>
          <div className="cost-breakdown">
            <span>Storage ({storageGb} GB):</span>
            <span>+${(storageGb * 0.10).toFixed(2)}</span>
          </div>
          <div className="cost-total">
            <span>Total:</span>
            <span>${totalMonthly.toFixed(2)}/mo</span>
          </div>
          <p className="cost-note">
            💡 You pay the cloud provider directly. Allternit software is free.
          </p>
        </div>

        <div className="step-actions">
          <button type="button" className="btn-secondary" onClick={onBack}>
            ← Back
          </button>
          <button type="submit" className="btn-primary" disabled={!regionId || !instanceTypeId}>
            Continue →
          </button>
        </div>
      </form>
    </div>
  );
};

export default Step3Configuration;
