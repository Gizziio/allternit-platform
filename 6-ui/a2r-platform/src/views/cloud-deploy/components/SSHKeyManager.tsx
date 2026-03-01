/**
 * SSH Key Manager Component
 * 
 * Manage SSH keys for cloud deployments.
 * Generate new keys, import existing keys, and associate with deployments.
 */

import React, { useState, useEffect } from 'react';
import './SSHKeyManager.css';

export interface SSHKey {
  id: string;
  name: string;
  fingerprint: string;
  publicKey: string;
  privateKey?: string; // Only available when generating new
  createdAt: string;
  associatedInstances: string[];
  provider?: string;
}

interface SSHKeyManagerProps {
  onSelectKey?: (key: SSHKey) => void;
  selectedKeyId?: string;
  showActions?: boolean;
}

export const SSHKeyManager: React.FC<SSHKeyManagerProps> = ({
  onSelectKey,
  selectedKeyId,
  showActions = true,
}) => {
  const [keys, setKeys] = useState<SSHKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load keys on mount
  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    setIsLoading(true);
    try {
      // In production, fetch from backend
      // const response = await fetch('/api/v1/ssh-keys');
      // const data = await response.json();
      
      // Demo data for now
      const demoKeys: SSHKey[] = [
        {
          id: 'key-1',
          name: 'Hetzner Production',
          fingerprint: 'SHA256:abc123def456',
          publicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDIhz2GK/XCUj4i6Q5yQJNL1MXMY0RxzPV2QrBqfHrDq',
          createdAt: '2026-02-15T10:30:00Z',
          associatedInstances: ['inst-1', 'inst-2'],
          provider: 'hetzner',
        },
        {
          id: 'key-2',
          name: 'AWS Development',
          fingerprint: 'SHA256:xyz789uvw012',
          publicKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC7vbqajd...',
          createdAt: '2026-02-10T14:22:00Z',
          associatedInstances: ['inst-3'],
          provider: 'aws',
        },
      ];
      
      // Simulate API delay
      await new Promise(r => setTimeout(r, 500));
      setKeys(demoKeys);
    } catch (err) {
      setError('Failed to load SSH keys');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateKey = async (name: string, type: 'ed25519' | 'rsa' = 'ed25519') => {
    try {
      // In production, call backend API
      // const response = await fetch('/api/v1/ssh-keys', {
      //   method: 'POST',
      //   body: JSON.stringify({ name, type }),
      // });
      
      // Simulate key generation
      const newKey: SSHKey = {
        id: `key-${Date.now()}`,
        name,
        fingerprint: `SHA256:${Math.random().toString(36).substring(7)}`,
        publicKey: `ssh-${type} AAAAC3NzaC1lZDI1NTE5AAAAI${Math.random().toString(36).substring(7)}...`,
        privateKey: `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBkdXBsaWNhdGVzLWFyZS1maW5lLWZvci1kZW1vLXB1cnBvc2VzAAAAFHRl
c3RrZXlAZXhhbXBsZS5jb20AAAAJ-----END OPENSSH PRIVATE KEY-----`,
        createdAt: new Date().toISOString(),
        associatedInstances: [],
      };

      setKeys(prev => [newKey, ...prev]);
      setShowGenerateModal(false);
      setExpandedKey(newKey.id); // Auto-expand to show download option
    } catch (err) {
      setError('Failed to generate SSH key');
    }
  };

  const handleImportKey = async (name: string, publicKey: string, privateKey?: string) => {
    try {
      // In production, validate and store via backend
      const newKey: SSHKey = {
        id: `key-${Date.now()}`,
        name,
        fingerprint: `SHA256:${Math.random().toString(36).substring(7)}`,
        publicKey,
        privateKey,
        createdAt: new Date().toISOString(),
        associatedInstances: [],
      };

      setKeys(prev => [newKey, ...prev]);
      setShowImportModal(false);
    } catch (err) {
      setError('Failed to import SSH key');
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this SSH key? This action cannot be undone.')) {
      return;
    }

    try {
      // @placeholder APPROVED - Backend API pending
      // @ticket GAP-55
      // Stub: await fetch(`/api/v1/ssh-keys/${keyId}`, { method: 'DELETE' });
      setKeys(prev => prev.filter(k => k.id !== keyId));
    } catch (err) {
      setError('Failed to delete SSH key');
    }
  };

  const downloadPrivateKey = (key: SSHKey) => {
    if (!key.privateKey) return;
    
    const blob = new Blob([key.privateKey], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${key.name.replace(/\s+/g, '_')}_private_key`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could show a toast notification here
  };

  if (isLoading) {
    return (
      <div className="ssh-key-manager loading">
        <div className="spinner" />
        <p>Loading SSH keys...</p>
      </div>
    );
  }

  return (
    <div className="ssh-key-manager">
      {error && (
        <div className="error-banner">
          <span>❌ {error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Header */}
      <div className="ssh-key-header">
        <div>
          <h3>🔐 SSH Keys</h3>
          <p>Manage SSH keys for secure server access</p>
        </div>
        {showActions && (
          <div className="ssh-key-actions">
            <button 
              className="btn-secondary"
              onClick={() => setShowImportModal(true)}
            >
              📥 Import Key
            </button>
            <button 
              className="btn-primary"
              onClick={() => setShowGenerateModal(true)}
            >
              ✨ Generate New Key
            </button>
          </div>
        )}
      </div>

      {/* Keys List */}
      {keys.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔑</div>
          <h4>No SSH Keys</h4>
          <p>Generate or import an SSH key to get started with cloud deployments.</p>
          <button 
            className="btn-primary"
            onClick={() => setShowGenerateModal(true)}
          >
            Generate Your First Key
          </button>
        </div>
      ) : (
        <div className="ssh-key-list">
          {keys.map(key => (
            <div 
              key={key.id}
              className={`ssh-key-card ${selectedKeyId === key.id ? 'selected' : ''}`}
              onClick={() => onSelectKey?.(key)}
            >
              <div className="ssh-key-main">
                <div className="ssh-key-info">
                  <div className="ssh-key-name">
                    {key.name}
                    {key.provider && (
                      <span className="provider-badge">{key.provider}</span>
                    )}
                  </div>
                  <div className="ssh-key-fingerprint">
                    {key.fingerprint}
                  </div>
                  <div className="ssh-key-meta">
                    <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                    {key.associatedInstances.length > 0 && (
                      <span>• Used by {key.associatedInstances.length} instance(s)</span>
                    )}
                  </div>
                </div>
                
                <div className="ssh-key-controls">
                  {key.privateKey && (
                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadPrivateKey(key);
                      }}
                      title="Download private key"
                    >
                      💾
                    </button>
                  )}
                  <button
                    className="btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedKey(expandedKey === key.id ? null : key.id);
                    }}
                    title="Show public key"
                  >
                    {expandedKey === key.id ? '👁️‍🗨️' : '👁️'}
                  </button>
                  {showActions && (
                    <button
                      className="btn-icon danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteKey(key.id);
                      }}
                      title="Delete key"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded View */}
              {expandedKey === key.id && (
                <div className="ssh-key-expanded">
                  <div className="key-section">
                    <label>Public Key</label>
                    <div className="key-value">
                      <code>{key.publicKey}</code>
                      <button 
                        className="btn-copy"
                        onClick={() => copyToClipboard(key.publicKey)}
                      >
                        📋 Copy
                      </button>
                    </div>
                  </div>
                  
                  {key.privateKey && (
                    <div className="key-section warning">
                      <label>⚠️ Private Key (Keep Secret!)</label>
                      <div className="key-value private">
                        <code>{key.privateKey.substring(0, 100)}...</code>
                        <button 
                          className="btn-download"
                          onClick={() => downloadPrivateKey(key)}
                        >
                          💾 Download Securely
                        </button>
                      </div>
                      <p className="security-notice">
                        This private key will only be shown once. Download it now and store it securely.
                      </p>
                    </div>
                  )}

                  {key.associatedInstances.length > 0 && (
                    <div className="key-section">
                      <label>Associated Instances</label>
                      <ul className="instance-list">
                        {key.associatedInstances.map(instId => (
                          <li key={instId}>{instId}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Generate Key Modal */}
      {showGenerateModal && (
        <GenerateKeyModal
          onClose={() => setShowGenerateModal(false)}
          onGenerate={handleGenerateKey}
        />
      )}

      {/* Import Key Modal */}
      {showImportModal && (
        <ImportKeyModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImportKey}
        />
      )}
    </div>
  );
};

// Generate Key Modal
const GenerateKeyModal: React.FC<{
  onClose: () => void;
  onGenerate: (name: string, type: 'ed25519' | 'rsa') => void;
}> = ({ onClose, onGenerate }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'ed25519' | 'rsa'>('ed25519');

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>✨ Generate New SSH Key</h3>
        <p>Create a new SSH key pair for secure server access.</p>
        
        <div className="form-group">
          <label>Key Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Hetzner Production"
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>Key Type</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                value="ed25519"
                checked={type === 'ed25519'}
                onChange={() => setType('ed25519')}
              />
              <span className="radio-text">
                <strong>ED25519</strong> (Recommended)
                <small>Modern, fast, and secure</small>
              </span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                value="rsa"
                checked={type === 'rsa'}
                onChange={() => setType('rsa')}
              />
              <span className="radio-text">
                <strong>RSA 4096</strong>
                <small>Legacy compatibility</small>
              </span>
            </label>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button 
            className="btn-primary"
            onClick={() => onGenerate(name, type)}
            disabled={!name.trim()}
          >
            Generate Key Pair
          </button>
        </div>
      </div>
    </div>
  );
};

// Import Key Modal
const ImportKeyModal: React.FC<{
  onClose: () => void;
  onImport: (name: string, publicKey: string, privateKey?: string) => void;
}> = ({ onClose, onImport }) => {
  const [name, setName] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [includePrivate, setIncludePrivate] = useState(false);

  const isValid = name.trim() && publicKey.trim().startsWith('ssh-');

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>📥 Import SSH Key</h3>
        <p>Import an existing SSH public key.</p>
        
        <div className="form-group">
          <label>Key Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Personal Laptop"
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>Public Key</label>
          <textarea
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            placeholder="ssh-ed25519 AAAAC3NzaC..."
            rows={3}
          />
          <small>Paste your public key starting with ssh-ed25519 or ssh-rsa</small>
        </div>

        <div className="form-group checkbox">
          <label>
            <input
              type="checkbox"
              checked={includePrivate}
              onChange={(e) => setIncludePrivate(e.target.checked)}
            />
            Also store private key (for backups)
          </label>
        </div>

        {includePrivate && (
          <div className="form-group">
            <label>Private Key (Optional)</label>
            <textarea
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
              rows={5}
            />
            <small className="warning">⚠️ Store securely. Private keys should never be shared.</small>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button 
            className="btn-primary"
            onClick={() => onImport(name, publicKey, includePrivate ? privateKey : undefined)}
            disabled={!isValid}
          >
            Import Key
          </button>
        </div>
      </div>
    </div>
  );
};

export default SSHKeyManager;
