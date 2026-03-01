/**
 * Step 5: Review & Deploy
 * 
 * Final review before deployment.
 */

import React from 'react';
import type { DeploymentConfig } from '../../CloudDeployView';

interface Step5ReviewProps {
  config: DeploymentConfig;
  onStart: (config: DeploymentConfig) => void;
  onBack: () => void;
}

export const Step5Review: React.FC<Step5ReviewProps> = ({ config, onStart, onBack }) => {
  const providerNames: Record<string, string> = {
    hetzner: 'Hetzner Cloud',
    contabo: 'Contabo',
    racknerd: 'RackNerd',
    digitalocean: 'DigitalOcean',
    aws: 'Amazon Web Services',
  };

  const instanceNames: Record<string, string> = {
    small: 'Small (1 vCPU, 1GB)',
    medium: 'Medium (2 vCPU, 4GB)',
    large: 'Large (4 vCPU, 8GB)',
    xlarge: 'XLarge (8 vCPU, 16GB)',
  };

  const regionNames: Record<string, string> = {
    'us-east': 'US East (Virginia)',
    'us-west': 'US West (Oregon)',
    'eu-west': 'EU (Ireland)',
    'eu-central': 'EU (Frankfurt)',
    'asia': 'Asia (Singapore)',
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart(config);
  };

  return (
    <div className="step-review">
      <h2>Review & Deploy</h2>
      <p className="step-description">
        Please review your configuration before deploying.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="review-summary">
          <h3>Deployment Summary</h3>
          
          <div className="review-item">
            <span className="label">Deployment Type:</span>
            <span className="value">
              {config.deploymentType === 'self-host' && '🏠 Self-Host (BYOC)'}
              {config.deploymentType === 'managed' && '⚙️ Managed Hosting'}
              {config.deploymentType === 'partnership' && '🤝 VPS + A2R Bundle'}
            </span>
          </div>

          <div className="review-item">
            <span className="label">Provider:</span>
            <span className="value">{providerNames[config.providerId] || config.providerId}</span>
          </div>

          <div className="review-item">
            <span className="label">Region:</span>
            <span className="value">{regionNames[config.regionId] || config.regionId}</span>
          </div>

          <div className="review-item">
            <span className="label">Instance:</span>
            <span className="value">{instanceNames[config.instanceTypeId] || config.instanceTypeId}</span>
          </div>

          <div className="review-item">
            <span className="label">Storage:</span>
            <span className="value">{config.storageGb} GB</span>
          </div>

          <div className="review-item">
            <span className="label">Instance Name:</span>
            <span className="value">{config.instanceName}</span>
          </div>
        </div>

        <div className="cost-estimate">
          <h3>Estimated Cost</h3>
          <div className="cost-row">
            <span>Instance:</span>
            <span>~$15.00/mo</span>
          </div>
          <div className="cost-row">
            <span>Storage:</span>
            <span>+${(config.storageGb * 0.10).toFixed(2)}/mo</span>
          </div>
          <div className="cost-row total">
            <span>Total:</span>
            <span>~${(15 + config.storageGb * 0.10).toFixed(2)}/mo</span>
          </div>
        </div>

        <div className="deployment-notice">
          <h4>⚠️ Important</h4>
          <ul>
            <li>Deployment takes approximately 5 minutes</li>
            <li>You will receive access details when complete</li>
            <li>You can monitor progress in real-time</li>
            <li>Cloud provider will bill you directly</li>
          </ul>
        </div>

        <div className="terms-check">
          <label>
            <input type="checkbox" required />
            I understand that I will be billed by the cloud provider directly.
          </label>
        </div>

        <div className="step-actions">
          <button type="button" className="btn-secondary" onClick={onBack}>
            ← Back
          </button>
          <button type="submit" className="btn-primary btn-deploy">
            🚀 Deploy Now
          </button>
        </div>
      </form>
    </div>
  );
};

export default Step5Review;
