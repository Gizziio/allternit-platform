"use client";

/**
 * SSH Connection Manager - Comprehensive SSH Management
 * 
 * Features:
 * - SSH connection management (add, edit, delete, connect)
 * - SSH key management (generate, import, associate)
 * - Jump host / bastion support
 * - Connection health monitoring
 * - Quick connect favorites
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  ArrowClockwise,
  Warning,
  Key,
  HardDrives as Server,
  Trash,
  CheckCircle,
  XCircle,
  ComputerTower,
  Download,
  Upload,
  Copy,
  Eye,
  MagnifyingGlass,
  Star,
} from '@phosphor-icons/react';
import { TEXT, STATUS, SAND } from '@/design/allternit.tokens';
import { sshApi } from '@/api/infrastructure/ssh';
import { sshKeyApi, type SSHKey, type SSHKeyGenerateResult } from '@/api/infrastructure/ssh-keys';
import { runtimeBackendApi } from '@/api/infrastructure/runtime-backend';
import { VPSConnectionModal } from '@/components/vps';
import { type SSHConnection } from '@/components/ssh';
import type { SSHConnectionFormData, SSHConnectionTestResult } from '@/components/ssh';

// ============================================================================
// Types
// ============================================================================

interface SSHConnectionWithFavorites extends SSHConnection {
  isFavorite?: boolean;
  tags?: string[];
  group?: string;
}

// ============================================================================
// Components
// ============================================================================

/**
 * SSH Key Manager Panel
 */
function SSHKeyManagerPanel({
  onKeySelect,
  selectedKeyId,
}: {
  onKeySelect?: (key: SSHKey) => void;
  selectedKeyId?: string;
}) {
  const [keys, setKeys] = useState<SSHKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setShowPrivateKey] = useState<Record<string, boolean>>({});
  const [generatedKey, setGeneratedKey] = useState<SSHKeyGenerateResult | null>(null);

  // Load keys on mount
  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    setIsLoading(true);
    try {
      const data = await sshKeyApi.list();
      setKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SSH keys');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateKey = async (name: string, type: 'ed25519' | 'rsa' = 'ed25519') => {
    try {
      const result = await sshKeyApi.generate({ name, type });
      setGeneratedKey(result);
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate key');
    }
  };

  const handleImportKey = async (name: string, privateKey: string, passphrase?: string) => {
    try {
      await sshKeyApi.import({ name, private_key: privateKey, passphrase });
      await loadKeys();
      setShowImportModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import key');
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this SSH key?')) return;
    try {
      await sshKeyApi.delete(id);
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete key');
    }
  };

  const handleCopyPublicKey = (publicKey: string) => {
    navigator.clipboard.writeText(publicKey);
    // Could add toast notification here
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ui-text-primary)', margin: 0 }}>
          SSH Keys
        </h3>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowGenerateModal(true)}
          style={{
            padding: '8px 14px',
            borderRadius: '6px',
            border: 'none',
            background: SAND[500],
            color: 'var(--ui-text-inverse)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Key size={16} weight="bold" />
          Generate New
        </button>
        <button
          onClick={() => setShowImportModal(true)}
          style={{
            padding: '8px 14px',
            borderRadius: '6px',
            border: '1px solid var(--ui-border-default)',
            background: 'transparent',
            color: 'var(--ui-text-secondary)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Upload size={16} />
          Import
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'var(--status-error-bg)',
            border: '1px solid rgba(239,68,68,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: STATUS.error,
            fontSize: '13px',
          }}
        >
          <Warning size={18} weight="fill" />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: STATUS.error, cursor: 'pointer' }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Keys List */}
      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: TEXT.secondary }}>
          <ArrowClockwise size={24} className="animate-spin" style={{ marginBottom: '12px' }} />
          <p>Loading SSH keys...</p>
        </div>
      ) : keys.length === 0 ? (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            color: TEXT.secondary,
            background: 'var(--surface-hover)',
            borderRadius: '10px',
            border: '1px dashed var(--ui-border-default)',
          }}
        >
          <Key size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
          <p>No SSH keys found</p>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>
            Generate a new key pair or import an existing one
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {keys.map((key) => (
            <div
              key={key.id}
              style={{
                padding: '16px',
                borderRadius: '10px',
                background: selectedKeyId === key.id ? 'rgba(196,154,122,0.1)' : 'var(--surface-hover)',
                border: `1px solid ${selectedKeyId === key.id ? SAND[500] : 'var(--ui-border-muted)'}`,
                cursor: onKeySelect ? 'pointer' : 'default',
              }}
              onClick={() => onKeySelect?.(key)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Key size={20} color={SAND[500]} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ui-text-primary)' }}>
                    {key.name}
                  </div>
                  <div style={{ fontSize: '12px', color: TEXT.secondary, marginTop: '2px' }}>
                    Fingerprint: {key.fingerprint}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedKey(expandedKey === key.id ? null : key.id);
                  }}
                  style={{
                    padding: '6px',
                    borderRadius: '4px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--ui-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyPublicKey(key.public_key);
                  }}
                  style={{
                    padding: '6px',
                    borderRadius: '4px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--ui-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteKey(key.id);
                  }}
                  style={{
                    padding: '6px',
                    borderRadius: '4px',
                    border: 'none',
                    background: 'transparent',
                    color: STATUS.error,
                    cursor: 'pointer',
                  }}
                >
                  <Trash size={16} />
                </button>
              </div>

              {/* Expanded Details */}
              {expandedKey === key.id && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--ui-border-muted)' }}>
                  <div style={{ fontSize: '12px', color: TEXT.secondary, marginBottom: '6px' }}>
                    Public Key:
                  </div>
                  <code
                    style={{
                      display: 'block',
                      padding: '10px',
                      borderRadius: '6px',
                      background: 'var(--bg-tertiary)',
                      fontSize: '11px',
                      color: 'var(--ui-text-muted)',
                      wordBreak: 'break-all',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {key.public_key}
                  </code>
                  {key.last_used && (
                    <div style={{ fontSize: '11px', color: TEXT.secondary, marginTop: '8px' }}>
                      Last used: {new Date(key.last_used).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Generate Modal - Simplified */}
      {showGenerateModal && (
        <GenerateKeyModal
          onClose={() => {
            setShowGenerateModal(false);
            setGeneratedKey(null);
          }}
          onGenerate={handleGenerateKey}
          generatedKey={generatedKey}
        />
      )}

      {/* Import Modal - Simplified */}
      {showImportModal && (
        <ImportKeyModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImportKey}
        />
      )}
    </div>
  );
}

/**
 * Generate Key Modal
 */
function GenerateKeyModal({
  onClose,
  onGenerate,
  generatedKey,
}: {
  onClose: () => void;
  onGenerate: (name: string, type: 'ed25519' | 'rsa') => void;
  generatedKey: SSHKeyGenerateResult | null;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'ed25519' | 'rsa'>('ed25519');

  return (
    <Modal onClose={onClose} title="Generate SSH Key">
      {!generatedKey ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: TEXT.secondary, marginBottom: '6px' }}>
              Key Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production Server Key"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid var(--ui-border-default)',
                background: 'var(--bg-tertiary)',
                color: 'var(--ui-text-primary)',
                fontSize: '14px',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: TEXT.secondary, marginBottom: '6px' }}>
              Key Type
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setType('ed25519')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '6px',
                  border: `1px solid ${type === 'ed25519' ? SAND[500] : 'var(--ui-border-default)'}`,
                  background: type === 'ed25519' ? 'rgba(196,154,122,0.1)' : 'var(--surface-panel)',
                  color: type === 'ed25519' ? SAND[500] : 'var(--ui-text-muted)',
                  cursor: 'pointer',
                }}
              >
                ED25519 (Recommended)
              </button>
              <button
                onClick={() => setType('rsa')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '6px',
                  border: `1px solid ${type === 'rsa' ? SAND[500] : 'var(--ui-border-default)'}`,
                  background: type === 'rsa' ? 'rgba(196,154,122,0.1)' : 'var(--surface-panel)',
                  color: type === 'rsa' ? SAND[500] : 'var(--ui-text-muted)',
                  cursor: 'pointer',
                }}
              >
                RSA 4096
              </button>
            </div>
          </div>
          <button
            onClick={() => onGenerate(name, type)}
            disabled={!name.trim()}
            style={{
              marginTop: '8px',
              padding: '12px',
              borderRadius: '6px',
              border: 'none',
              background: SAND[500],
              color: 'var(--ui-text-inverse)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: name.trim() ? 'pointer' : 'not-allowed',
              opacity: name.trim() ? 1 : 0.5,
            }}
          >
            Generate Key Pair
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--status-success-bg)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={20} weight="fill" />
            Key generated successfully!
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: TEXT.secondary, marginBottom: '6px' }}>
              Public Key (safe to share)
            </label>
            <code style={{ display: 'block', padding: '10px', borderRadius: '6px', background: 'var(--bg-tertiary)', fontSize: '11px', color: 'var(--ui-text-muted)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
              {generatedKey.public_key}
            </code>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: TEXT.secondary, marginBottom: '6px' }}>
              Private Key (keep secret!)
            </label>
            <code style={{ display: 'block', padding: '10px', borderRadius: '6px', background: 'var(--status-error-bg)', fontSize: '11px', color: '#ff6b6b', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', border: '1px solid color-mix(in srgb, var(--status-error) 40%, transparent)' }}>
              {generatedKey.private_key}
            </code>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '12px',
              borderRadius: '6px',
              border: 'none',
              background: SAND[500],
              color: 'var(--ui-text-inverse)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}

/**
 * Import Key Modal
 */
function ImportKeyModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (name: string, privateKey: string, passphrase?: string) => void;
}) {
  const [name, setName] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');

  return (
    <Modal onClose={onClose} title="Import SSH Key">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', color: TEXT.secondary, marginBottom: '6px' }}>
            Key Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Personal Server Key"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid var(--ui-border-default)',
              background: 'var(--bg-tertiary)',
              color: 'var(--ui-text-primary)',
              fontSize: '14px',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '13px', color: TEXT.secondary, marginBottom: '6px' }}>
            Private Key (PEM format)
          </label>
          <textarea
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            rows={6}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid var(--ui-border-default)',
              background: 'var(--bg-tertiary)',
              color: 'var(--ui-text-primary)',
              fontSize: '13px',
              fontFamily: 'var(--font-mono)',
              resize: 'vertical',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '13px', color: TEXT.secondary, marginBottom: '6px' }}>
            Passphrase (optional)
          </label>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Leave empty if no passphrase"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid var(--ui-border-default)',
              background: 'var(--bg-tertiary)',
              color: 'var(--ui-text-primary)',
              fontSize: '14px',
            }}
          />
        </div>
        <button
          onClick={() => onImport(name, privateKey, passphrase || undefined)}
          disabled={!name.trim() || !privateKey.trim()}
          style={{
            marginTop: '8px',
            padding: '12px',
            borderRadius: '6px',
            border: 'none',
            background: SAND[500],
            color: 'var(--ui-text-inverse)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: name.trim() && privateKey.trim() ? 'pointer' : 'not-allowed',
            opacity: name.trim() && privateKey.trim() ? 1 : 0.5,
          }}
        >
          Import Key
        </button>
      </div>
    </Modal>
  );
}

/**
 * Modal Component
 */
function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--shell-overlay-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface-panel)',
          borderRadius: '12px',
          border: '1px solid var(--ui-border-default)',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--ui-border-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ui-text-primary)', margin: 0 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              padding: '4px',
              borderRadius: '4px',
              border: 'none',
              background: 'transparent',
              color: 'var(--ui-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <XCircle size={20} />
          </button>
        </div>
        <div style={{ padding: '20px' }}>{children}</div>
      </div>
    </div>
  );
}

// ============================================================================
// Main SSH Connection Manager
// ============================================================================

export function SSHConnectionManager() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'connections' | 'keys'>('connections');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connections, setConnections] = useState<SSHConnectionWithFavorites[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKeyId, setSelectedKeyId] = useState<string>();

  // Load connections from API
  const loadConnections = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await sshApi.getConnections();
      // Merge with local favorites data
      const storedFavorites = localStorage.getItem('ssh-favorites');
      const favorites: Record<string, { isFavorite: boolean; tags: string[] }> = storedFavorites
        ? JSON.parse(storedFavorites)
        : {};
      
      setConnections(
        data.map((conn) => ({
          ...conn,
          isFavorite: favorites[conn.id]?.isFavorite || false,
          tags: favorites[conn.id]?.tags || [],
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connections');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // Toggle favorite
  const toggleFavorite = useCallback((id: string) => {
    setConnections((prev) => {
      const updated = prev.map((conn) =>
        conn.id === id ? { ...conn, isFavorite: !conn.isFavorite } : conn
      );
      // Persist favorites
      const favorites = updated.reduce((acc, conn) => {
        acc[conn.id] = { isFavorite: conn.isFavorite || false, tags: conn.tags || [] };
        return acc;
      }, {} as Record<string, { isFavorite: boolean; tags: string[] }>);
      localStorage.setItem('ssh-favorites', JSON.stringify(favorites));
      return updated;
    });
  }, []);

  // Filter connections
  const filteredConnections = useMemo(() => {
    if (!searchQuery.trim()) return connections;
    const query = searchQuery.toLowerCase();
    return connections.filter(
      (conn) =>
        conn.name.toLowerCase().includes(query) ||
        conn.host.toLowerCase().includes(query) ||
        conn.username.toLowerCase().includes(query) ||
        conn.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [connections, searchQuery]);

  // Sort by favorite first, then by name
  const sortedConnections = useMemo(() => {
    return [...filteredConnections].sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredConnections]);

  // Test connection
  const handleTestConnection = useCallback(async (
    data: SSHConnectionFormData
  ): Promise<SSHConnectionTestResult> => {
    return sshApi.testConnection(data);
  }, []);

  // Add new connection
  const handleConnectExisting = useCallback(async (data: SSHConnectionFormData) => {
    try {
      const newConnection = await sshApi.createConnection({
        name: data.name,
        host: data.host,
        port: data.port,
        username: data.username,
        authType: data.authType,
        privateKey: data.privateKey,
        password: data.password,
      });

      setConnections((prev) => [
        ...prev,
        { ...newConnection, isFavorite: false, tags: [] },
      ]);

      // Auto-connect
      handleConnect(newConnection.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add connection');
    }
  }, []);

  // Connect
  const handleConnect = useCallback(async (id: string) => {
    setConnections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'connecting' as const } : c))
    );

    try {
      const result = await sshApi.connect(id);

      if (result.success) {
        setConnections((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status: 'connected' as const,
                  os: result.os,
                  architecture: result.architecture,
                  dockerInstalled: result.dockerInstalled,
                  allternitInstalled: result.allternitInstalled,
                  lastConnected: new Date().toISOString(),
                }
              : c
          )
        );

        if (!result.allternitInstalled) {
          await sshApi.installAgent(id);
          await loadConnections();
        }

        try {
          await runtimeBackendApi.activateSSHConnection(id);
        } catch (activationError) {
          setError(
            activationError instanceof Error
              ? activationError.message
              : 'Connected, but the remote backend is not reachable yet'
          );
        }
      } else {
        setConnections((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status: 'error' as const,
                  errorMessage: result.error || 'Connection failed',
                }
              : c
          )
        );
      }
    } catch (err) {
      setConnections((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                status: 'error' as const,
                errorMessage: err instanceof Error ? err.message : 'Connection failed',
              }
            : c
        )
      );
    }
  }, [loadConnections]);

  // Disconnect
  const handleDisconnect = useCallback(async (id: string) => {
    try {
      await sshApi.disconnect(id);
      const runtimeBackend = await runtimeBackendApi.get().catch(() => null);
      if (runtimeBackend?.active_backend?.ssh_connection_id === id) {
        await runtimeBackendApi.activateLocal();
      }
      setConnections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'disconnected' as const } : c))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }, []);

  // Delete
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;
    try {
      await sshApi.deleteConnection(id);
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete connection');
    }
  }, []);

  // Test
  const handleTest = useCallback(async (id: string) => {
    const connection = connections.find((c) => c.id === id);
    if (!connection) return;

    try {
      const result = await sshApi.testConnection({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        authType: 'key',
      });

      if (result.success) {
        setConnections((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  os: result.details?.os,
                  architecture: result.details?.architecture,
                  dockerInstalled: result.details?.dockerInstalled,
                  allternitInstalled: result.details?.allternitInstalled,
                }
              : c
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed');
    }
  }, [connections]);

  return (
    <div style={{ maxWidth: '1000px' }}>
      {/* Header */}
      <div
        style={{
          marginBottom: '24px',
          padding: '24px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(37,37,37,0.6) 0%, rgba(37,37,37,0.3) 100%)',
          border: '1px solid var(--ui-border-muted)',
        }}
      >
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--ui-text-primary)',
            margin: '0 0 8px 0',
            letterSpacing: '-0.3px',
          }}
        >
          SSH Connection Manager
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: TEXT.secondary,
            margin: 0,
            lineHeight: '1.5',
          }}
        >
          Manage SSH connections to remote servers, VPS instances, and cloud environments.
          Save connection profiles, manage SSH keys, and quickly connect to your infrastructure.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '20px',
          padding: '4px',
          borderRadius: '10px',
          background: 'var(--surface-hover)',
          border: '1px solid var(--ui-border-muted)',
          width: 'fit-content',
        }}
      >
        <button
          onClick={() => setActiveTab('connections')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'connections' ? SAND[500] : 'transparent',
            color: activeTab === 'connections' ? 'var(--ui-text-inverse)' : 'var(--ui-text-muted)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'var(--transition-fast)',
          }}
        >
          <Server size={18} />
          Connections
        </button>
        <button
          onClick={() => setActiveTab('keys')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'keys' ? SAND[500] : 'transparent',
            color: activeTab === 'keys' ? 'var(--ui-text-inverse)' : 'var(--ui-text-muted)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'var(--transition-fast)',
          }}
        >
          <Key size={18} />
          SSH Keys
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div
          style={{
            marginBottom: '20px',
            padding: '14px 18px',
            borderRadius: '10px',
            background: 'var(--status-error-bg)',
            border: '1px solid rgba(239,68,68,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: STATUS.error,
            fontSize: '13px',
          }}
        >
          <Warning size={18} weight="fill" />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: 'none',
              background: 'rgba(239,68,68,0.15)',
              color: STATUS.error,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Connections Tab */}
      {activeTab === 'connections' && (
        <>
          {/* Action Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '24px',
              padding: '16px 20px',
              borderRadius: '10px',
              background: 'rgba(37,37,37,0.4)',
              border: '1px solid var(--ui-border-muted)',
            }}
          >
            <button
              onClick={() => setIsModalOpen(true)}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                background: SAND[500],
                color: 'var(--ui-text-inverse)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'var(--transition-fast)',
                boxShadow: '0 2px 8px rgba(196,154,122,0.25)',
              }}
            >
              <Plus size={18} weight="bold" />
              Add Connection
            </button>

            <div style={{ flex: 1 }} />

            {/* Search */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <MagnifyingGlass
                size={16}
                style={{ position: 'absolute', left: '12px', color: 'var(--ui-text-muted)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search connections..."
                style={{
                  padding: '8px 12px 8px 36px',
                  borderRadius: '6px',
                  border: '1px solid var(--ui-border-default)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--ui-text-primary)',
                  fontSize: '13px',
                  width: '200px',
                }}
              />
            </div>

            <button
              onClick={loadConnections}
              disabled={isLoading}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid var(--ui-border-default)',
                background: 'transparent',
                color: 'var(--ui-text-secondary)',
                fontSize: '13px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : undefined} />
              Refresh
            </button>
          </div>

          {/* Quick Stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
              marginBottom: '24px',
            }}
          >
            <StatCard
              label="Total Connections"
              value={connections.length}
              icon={Server}
            />
            <StatCard
              label="Connected"
              value={connections.filter((c) => c.status === 'connected').length}
              icon={CheckCircle}
              color="var(--status-success)"
            />
            <StatCard
              label="Favorites"
              value={connections.filter((c) => c.isFavorite).length}
              icon={Star}
              color={SAND[500]}
            />
          </div>

          {/* Connections List */}
          <EnhancedSSHConnectionsList
            connections={sortedConnections}
            onAddConnection={() => setIsModalOpen(true)}
            onDeleteConnection={handleDelete}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onTestConnection={handleTest}
            onToggleFavorite={toggleFavorite}
            isLoading={isLoading}
          />
        </>
      )}

      {/* Keys Tab */}
      {activeTab === 'keys' && (
        <div
          style={{
            padding: '20px',
            borderRadius: '10px',
            background: 'rgba(37,37,37,0.4)',
            border: '1px solid var(--ui-border-muted)',
          }}
        >
          <SSHKeyManagerPanel
            onKeySelect={(key) => setSelectedKeyId(key.id)}
            selectedKeyId={selectedKeyId}
          />
        </div>
      )}

      {/* Connection Modal */}
      <VPSConnectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConnectExisting={handleConnectExisting}
        onTestConnection={handleTestConnection}
        onSelectProvider={(providerId) => {
          router.push(`/cloud-deploy?provider=${providerId}`);
        }}
      />
    </div>
  );
}

/**
 * Stat Card Component
 */
function StatCard({
  label,
  value,
  icon: Icon,
  color = 'var(--ui-text-muted)',
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '10px',
        background: 'rgba(37,37,37,0.4)',
        border: '1px solid var(--ui-border-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: `${color}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '12px', color: TEXT.secondary }}>{label}</div>
        <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ui-text-primary)' }}>{value}</div>
      </div>
    </div>
  );
}

/**
 * Enhanced SSH Connections List with favorites
 */
function EnhancedSSHConnectionsList({
  connections,
  onAddConnection,
  onDeleteConnection,
  onConnect,
  onDisconnect,
  onTestConnection,
  onToggleFavorite,
  isLoading,
}: {
  connections: SSHConnectionWithFavorites[];
  onAddConnection: () => void;
  onDeleteConnection: (id: string) => void;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  onTestConnection: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: TEXT.secondary }}>
        <ArrowClockwise size={32} className="animate-spin" style={{ marginBottom: '16px' }} />
        <p>Loading connections...</p>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div
        style={{
          padding: '60px',
          textAlign: 'center',
          color: TEXT.secondary,
          background: 'var(--surface-hover)',
          borderRadius: '12px',
          border: '1px dashed var(--ui-border-default)',
        }}
      >
        <ComputerTower size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
        <h3 style={{ fontSize: '18px', fontWeight: 500, color: 'var(--ui-text-primary)', margin: '0 0 8px 0' }}>
          No SSH Connections
        </h3>
        <p style={{ fontSize: '14px', margin: '0 0 20px 0' }}>
          Add your first SSH connection to manage remote servers
        </p>
        <button
          onClick={onAddConnection}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: SAND[500],
            color: 'var(--ui-text-inverse)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Plus size={18} weight="bold" style={{ marginRight: '6px' }} />
          Add Connection
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {connections.map((connection) => (
        <div
          key={connection.id}
          style={{
            padding: '16px 20px',
            borderRadius: '10px',
            background: connection.status === 'connected' ? 'rgba(34,197,94,0.05)' : 'var(--surface-hover)',
            border: `1px solid ${
              connection.status === 'connected'
                ? 'rgba(34,197,94,0.2)'
                : connection.status === 'error'
                ? 'rgba(239,68,68,0.2)'
                : 'var(--ui-border-muted)'
            }`,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            transition: 'var(--transition-fast)',
          }}
        >
          {/* Favorite Star */}
          <button
            onClick={() => onToggleFavorite(connection.id)}
            style={{
              padding: '4px',
              borderRadius: '4px',
              border: 'none',
              background: 'transparent',
              color: connection.isFavorite ? SAND[500] : '#444',
              cursor: 'pointer',
            }}
          >
            {connection.isFavorite ? <Star size={18} weight="fill" /> : <Star size={18} />}
          </button>

          {/* Status Icon */}
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background:
                connection.status === 'connected'
                  ? 'var(--status-success)'
                  : connection.status === 'connecting'
                  ? 'var(--status-warning)'
                  : connection.status === 'error'
                  ? 'var(--status-error)'
                  : 'var(--ui-text-muted)',
              animation: connection.status === 'connecting' ? 'pulse 1.5s infinite' : undefined,
            }}
          />

          {/* Connection Info */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ui-text-primary)' }}>
                {connection.name}
              </span>
              {connection.tags?.map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(196,154,122,0.2)',
                    color: SAND[500],
                    fontSize: '10px',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <div style={{ fontSize: '12px', color: TEXT.secondary, marginTop: '2px' }}>
              {connection.username}@{connection.host}:{connection.port}
              {connection.os && ` • ${connection.os}`}
              {connection.architecture && ` (${connection.architecture})`}
            </div>
            {connection.errorMessage && (
              <div style={{ fontSize: '11px', color: STATUS.error, marginTop: '4px' }}>
                {connection.errorMessage}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {connection.status === 'connected' ? (
              <button
                onClick={() => onDisconnect(connection.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--ui-border-default)',
                  background: 'transparent',
                  color: 'var(--ui-text-secondary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Disconnect
              </button>
            ) : connection.status === 'connecting' ? (
              <span style={{ fontSize: '12px', color: 'var(--status-warning)' }}>Connecting...</span>
            ) : (
              <button
                onClick={() => onConnect(connection.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'var(--status-success-bg)',
                  color: 'var(--status-success)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Connect
              </button>
            )}

            <button
              onClick={() => onTestConnection(connection.id)}
              style={{
                padding: '6px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                color: 'var(--ui-text-muted)',
                cursor: 'pointer',
              }}
              title="Test Connection"
            >
              <ArrowClockwise size={16} />
            </button>

            <button
              onClick={() => onDeleteConnection(connection.id)}
              style={{
                padding: '6px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                color: STATUS.error,
                cursor: 'pointer',
              }}
              title="Delete"
            >
              <Trash size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default SSHConnectionManager;
