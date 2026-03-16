/**
 * Deployment Complete
 * 
 * Success screen with access details.
 */

import React from 'react';
import type { DeploymentStatus } from '../CloudDeployView';

interface DeploymentCompleteProps {
  status: DeploymentStatus;
  onNewDeployment: () => void;
}

export const DeploymentComplete: React.FC<DeploymentCompleteProps> = ({ status, onNewDeployment }) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="deployment-complete">
      <div className="success-icon">
        <span>🎉</span>
      </div>

      <h2>Deployment Complete!</h2>
      <p className="success-message">
        Your A2R instance is ready to use.
      </p>

      <div className="access-details">
        <h3>Access Your Instance</h3>
        
        <div className="access-item">
          <span className="label">🌐 Access URL:</span>
          <div className="access-value">
            <code>{status.accessUrl}</code>
            <button 
              className="btn-copy"
              onClick={() => copyToClipboard(status.accessUrl || '')}
            >
              📋 Copy
            </button>
          </div>
        </div>

        <div className="access-item">
          <span className="label">🔑 Instance IP:</span>
          <div className="access-value">
            <code>{status.instanceIp}</code>
            <button 
              className="btn-copy"
              onClick={() => copyToClipboard(status.instanceIp || '')}
            >
              📋 Copy
            </button>
          </div>
        </div>

        <div className="access-item">
          <span className="label">📧 Admin Email:</span>
          <div className="access-value">
            <code>admin@example.com</code>
          </div>
        </div>

        <div className="access-item">
          <span className="label">🔐 Temporary Password:</span>
          <div className="access-value">
            <code>••••••••••••</code>
            <button className="btn-copy">📋 Copy</button>
          </div>
          <p className="access-hint">
            Check your email for the temporary password. Change it on first login.
          </p>
        </div>
      </div>

      <div className="next-steps">
        <h3>Next Steps</h3>
        <ol>
          <li>Click the access URL to open your A2R instance</li>
          <li>Login with the temporary password</li>
          <li>Change your password immediately</li>
          <li>Configure your settings and start using A2R!</li>
        </ol>
      </div>

      <div className="help-section">
        <h3>Need Help?</h3>
        <ul>
          <li>📚 <a href="#">Documentation</a></li>
          <li>💬 <a href="#">Community Forum</a></li>
          <li>📧 <a href="#">Support Email</a></li>
        </ul>
      </div>

      <div className="complete-actions">
        <a 
          href={status.accessUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn-primary btn-large"
        >
          🚀 Open Your Instance
        </a>
        <button 
          type="button" 
          className="btn-secondary"
          onClick={onNewDeployment}
        >
          Deploy Another Instance
        </button>
      </div>

      <div className="deployment-info">
        <p>
          <strong>Deployment ID:</strong> {status.id}
        </p>
        <p>
          Save this ID for support requests.
        </p>
      </div>
    </div>
  );
};

export default DeploymentComplete;
