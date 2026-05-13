/**
 * SSH Key Manager Component
 * 
 * Manage SSH keys for cloud deployments.
 * Generate new keys, import existing keys, and associate with deployments.
 */

import React, { useReducer, useEffect, useSyncExternalStore } from 'react';
import './SSHKeyManager.css';

// ============================================================================
// Types
// ============================================================================

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

interface State {
  keys: SSHKey[];
  isLoading: boolean;
  showGenerateModal: boolean;
  showImportModal: boolean;
  expandedKey: string | null;
  error: string | null;
}

type Action =
  | { type: 'SET_KEYS'; keys: SSHKey[] }
  | { type: 'ADD_KEY'; key: SSHKey }
  | { type: 'DELETE_KEY'; id: string }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_MODAL'; modal: 'generate' | 'import' | null; open: boolean }
  | { type: 'TOGGLE_EXPAND'; id: string }
  | { type: 'SET_ERROR'; error: string | null };

// ============================================================================
// State Management
// ============================================================================

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_KEYS':
      return { ...state, keys: action.keys, isLoading: false };
    case 'ADD_KEY':
      return { ...state, keys: [action.key, ...state.keys] };
    case 'DELETE_KEY':
      return { ...state, keys: state.keys.filter(k => k.id !== action.id) };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    case 'SET_MODAL':
      if (action.modal === 'generate') return { ...state, showGenerateModal: action.open };
      if (action.modal === 'import') return { ...state, showImportModal: action.open };
      return { ...state, showGenerateModal: false, showImportModal: false };
    case 'TOGGLE_EXPAND':
      return { ...state, expandedKey: state.expandedKey === action.id ? null : action.id };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    default:
      return state;
  }
}

const initialState: State = {
  keys: [],
  isLoading: true,
  showGenerateModal: false,
  showImportModal: false,
  expandedKey: null,
  error: null,
};

// ============================================================================
// Hydration Safety
// ============================================================================

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

// ============================================================================
// Main Component
// ============================================================================

export const SSHKeyManager: React.FC<SSHKeyManagerProps> = ({
  onSelectKey,
  selectedKeyId,
  showActions = true,
}) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const isClient = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  const { keys, isLoading, showGenerateModal, showImportModal, expandedKey, error } = state;

  // Load keys on mount
  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    dispatch({ type: 'SET_LOADING', isLoading: true });
    try {
      // Demo data
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
      
      await new Promise(r => setTimeout(r, 500));
      dispatch({ type: 'SET_KEYS', keys: demoKeys });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: 'Failed to load SSH keys' });
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  };

  const handleGenerateKey = async (name: string, type: 'ed25519' | 'rsa' = 'ed25519') => {
    try {
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

      dispatch({ type: 'ADD_KEY', key: newKey });
      dispatch({ type: 'SET_MODAL', modal: 'generate', open: false });
      dispatch({ type: 'TOGGLE_EXPAND', id: newKey.id });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: 'Failed to generate SSH key' });
    }
  };

  const handleImportKey = async (name: string, publicKey: string, privateKey?: string) => {
    try {
      const newKey: SSHKey = {
        id: `key-${Date.now()}`,
        name,
        fingerprint: `SHA256:${Math.random().toString(36).substring(7)}`,
        publicKey,
        privateKey,
        createdAt: new Date().toISOString(),
        associatedInstances: [],
      };

      dispatch({ type: 'ADD_KEY', key: newKey });
      dispatch({ type: 'SET_MODAL', modal: 'import', open: false });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: 'Failed to import SSH key' });
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this SSH key? This action cannot be undone.')) {
      return;
    }

    try {
      dispatch({ type: 'DELETE_KEY', id: keyId });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: 'Failed to delete SSH key' });
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
  };

  if (isLoading) {
    return (
      <div className="ssh-key-manager loading">
        <div className="spinner" />
        <p>Loading SSH keys…</p>
      </div>
    );
  }

  return (
    <div className="ssh-key-manager">
      {error && (
        <div className="error-banner">
          <span>❌ {error}</span>
          <button onClick={() => dispatch({ type: 'SET_ERROR', error: null })}>Dismiss</button>
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
              onClick={() => dispatch({ type: 'SET_MODAL', modal: 'import', open: true })}
            >
              📥 Import Key
            </button>
            <button 
              className="btn-primary"
              onClick={() => dispatch({ type: 'SET_MODAL', modal: 'generate', open: true })}
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
            onClick={() => dispatch({ type: 'SET_MODAL', modal: 'generate', open: true })}
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
                    <span>Created {isClient ? new Date(key.createdAt).toLocaleDateString() : '...'}</span>
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
                      dispatch({ type: 'TOGGLE_EXPAND', id: key.id });
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
                        <code>{key.privateKey.substring(0, 100)}…</code>
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
          onClose={() => dispatch({ type: 'SET_MODAL', modal: 'generate', open: false })}
          onGenerate={handleGenerateKey}
        />
      )}

      {/* Import Key Modal */}
      {showImportModal && (
        <ImportKeyModal
          onClose={() => dispatch({ type: 'SET_MODAL', modal: 'import', open: false })}
          onImport={handleImportKey}
        />
      )}
    </div>
  );
};

// ============================================================================
// Helper Components
// ============================================================================

const GenerateKeyModal: React.FC<{
  onClose: () => void;
  onGenerate: (name: string, type: 'ed25519' | 'rsa') => void;
}> = ({ onClose, onGenerate }) => {
  const [name, setName] = React.useReducer('');
  const [type, setType] = React.useReducer<'ed25519' | 'rsa'>('ed25519');

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

const ImportKeyModal: React.FC<{
  onClose: () => void;
  onImport: (name: string, publicKey: string, privateKey?: string) => void;
}> = ({ onClose, onImport }) => {
  const [name, setName] = React.useReducer('');
  const [publicKey, setPublicKey] = React.useReducer('');
  const [privateKey, setPrivateKey] = React.useReducer('');
  const [includePrivate, setIncludePrivate] = React.useReducer(false);

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
            placeholder="ssh-ed25519 AAAAC3NzaC…"
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
