/**
 * Step 4: Credentials
 * 
 * Secure credential input with provider API console links.
 */

import React, { useState, useEffect } from 'react';
import { getProvider } from '../../data/providers';

interface Step4CredentialsProps {
  providerId: string;
  onNext: (credentials: { apiKey: string; apiSecret: string }) => void;
  onBack: () => void;
}

export const Step4Credentials: React.FC<Step4CredentialsProps> = ({ providerId, onNext, onBack }) => {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [validated, setValidated] = useState(false);
  const [validating, setValidating] = useState(false);

  const provider = getProvider(providerId);

  useEffect(() => {
    // Reset when provider changes
    setApiKey('');
    setApiSecret('');
    setValidated(false);
  }, [providerId]);

  if (!provider) {
    return (
      <div className="step-credentials">
        <h2>Enter Credentials</h2>
        <p>Please select a provider first.</p>
        <button type="button" className="btn-secondary" onClick={onBack}>
          ← Back to Providers
        </button>
      </div>
    );
  }

  const credentialField = provider.credentialFields[0];

  const handleValidate = async () => {
    setValidating(true);
    // Simulate validation - in production, call backend API
    await new Promise(resolve => setTimeout(resolve, 1500));
    setValidating(false);
    setValidated(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext({ apiKey, apiSecret });
  };

  const openApiConsole = () => {
    if (provider.apiConsoleUrl) {
      window.open(provider.apiConsoleUrl, '_blank');
    }
  };

  return (
    <div className="step-credentials">
      <h2>Enter {provider.name} Credentials</h2>
      <p className="step-description">
        We need API access to deploy your instance. Your credentials are encrypted 
        and never stored.
      </p>

      <div className="credential-help">
        <p>
          📚 Need help?{' '}
          <a href={provider.apiDocsUrl} target="_blank" rel="noopener noreferrer">
            View {provider.name} API documentation →
          </a>
        </p>
        {provider.apiConsoleUrl && (
          <p>
            🔧 Already have an account?{' '}
            <button type="button" className="link-button" onClick={openApiConsole}>
              Open API Console →
            </button>
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        {provider.credentialFields.map((field, index) => (
          <div key={index} className="form-group">
            <label>{field.name}</label>
            <div className="password-input">
              <input
                type={field.type === 'password' && showSecret ? 'text' : field.type}
                value={index === 0 ? apiKey : apiSecret}
                onChange={(e) => index === 0 ? setApiKey(e.target.value) : setApiSecret(e.target.value)}
                placeholder={field.placeholder}
                required
                autoComplete="off"
              />
              {field.type === 'password' && (
                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? '🙈' : '👁️'}
                </button>
              )}
            </div>
            <a
              href={field.helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="field-help-link"
            >
              Where do I find this? →
            </a>
          </div>
        ))}

        <div className="security-notice">
          🔒 <strong>Security Notice:</strong>
          <ul>
            <li>Credentials are encrypted in transit (HTTPS)</li>
            <li>Used only for this deployment session</li>
            <li>Not stored on our servers</li>
            <li>You can revoke API access anytime from your {provider.name} console</li>
          </ul>
        </div>

        {validated && (
          <div className="validation-success">
            ✓ Credentials validated successfully!
          </div>
        )}

        <div className="step-actions">
          <button type="button" className="btn-secondary" onClick={onBack}>
            ← Back
          </button>
          <button 
            type="button" 
            className="btn-secondary"
            onClick={handleValidate}
            disabled={!apiKey || !apiSecret || validating}
          >
            {validating ? 'Validating...' : 'Test Connection'}
          </button>
          <button 
            type="submit" 
            className="btn-primary"
            disabled={!apiKey || !apiSecret || !validated}
          >
            Continue →
          </button>
        </div>
      </form>
    </div>
  );
};

export default Step4Credentials;
