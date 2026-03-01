/**
 * Providers Page
 * 
 * Provider marketplace and management.
 */

import React from 'react';

export const ProvidersPage: React.FC = () => {
  return (
    <div className="providers-page">
      <h1 className="page-title">Providers</h1>
      <p className="page-description">
        Connect cloud providers for deployment.
      </p>
      
      <div className="providers-grid">
        {/* Provider cards will be populated dynamically */}
        <div className="provider-card-placeholder">
          <p>Provider cards will appear here</p>
        </div>
      </div>
    </div>
  );
};

export default ProvidersPage;
