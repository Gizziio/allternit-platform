/**
 * Step 1: Deployment Type Selection
 * 
 * Choose between Self-Host, Managed, or Partnership.
 */

import React, { useState } from 'react';

interface Step1DeploymentTypeProps {
  onNext: (type: 'self-host' | 'managed' | 'partnership') => void;
}

export const Step1DeploymentType: React.FC<Step1DeploymentTypeProps> = ({ onNext }) => {
  const [selectedType, setSelectedType] = useState<'self-host' | 'managed' | 'partnership'>('self-host');

  const deploymentTypes = [
    {
      id: 'self-host' as const,
      title: '🏠 Self-Host (BYOC)',
      description: 'Deploy to your own cloud account. You own the VPS, we handle the setup.',
      price: 'From $5/mo',
      features: ['Full control', 'Your cloud account', 'Lowest cost', 'Pay only for VPS'],
      popular: true,
    },
    {
      id: 'managed' as const,
      title: '⚙️ Managed Hosting',
      description: 'We host and manage everything for you. Just use the service.',
      price: 'From $29/mo',
      features: ['We manage everything', 'Automatic updates', '24/7 support', 'Hassle-free'],
      popular: false,
    },
    {
      id: 'partnership' as const,
      title: '🤝 VPS + Allternit Bundle',
      description: 'Get VPS through our partners with Allternit pre-configured.',
      price: 'From $10/mo',
      features: ['One-click setup', 'Partner pricing', 'Affiliate support', 'Easy start'],
      popular: false,
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(selectedType);
  };

  return (
    <div className="step-deployment-type">
      <h2>Choose Your Deployment Type</h2>
      <p className="step-description">Select how you want to run your Allternit instance.</p>

      <form onSubmit={handleSubmit}>
        <div className="deployment-type-grid">
          {deploymentTypes.map((type) => (
            <div
              key={type.id}
              className={`deployment-type-card ${type.popular ? 'popular' : ''} ${selectedType === type.id ? 'selected' : ''}`}
              onClick={() => setSelectedType(type.id)}
            >
              {type.popular && <span className="popular-badge">Most Popular</span>}
              <h3>{type.title}</h3>
              <p className="description">{type.description}</p>
              <p className="price">{type.price}</p>
              <ul className="features">
                {type.features.map((feature, i) => (
                  <li key={i}>✓ {feature}</li>
                ))}
              </ul>
              <div className="radio-indicator">
                <input
                  type="radio"
                  name="deploymentType"
                  value={type.id}
                  checked={selectedType === type.id}
                  onChange={() => setSelectedType(type.id)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="step-actions">
          <button type="submit" className="btn-primary">
            Continue →
          </button>
        </div>
      </form>
    </div>
  );
};

export default Step1DeploymentType;
