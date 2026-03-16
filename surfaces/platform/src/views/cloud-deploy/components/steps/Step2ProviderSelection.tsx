/**
 * Step 2: Provider Selection
 * 
 * Choose your cloud provider with direct signup links.
 * NO auto-detect - user explicitly confirms they've signed up.
 */

import React, { useState } from 'react';
import { PROVIDERS, Provider } from '../../data/providers';
import { ProviderComparison } from '../ProviderComparison';

interface Step2ProviderSelectionProps {
  selectedProvider: string;
  onNext: (providerId: string) => void;
  onBack: () => void;
  onWizardStart?: (providerId: string) => void;
}

export const Step2ProviderSelection: React.FC<Step2ProviderSelectionProps> = ({
  selectedProvider,
  onNext,
  onBack,
  onWizardStart,
}) => {
  const [providers] = useState<Provider[]>(PROVIDERS);
  const [justSignedUp, setJustSignedUp] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const handleSignupClick = (e: React.MouseEvent, provider: Provider) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(provider.signupUrl, '_blank', 'noopener,noreferrer');
    setJustSignedUp(provider.id);
  };

  const handleContinueAfterSignup = (providerId: string) => {
    // User explicitly confirms they completed signup
    onNext(providerId);
  };

  const handleProviderSelect = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (provider && !provider.apiConsoleUrl) {
      // No API console - they need to sign up manually first
      window.open(provider.signupUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    onNext(providerId);
  };

  return (
    <div className="step-provider-selection">
      <h2>Select Cloud Provider</h2>
      <p className="step-description">
        Choose where to deploy. Don't have an account? Click "Sign Up" to open 
        the provider's website, then click "I've Signed Up" to continue.
      </p>

      {/* Compare Button */}
      <div className="comparison-trigger">
        <button 
          className="btn-compare"
          onClick={() => setShowComparison(true)}
        >
          🔍 Compare All {providers.length} Providers
        </button>
      </div>

      <div className="provider-grid">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className={`provider-card ${selectedProvider === provider.id ? 'selected' : ''}`}
          >
            <div className="provider-header">
              <span className="provider-logo">{provider.logo}</span>
              <h3>{provider.name}</h3>
            </div>
            
            <p className="price">
              From {provider.currency === 'EUR' ? '€' : '$'}{provider.startingPrice}/mo
            </p>
            
            <p className="best-for">{provider.bestFor}</p>
            
            <div className="provider-stats">
              <span>⏱️ {provider.setupTime}</span>
              <span>🌍 {provider.regions.length} regions</span>
            </div>

            {/* Automation Level Badge */}
            <div className="automation-badge">
              {provider.apiConsoleUrl ? (
                <span className="automation-automated">✓ Automated Deployment</span>
              ) : (
                <span className="automation-manual">⚠ Manual Setup Required</span>
              )}
            </div>
            
            <ul className="provider-features">
              {provider.features.slice(0, 3).map((feature, i) => (
                <li key={i}>• {feature}</li>
              ))}
            </ul>

            <div className="provider-actions">
              {provider.apiConsoleUrl ? (
                <>
                  <button
                    type="button"
                    className={`btn-provider ${selectedProvider === provider.id ? 'selected' : ''}`}
                    onClick={() => handleProviderSelect(provider.id)}
                  >
                    {selectedProvider === provider.id ? '✓ Selected' : 'Select'}
                  </button>
                  <a
                    href={provider.apiConsoleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-provider-link"
                  >
                    Open API Console →
                  </a>
                  {onWizardStart && (
                    <button
                      type="button"
                      className="btn-provider-wizard"
                      onClick={() => onWizardStart(provider.id)}
                    >
                      🤖 Agent-Assisted Signup
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-provider-secondary"
                    onClick={(e) => handleSignupClick(e, provider)}
                  >
                    📝 Sign Up
                  </button>
                  {justSignedUp === provider.id && (
                    <button
                      type="button"
                      className="btn-provider"
                      onClick={() => handleContinueAfterSignup(provider.id)}
                    >
                      ✓ I've Signed Up - Continue
                    </button>
                  )}
                </>
              )}
              
              <a
                href={provider.apiDocsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="provider-help-link"
              >
                📚 API Guide
              </a>
            </div>

            {selectedProvider === provider.id && (
              <div className="selected-indicator">✓ Selected</div>
            )}
          </div>
        ))}
      </div>

      <div className="step-actions">
        <button type="button" className="btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <button 
          type="button" 
          className="btn-primary"
          onClick={() => selectedProvider && onNext(selectedProvider)}
          disabled={!selectedProvider}
        >
          Continue →
        </button>
      </div>

      {/* Provider Comparison Modal */}
      {showComparison && (
        <ProviderComparison
          selectedProvider={selectedProvider}
          onSelectProvider={(providerId) => {
            onNext(providerId);
          }}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  );
};

export default Step2ProviderSelection;
