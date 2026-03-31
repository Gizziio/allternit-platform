/**
 * Deploy Page
 * 
 * Deterministic, boring deployment wizard.
 * 5 steps, no fluff.
 */

import React from 'react';

export const DeployPage: React.FC = () => {
  return (
    <div className="deploy-page">
      <h1 className="page-title">Deploy New Instance</h1>
      <p className="page-description">
        Deploy A2R to cloud infrastructure. Deterministic, reproducible, monitored.
      </p>
      
      <div className="deploy-wizard-placeholder">
        <div className="wizard-step-indicator">
          <span className="step active">1</span>
          <span className="step">2</span>
          <span className="step">3</span>
          <span className="step">4</span>
          <span className="step">5</span>
        </div>
        
        <div className="wizard-content-placeholder">
          <h2>Step 1: Choose Infrastructure Mode</h2>
          <div className="mode-tiles">
            <div className="mode-tile selected">
              <h3>BYOC (Connect Existing VPS)</h3>
              <p>You own the VPS, we handle the setup.</p>
              <ul>
                <li>✓ Full control</li>
                <li>✓ Your cloud account</li>
                <li>✓ Lowest cost</li>
              </ul>
            </div>
            <div className="mode-tile">
              <h3>One-Click Provider (Marketplace)</h3>
              <p>Deploy through our partner providers.</p>
              <ul>
                <li>✓ Pre-configured</li>
                <li>✓ Partner pricing</li>
                <li>✓ Easy start</li>
              </ul>
            </div>
            <div className="mode-tile disabled">
              <h3>Managed (Coming Soon)</h3>
              <p>We host and manage everything.</p>
              <ul>
                <li>○ We manage everything</li>
                <li>○ Automatic updates</li>
                <li>○ 24/7 support</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeployPage;
