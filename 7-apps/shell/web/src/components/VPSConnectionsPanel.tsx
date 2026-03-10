import React, { useState, useCallback, useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Server,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Key,
  Link,
  Zap,
  Shield,
  Clock,
  Lock,
  User,
  Globe,
  ExternalLink,
  ChevronDown,
  Loader2,
  Terminal,
  Cpu,
  HardDrive,
  AlertCircle,
  ShoppingCart
} from 'lucide-react';
import { GlassCard, GlassSurface } from '@a2r/platform';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type VPSAuthType = 'password' | 'key';
export type VPSStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

export interface VPSConnection {
  id: string;
  name: string;
  host: string; // IP or hostname, NOT URL
  port: number; // default 22
  username: string; // e.g., "root", "ubuntu"
  authType: VPSAuthType;
  authCredential: string; // password or SSH key ID
  sshKeyId?: string; // reference to stored SSH key
  status: VPSStatus;
  os?: string;
  cpu?: string;
  memory?: string;
  lastConnected?: string;
  lastError?: string;
}

export interface SSHKey {
  id: string;
  name: string;
  publicKey: string;
  fingerprint: string;
  type: 'ed25519' | 'rsa';
  createdAt: string;
}

interface VPSStore {
  connections: VPSConnection[];
  activeConnection: VPSConnection | null;
  sshKeys: SSHKey[];
  addConnection: (conn: Omit<VPSConnection, 'id'>) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (conn: VPSConnection | null) => void;
  updateConnectionStatus: (id: string, status: VPSStatus, error?: string) => void;
  addSSHKey: (key: Omit<SSHKey, 'id'>) => void;
  removeSSHKey: (id: string) => void;
  testConnection: (conn: VPSConnection) => Promise<boolean>;
}

// ============================================================================
// VPS Provider Marketplace Data
// ============================================================================

interface VPSProvider {
  id: string;
  name: string;
  initial: string;
  color: string;
  startingPrice: string;
  location: string;
  features: string[];
  signupUrl: string;
}

const VPS_PROVIDERS: VPSProvider[] = [
  {
    id: 'hetzner',
    name: 'Hetzner',
    initial: 'H',
    color: '#D50C2D',
    startingPrice: '€4.51/month',
    location: 'German cloud',
    features: ['NVMe SSD storage', 'Unlimited traffic', 'DDoS protection', 'ISO 27001 certified'],
    signupUrl: 'https://www.hetzner.com/cloud/'
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    initial: 'D',
    color: '#0069FF',
    startingPrice: '$6/month',
    location: 'Developer friendly',
    features: ['Simple API', 'One-click apps', 'Global data centers', '99.99% uptime SLA'],
    signupUrl: 'https://www.digitalocean.com/products/droplets'
  },
  {
    id: 'aws',
    name: 'AWS',
    initial: 'A',
    color: '#FF9900',
    startingPrice: '$7.59/month',
    location: 'Enterprise',
    features: ['EC2 t3.micro', '750 hours free tier', 'Global infrastructure', 'Enterprise security'],
    signupUrl: 'https://aws.amazon.com/ec2/'
  },
  {
    id: 'contabo',
    name: 'Contabo',
    initial: 'C',
    color: '#00A4E0',
    startingPrice: '€5.50/month',
    location: 'Budget',
    features: ['Generous resources', 'No setup fee', 'DDoS protection', 'German quality'],
    signupUrl: 'https://contabo.com/en/vps/'
  },
  {
    id: 'racknerd',
    name: 'RackNerd',
    initial: 'R',
    color: '#6B46C1',
    startingPrice: '$10.98/year',
    location: 'Promotional',
    features: ['Low yearly pricing', 'Multiple locations', 'KVM virtualization', 'Instant setup'],
    signupUrl: 'https://www.racknerd.com/kvm-vps'
  }
];

// ============================================================================
// Store
// ============================================================================

const useVPSStore = create<VPSStore>()(
  persist(
    (set, get) => ({
      connections: [],
      activeConnection: null,
      sshKeys: [],

      addConnection: (conn) => {
        const newConn: VPSConnection = {
          ...conn,
          id: crypto.randomUUID()
        };
        set((state) => ({
          connections: [...state.connections, newConn]
        }));
      },

      removeConnection: (id) => {
        set((state) => ({
          connections: state.connections.filter((c) => c.id !== id),
          activeConnection:
            state.activeConnection?.id === id ? null : state.activeConnection
        }));
      },

      setActiveConnection: (conn) => {
        set({ activeConnection: conn });
        if (conn) {
          sessionStorage.setItem('a2r-active-vps', JSON.stringify(conn));
        } else {
          sessionStorage.removeItem('a2r-active-vps');
        }
      },

      updateConnectionStatus: (id, status, error) => {
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status,
                  lastError: error,
                  lastConnected:
                    status === 'connected' ? new Date().toISOString() : c.lastConnected
                }
              : c
          )
        }));
      },

      addSSHKey: (key) => {
        const newKey: SSHKey = {
          ...key,
          id: crypto.randomUUID()
        };
        set((state) => ({
          sshKeys: [...state.sshKeys, newKey]
        }));
      },

      removeSSHKey: (id) => {
        set((state) => ({
          sshKeys: state.sshKeys.filter((k) => k.id !== id)
        }));
      },

      testConnection: async (conn) => {
        // Simulate SSH connection test
        // In production, this would call an API endpoint that attempts SSH connection
        return new Promise((resolve) => {
          setTimeout(() => {
            // Simulate 80% success rate for demo
            resolve(Math.random() > 0.2);
          }, 1500);
        });
      }
    }),
    {
      name: 'a2r-vps-connections-v2',
      partialize: (state) => ({ connections: state.connections, sshKeys: state.sshKeys })
    }
  )
);

// ============================================================================
// Validation Utilities
// ============================================================================

const isValidIP = (host: string): boolean => {
  // IPv4 validation
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  // IPv6 validation (simplified)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(host) || ipv6Regex.test(host);
};

const isValidHostname = (host: string): boolean => {
  // Hostname validation (RFC 1123)
  const hostnameRegex =
    /^(?!-)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.(?!-)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return hostnameRegex.test(host);
};

const validateHost = (host: string): { valid: boolean; error?: string } => {
  if (!host.trim()) {
    return { valid: false, error: 'Host is required' };
  }

  // Reject URLs
  if (/^https?:\/\//.test(host)) {
    return {
      valid: false,
      error: 'Enter IP or hostname only, not a URL (remove http:// or https://)'
    };
  }

  // Remove port if included
  const hostWithoutPort = host.split(':')[0];

  if (isValidIP(hostWithoutPort)) {
    return { valid: true };
  }

  if (isValidHostname(hostWithoutPort)) {
    return { valid: true };
  }

  return { valid: false, error: 'Enter a valid IP address or hostname' };
};

// ============================================================================
// Marketplace Modal Component
// ============================================================================

interface MarketplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MarketplaceModal: React.FC<MarketplaceModalProps> = ({ isOpen, onClose }) => {
  const darkTheme = {
    bg: '#1a1a1a',
    bgSecondary: '#242424',
    bgTertiary: '#2a2a2a',
    border: '#333333',
    borderStrong: '#404040',
    textPrimary: '#e5e5e5',
    textSecondary: '#a3a3a3',
    textTertiary: '#737373',
    accent: '#d4b08c',
    accentHover: '#c4a07c'
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px'
      }}
      onClick={onClose}
    >
      <GlassCard
        elevation="raised"
        blur="lg"
        padding="lg"
        rounded="xl"
        style={{
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          background: darkTheme.bgSecondary
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            paddingBottom: '16px',
            borderBottom: `1px solid ${darkTheme.border}`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: `rgba(212, 176, 140, 0.15)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ShoppingCart style={{ width: '22px', height: '22px', color: darkTheme.accent }} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: darkTheme.textPrimary,
                  margin: 0,
                  letterSpacing: '-0.02em'
                }}
              >
                Browse VPS Providers
              </h2>
              <p
                style={{
                  fontSize: '13px',
                  color: darkTheme.textTertiary,
                  margin: '4px 0 0 0'
                }}
              >
                Compare and choose a cloud provider for your AI agents
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: darkTheme.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <XCircle style={{ width: '24px', height: '24px' }} />
          </button>
        </div>

        {/* Provider Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '16px'
          }}
        >
          {VPS_PROVIDERS.map((provider) => (
            <div
              key={provider.id}
              style={{
                background: darkTheme.bg,
                border: `1px solid ${darkTheme.border}`,
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'all 0.2s ease'
              }}
            >
              {/* Provider Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: provider.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#fff'
                  }}
                >
                  {provider.initial}
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: '600',
                      color: darkTheme.textPrimary,
                      margin: 0
                    }}
                  >
                    {provider.name}
                  </h3>
                  <p
                    style={{
                      fontSize: '12px',
                      color: darkTheme.textTertiary,
                      margin: '2px 0 0 0'
                    }}
                  >
                    {provider.location}
                  </p>
                </div>
              </div>

              {/* Price */}
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: darkTheme.accent,
                  marginTop: '4px'
                }}
              >
                {provider.startingPrice}
              </div>

              {/* Features */}
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '0 0 auto 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                {provider.features.map((feature, idx) => (
                  <li
                    key={idx}
                    style={{
                      fontSize: '12px',
                      color: darkTheme.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <CheckCircle style={{ width: '12px', height: '12px', color: darkTheme.accent, flexShrink: 0 }} />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Get Started Button */}
              <a
                href={provider.signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  background: darkTheme.accent,
                  border: 'none',
                  borderRadius: '8px',
                  color: '#1a1a1a',
                  fontSize: '13px',
                  fontWeight: '600',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  marginTop: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = darkTheme.accentHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = darkTheme.accent;
                }}
              >
                Get Started
                <ExternalLink style={{ width: '14px', height: '14px' }} />
              </a>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div
          style={{
            marginTop: '20px',
            padding: '16px',
            background: 'rgba(212, 176, 140, 0.08)',
            borderRadius: '8px',
            border: `1px solid rgba(212, 176, 140, 0.2)`
          }}
        >
          <p
            style={{
              fontSize: '12px',
              color: darkTheme.textSecondary,
              margin: 0,
              textAlign: 'center'
            }}
          >
            Prices shown are starting prices for basic VPS plans and may vary by region.
            Click "Get Started" to see current pricing and available configurations.
          </p>
        </div>
      </GlassCard>
    </div>
  );
};

// ============================================================================
// SSH Key Manager Modal Component
// ============================================================================

interface SSHKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyAdded: (key: SSHKey) => void;
}

const SSHKeyModal: React.FC<SSHKeyModalProps> = ({ isOpen, onClose, onKeyAdded }) => {
  const { sshKeys, addSSHKey, removeSSHKey } = useVPSStore();
  const [activeTab, setActiveTab] = useState<'list' | 'generate' | 'import'>('list');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyType, setNewKeyType] = useState<'ed25519' | 'rsa'>('ed25519');
  const [importKeyContent, setImportKeyContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const darkTheme = {
    bg: '#1a1a1a',
    bgSecondary: '#242424',
    bgTertiary: '#2a2a2a',
    border: '#333333',
    borderStrong: '#404040',
    textPrimary: '#e5e5e5',
    textSecondary: '#a3a3a3',
    textTertiary: '#737373',
    accent: '#d4b08c',
    accentHover: '#c4a07c',
    success: '#34c759',
    error: '#ef4444'
  };

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!newKeyName.trim()) return;
    setIsGenerating(true);

    // Simulate key generation
    setTimeout(() => {
      const mockKey: SSHKey = {
        id: crypto.randomUUID(),
        name: newKeyName.trim(),
        publicKey: `ssh-${newKeyType} AAAAC3NzaC1lZDI1NTE5AAAAID...`,
        fingerprint: `SHA256:${Math.random().toString(36).substring(2, 15)}`,
        type: newKeyType,
        createdAt: new Date().toISOString()
      };
      addSSHKey(mockKey);
      onKeyAdded(mockKey);
      setNewKeyName('');
      setIsGenerating(false);
      setActiveTab('list');
    }, 1500);
  };

  const handleImport = () => {
    if (!newKeyName.trim() || !importKeyContent.trim()) return;

    // Basic validation
    const isValidKey =
      importKeyContent.includes('BEGIN OPENSSH PRIVATE KEY') ||
      importKeyContent.includes('BEGIN RSA PRIVATE KEY') ||
      importKeyContent.includes('ssh-ed25519') ||
      importKeyContent.includes('ssh-rsa');

    if (!isValidKey) {
      alert('Invalid SSH key format');
      return;
    }

    const mockKey: SSHKey = {
      id: crypto.randomUUID(),
      name: newKeyName.trim(),
      publicKey: importKeyContent.includes('ssh-')
        ? importKeyContent.split('\n')[0]
        : `ssh-${newKeyType} AAAAC3NzaC1lZDI1NTE5AAAAID... (imported)`,
      fingerprint: `SHA256:${Math.random().toString(36).substring(2, 15)}`,
      type: importKeyContent.includes('ssh-rsa') ? 'rsa' : 'ed25519',
      createdAt: new Date().toISOString()
    };
    addSSHKey(mockKey);
    onKeyAdded(mockKey);
    setNewKeyName('');
    setImportKeyContent('');
    setActiveTab('list');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
        padding: '24px'
      }}
      onClick={onClose}
    >
      <GlassCard
        elevation="raised"
        blur="lg"
        padding="lg"
        rounded="xl"
        style={{
          maxWidth: '600px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
          background: darkTheme.bgSecondary
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Key style={{ width: '22px', height: '22px', color: darkTheme.accent }} />
            <h2
              style={{
                fontSize: '18px',
                fontWeight: '600',
                color: darkTheme.textPrimary,
                margin: 0
              }}
            >
              SSH Key Manager
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: darkTheme.textSecondary,
              cursor: 'pointer'
            }}
          >
            <XCircle style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
            padding: '4px',
            background: darkTheme.bg,
            borderRadius: '8px'
          }}
        >
          {(['list', 'generate', 'import'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: activeTab === tab ? darkTheme.bgSecondary : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: activeTab === tab ? darkTheme.accent : darkTheme.textSecondary,
                fontSize: '13px',
                fontWeight: activeTab === tab ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} Keys
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sshKeys.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: darkTheme.textTertiary
                }}
              >
                <Key style={{ width: '40px', height: '40px', margin: '0 auto 16px', opacity: 0.5 }} />
                <p style={{ fontSize: '14px', margin: 0 }}>No SSH keys stored</p>
                <p style={{ fontSize: '12px', margin: '8px 0 0 0' }}>
                  Generate or import a key to get started
                </p>
              </div>
            ) : (
              sshKeys.map((key) => (
                <div
                  key={key.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    background: darkTheme.bg,
                    borderRadius: '10px',
                    border: `1px solid ${darkTheme.border}`
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'rgba(212, 176, 140, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Key style={{ width: '20px', height: '20px', color: darkTheme.accent }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: darkTheme.textPrimary,
                        margin: 0
                      }}
                    >
                      {key.name}
                    </p>
                    <p
                      style={{
                        fontSize: '11px',
                        color: darkTheme.textTertiary,
                        margin: '4px 0 0 0',
                        fontFamily: 'monospace'
                      }}
                    >
                      {key.fingerprint}
                    </p>
                  </div>
                  <button
                    onClick={() => removeSSHKey(key.id)}
                    style={{
                      padding: '8px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: darkTheme.error,
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 style={{ width: '16px', height: '16px' }} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'generate' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: darkTheme.textSecondary,
                  marginBottom: '8px'
                }}
              >
                Key Name
              </label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="My VPS Key"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: darkTheme.bg,
                  border: `1px solid ${darkTheme.border}`,
                  borderRadius: '8px',
                  color: darkTheme.textPrimary,
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: darkTheme.textSecondary,
                  marginBottom: '8px'
                }}
              >
                Key Type
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {(['ed25519', 'rsa'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setNewKeyType(type)}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      background:
                        newKeyType === type
                          ? 'rgba(212, 176, 140, 0.15)'
                          : darkTheme.bg,
                      border: `1px solid ${newKeyType === type ? darkTheme.accent : darkTheme.border}`,
                      borderRadius: '8px',
                      color: newKeyType === type ? darkTheme.accent : darkTheme.textSecondary,
                      fontSize: '13px',
                      fontWeight: newKeyType === type ? '600' : '500',
                      cursor: 'pointer'
                    }}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={!newKeyName.trim() || isGenerating}
              style={{
                padding: '14px 24px',
                background: darkTheme.accent,
                border: 'none',
                borderRadius: '8px',
                color: '#1a1a1a',
                fontSize: '14px',
                fontWeight: '600',
                cursor: !newKeyName.trim() || isGenerating ? 'not-allowed' : 'pointer',
                opacity: !newKeyName.trim() || isGenerating ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '8px'
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                  Generating...
                </>
              ) : (
                <>
                  <Key style={{ width: '16px', height: '16px' }} />
                  Generate Key Pair
                </>
              )}
            </button>
          </div>
        )}

        {activeTab === 'import' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: darkTheme.textSecondary,
                  marginBottom: '8px'
                }}
              >
                Key Name
              </label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Imported Key"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: darkTheme.bg,
                  border: `1px solid ${darkTheme.border}`,
                  borderRadius: '8px',
                  color: darkTheme.textPrimary,
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: darkTheme.textSecondary,
                  marginBottom: '8px'
                }}
              >
                Private Key Content
              </label>
              <textarea
                value={importKeyContent}
                onChange={(e) => setImportKeyContent(e.target.value)}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                style={{
                  width: '100%',
                  height: '150px',
                  padding: '12px 14px',
                  background: darkTheme.bg,
                  border: `1px solid ${darkTheme.border}`,
                  borderRadius: '8px',
                  color: darkTheme.textPrimary,
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
              />
            </div>
            <button
              onClick={handleImport}
              disabled={!newKeyName.trim() || !importKeyContent.trim()}
              style={{
                padding: '14px 24px',
                background: darkTheme.accent,
                border: 'none',
                borderRadius: '8px',
                color: '#1a1a1a',
                fontSize: '14px',
                fontWeight: '600',
                cursor:
                  !newKeyName.trim() || !importKeyContent.trim() ? 'not-allowed' : 'pointer',
                opacity: !newKeyName.trim() || !importKeyContent.trim() ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '8px'
              }}
            >
              <Key style={{ width: '16px', height: '16px' }} />
              Import Key
            </button>
          </div>
        )}
      </GlassCard>
    </div>
  );
};

// ============================================================================
// Main VPS Connections Panel Component
// ============================================================================

export const VPSConnectionsPanel: React.FC = () => {
  const {
    connections,
    sshKeys,
    addConnection,
    removeConnection,
    testConnection,
    updateConnectionStatus
  } = useVPSStore();
  const [isAddingConnection, setIsAddingConnection] = useState(false);
  const [isMarketplaceOpen, setIsMarketplaceOpen] = useState(false);
  const [isSSHKeyModalOpen, setIsSSHKeyModalOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; timestamp: number; message?: string }>
  >({});
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [newConnection, setNewConnection] = useState({
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'key' as VPSAuthType,
    authCredential: '',
    sshKeyId: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Dark theme colors
  const darkTheme = {
    bg: '#1a1a1a',
    bgSecondary: '#242424',
    bgTertiary: '#2a2a2a',
    border: '#333333',
    borderStrong: '#404040',
    textPrimary: '#e5e5e5',
    textSecondary: '#a3a3a3',
    textTertiary: '#737373',
    accent: '#d4b08c',
    accentHover: '#c4a07c',
    success: '#34c759',
    error: '#ef4444',
    warning: '#f59e0b'
  };

  // Common usernames for suggestions
  const commonUsernames = ['root', 'ubuntu', 'admin', 'debian', 'ec2-user', 'centos'];

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!newConnection.name.trim()) {
      errors.name = 'Connection name is required';
    }

    const hostValidation = validateHost(newConnection.host);
    if (!hostValidation.valid) {
      errors.host = hostValidation.error || 'Invalid host';
    }

    if (!newConnection.port || newConnection.port < 1 || newConnection.port > 65535) {
      errors.port = 'Port must be between 1 and 65535';
    }

    if (!newConnection.username.trim()) {
      errors.username = 'Username is required';
    }

    if (newConnection.authType === 'password' && !newConnection.authCredential.trim()) {
      errors.authCredential = 'Password is required';
    }

    if (newConnection.authType === 'key' && !newConnection.sshKeyId) {
      errors.sshKeyId = 'Please select an SSH key';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [newConnection]);

  const handleAddConnection = useCallback(() => {
    if (!validateForm()) {
      // Mark all fields as touched to show errors
      setTouched({
        name: true,
        host: true,
        port: true,
        username: true,
        authCredential: true,
        sshKeyId: true
      });
      return;
    }

    try {
      const connection: Omit<VPSConnection, 'id'> = {
        name: newConnection.name.trim(),
        host: newConnection.host.trim(),
        port: newConnection.port,
        username: newConnection.username.trim(),
        authType: newConnection.authType,
        authCredential:
          newConnection.authType === 'password'
            ? newConnection.authCredential
            : newConnection.sshKeyId,
        sshKeyId: newConnection.authType === 'key' ? newConnection.sshKeyId : undefined,
        status: 'disconnected'
      };

      addConnection(connection);

      // Reset form
      setNewConnection({
        name: '',
        host: '',
        port: 22,
        username: '',
        authType: 'key',
        authCredential: '',
        sshKeyId: ''
      });
      setFormErrors({});
      setTouched({});
      setIsAddingConnection(false);
      setError(null);
    } catch (err) {
      setError('Failed to add connection. Please try again.');
      console.error('Add connection error:', err);
    }
  }, [newConnection, validateForm, addConnection]);

  const handleRemoveConnection = useCallback(
    (id: string) => {
      try {
        removeConnection(id);
        setTestResults((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setError(null);
      } catch (err) {
        setError('Failed to remove connection. Please try again.');
        console.error('Remove connection error:', err);
      }
    },
    [removeConnection]
  );

  const handleTestConnection = useCallback(
    async (conn: VPSConnection) => {
      setTestingId(conn.id);
      setError(null);
      updateConnectionStatus(conn.id, 'connecting');

      try {
        const success = await testConnection(conn);
        setTestResults((prev) => ({
          ...prev,
          [conn.id]: {
            success,
            timestamp: Date.now(),
            message: success ? 'SSH connection successful' : 'Connection failed'
          }
        }));
        updateConnectionStatus(conn.id, success ? 'connected' : 'error');
      } catch (err) {
        setTestResults((prev) => ({
          ...prev,
          [conn.id]: {
            success: false,
            timestamp: Date.now(),
            message: 'Connection test error'
          }
        }));
        updateConnectionStatus(conn.id, 'error', String(err));
      } finally {
        setTestingId(null);
      }
    },
    [testConnection, updateConnectionStatus]
  );

  const handleCancel = useCallback(() => {
    setIsAddingConnection(false);
    setNewConnection({
      name: '',
      host: '',
      port: 22,
      username: '',
      authType: 'key',
      authCredential: '',
      sshKeyId: ''
    });
    setFormErrors({});
    setTouched({});
    setError(null);
  }, []);

  const handleSSHKeyAdded = useCallback((key: SSHKey) => {
    setNewConnection((prev) => ({
      ...prev,
      sshKeyId: key.id
    }));
  }, []);

  // Update form errors when fields change
  useEffect(() => {
    validateForm();
  }, [newConnection, validateForm]);

  return (
    <div style={{ padding: '40px 32px' }}>
      {/* Global Error */}
      {error && (
        <GlassSurface
          elevation="flat"
          border="accent"
          padding="sm"
          rounded="md"
          style={{
            marginBottom: '20px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.3)'
          }}
        >
          <div
            style={{
              fontSize: '13px',
              color: darkTheme.error,
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle style={{ width: '16px', height: '16px' }} />
            {error}
          </div>
        </GlassSurface>
      )}

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '20px',
            flexWrap: 'wrap'
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '12px'
              }}
            >
              <Server style={{ width: '22px', height: '22px', color: darkTheme.accent }} />
              <h2
                style={{
                  fontSize: '22px',
                  fontWeight: '600',
                  color: darkTheme.textPrimary,
                  letterSpacing: '-0.02em'
                }}
              >
                VPS Connections
              </h2>
            </div>
            <p
              style={{
                fontSize: '14px',
                color: darkTheme.textTertiary,
                lineHeight: '1.6',
                maxWidth: '560px'
              }}
            >
              Connect your VPS servers via SSH to run AI agents with full browser automation. Your
              credentials are encrypted and stored locally.
            </p>
          </div>

          {!isAddingConnection && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setIsMarketplaceOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 20px',
                  background: 'transparent',
                  border: `1px solid ${darkTheme.accent}`,
                  borderRadius: '8px',
                  color: darkTheme.accent,
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(212, 176, 140, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <ShoppingCart style={{ width: '16px', height: '16px' }} />
                Browse VPS Providers
              </button>
              <button
                onClick={() => setIsAddingConnection(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 20px',
                  background: darkTheme.accent,
                  border: 'none',
                  borderRadius: '8px',
                  color: '#1a1a1a',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = darkTheme.accentHover;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = darkTheme.accent;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Plus style={{ width: '16px', height: '16px' }} />
                Add VPS
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Connection Form */}
      {isAddingConnection && (
        <GlassCard
          elevation="raised"
          blur="md"
          padding="lg"
          rounded="lg"
          style={{
            marginBottom: '24px',
            background: darkTheme.bgSecondary,
            borderColor: darkTheme.border
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: `1px solid ${darkTheme.border}`
            }}
          >
            <Shield style={{ width: '20px', height: '20px', color: darkTheme.accent }} />
            <h4
              style={{
                fontSize: '15px',
                fontWeight: '600',
                color: darkTheme.textPrimary,
                letterSpacing: '-0.01em'
              }}
            >
              Add New VPS Connection
            </h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Connection Name */}
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: darkTheme.textSecondary,
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em'
                }}
              >
                <Server style={{ width: '12px', height: '12px' }} />
                Connection Name
              </label>
              <input
                type="text"
                value={newConnection.name}
                onChange={(e) => {
                  setNewConnection({ ...newConnection, name: e.target.value });
                  setTouched({ ...touched, name: true });
                }}
                placeholder="My Production Server"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: darkTheme.bg,
                  border: `1px solid ${touched.name && formErrors.name ? darkTheme.error : darkTheme.border}`,
                  borderRadius: '8px',
                  color: darkTheme.textPrimary,
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  if (!formErrors.name) {
                    e.target.style.borderColor = darkTheme.accent;
                    e.target.style.boxShadow = `0 0 0 3px rgba(212, 176, 140, 0.1)`;
                  }
                }}
                onBlur={(e) => {
                  e.target.style.borderColor =
                    touched.name && formErrors.name ? darkTheme.error : darkTheme.border;
                  e.target.style.boxShadow = 'none';
                }}
              />
              {touched.name && formErrors.name && (
                <p
                  style={{
                    fontSize: '12px',
                    color: darkTheme.error,
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <XCircle style={{ width: '12px', height: '12px' }} />
                  {formErrors.name}
                </p>
              )}
            </div>

            {/* Host and Port Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
              {/* Host */}
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: darkTheme.textSecondary,
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em'
                  }}
                >
                  <Globe style={{ width: '12px', height: '12px' }} />
                  Host (IP or Hostname)
                </label>
                <input
                  type="text"
                  value={newConnection.host}
                  onChange={(e) => {
                    setNewConnection({ ...newConnection, host: e.target.value });
                    setTouched({ ...touched, host: true });
                  }}
                  placeholder="192.168.1.100 or server.example.com"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: darkTheme.bg,
                    border: `1px solid ${touched.host && formErrors.host ? darkTheme.error : darkTheme.border}`,
                    borderRadius: '8px',
                    color: darkTheme.textPrimary,
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    if (!formErrors.host) {
                      e.target.style.borderColor = darkTheme.accent;
                      e.target.style.boxShadow = `0 0 0 3px rgba(212, 176, 140, 0.1)`;
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor =
                      touched.host && formErrors.host ? darkTheme.error : darkTheme.border;
                    e.target.style.boxShadow = 'none';
                  }}
                />
                {touched.host && formErrors.host && (
                  <p
                    style={{
                      fontSize: '12px',
                      color: darkTheme.error,
                      marginTop: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <XCircle style={{ width: '12px', height: '12px' }} />
                    {formErrors.host}
                  </p>
                )}
              </div>

              {/* Port */}
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: darkTheme.textSecondary,
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em'
                  }}
                >
                  <Link style={{ width: '12px', height: '12px' }} />
                  Port
                </label>
                <input
                  type="number"
                  value={newConnection.port}
                  onChange={(e) => {
                    setNewConnection({ ...newConnection, port: parseInt(e.target.value) || 22 });
                    setTouched({ ...touched, port: true });
                  }}
                  min={1}
                  max={65535}
                  placeholder="22"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: darkTheme.bg,
                    border: `1px solid ${touched.port && formErrors.port ? darkTheme.error : darkTheme.border}`,
                    borderRadius: '8px',
                    color: darkTheme.textPrimary,
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    if (!formErrors.port) {
                      e.target.style.borderColor = darkTheme.accent;
                      e.target.style.boxShadow = `0 0 0 3px rgba(212, 176, 140, 0.1)`;
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor =
                      touched.port && formErrors.port ? darkTheme.error : darkTheme.border;
                    e.target.style.boxShadow = 'none';
                  }}
                />
                {touched.port && formErrors.port && (
                  <p
                    style={{
                      fontSize: '12px',
                      color: darkTheme.error,
                      marginTop: '8px'
                    }}
                  >
                    {formErrors.port}
                  </p>
                )}
              </div>
            </div>

            {/* Username with Suggestions */}
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: darkTheme.textSecondary,
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em'
                }}
              >
                <User style={{ width: '12px', height: '12px' }} />
                Username
              </label>
              <input
                type="text"
                value={newConnection.username}
                onChange={(e) => {
                  setNewConnection({ ...newConnection, username: e.target.value });
                  setTouched({ ...touched, username: true });
                }}
                placeholder="root"
                list="username-suggestions"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: darkTheme.bg,
                  border: `1px solid ${touched.username && formErrors.username ? darkTheme.error : darkTheme.border}`,
                  borderRadius: '8px',
                  color: darkTheme.textPrimary,
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  if (!formErrors.username) {
                    e.target.style.borderColor = darkTheme.accent;
                    e.target.style.boxShadow = `0 0 0 3px rgba(212, 176, 140, 0.1)`;
                  }
                }}
                onBlur={(e) => {
                  e.target.style.borderColor =
                    touched.username && formErrors.username ? darkTheme.error : darkTheme.border;
                  e.target.style.boxShadow = 'none';
                }}
              />
              <datalist id="username-suggestions">
                {commonUsernames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  marginTop: '8px',
                  flexWrap: 'wrap'
                }}
              >
                {commonUsernames.slice(0, 4).map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      setNewConnection({ ...newConnection, username: name });
                      setTouched({ ...touched, username: true });
                    }}
                    style={{
                      padding: '4px 10px',
                      background: darkTheme.bg,
                      border: `1px solid ${darkTheme.border}`,
                      borderRadius: '4px',
                      color: darkTheme.textTertiary,
                      fontSize: '11px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = darkTheme.accent;
                      e.currentTarget.style.color = darkTheme.accent;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = darkTheme.border;
                      e.currentTarget.style.color = darkTheme.textTertiary;
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
              {touched.username && formErrors.username && (
                <p
                  style={{
                    fontSize: '12px',
                    color: darkTheme.error,
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <XCircle style={{ width: '12px', height: '12px' }} />
                  {formErrors.username}
                </p>
              )}
            </div>

            {/* Authentication Type */}
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: darkTheme.textSecondary,
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em'
                }}
              >
                <Lock style={{ width: '12px', height: '12px' }} />
                Authentication Type
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {(['key', 'password'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() =>
                      setNewConnection({ ...newConnection, authType: type, sshKeyId: '' })
                    }
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '14px 16px',
                      background:
                        newConnection.authType === type
                          ? 'rgba(212, 176, 140, 0.15)'
                          : darkTheme.bg,
                      border: `1px solid ${newConnection.authType === type ? darkTheme.accent : darkTheme.border}`,
                      borderRadius: '8px',
                      color:
                        newConnection.authType === type ? darkTheme.accent : darkTheme.textSecondary,
                      fontSize: '13px',
                      fontWeight: newConnection.authType === type ? '600' : '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {type === 'key' ? (
                      <Key style={{ width: '16px', height: '16px' }} />
                    ) : (
                      <Lock style={{ width: '16px', height: '16px' }} />
                    )}
                    {type === 'key' ? 'SSH Key' : 'Password'}
                  </button>
                ))}
              </div>
            </div>

            {/* SSH Key Selection */}
            {newConnection.authType === 'key' && (
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: darkTheme.textSecondary,
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em'
                  }}
                >
                  <Key style={{ width: '12px', height: '12px' }} />
                  Select SSH Key
                </label>
                {sshKeys.length === 0 ? (
                  <div
                    style={{
                      padding: '20px',
                      background: darkTheme.bg,
                      border: `1px dashed ${darkTheme.border}`,
                      borderRadius: '8px',
                      textAlign: 'center'
                    }}
                  >
                    <Key
                      style={{
                        width: '24px',
                        height: '24px',
                        color: darkTheme.textTertiary,
                        margin: '0 auto 12px'
                      }}
                    />
                    <p
                      style={{
                        fontSize: '13px',
                        color: darkTheme.textSecondary,
                        margin: '0 0 12px 0'
                      }}
                    >
                      No SSH keys stored
                    </p>
                    <button
                      onClick={() => setIsSSHKeyModalOpen(true)}
                      style={{
                        padding: '10px 16px',
                        background: darkTheme.accent,
                        border: 'none',
                        borderRadius: '6px',
                        color: '#1a1a1a',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      <Plus style={{ width: '14px', height: '14px', display: 'inline', marginRight: '6px' }} />
                      Add New Key
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <select
                        value={newConnection.sshKeyId}
                        onChange={(e) => {
                          setNewConnection({ ...newConnection, sshKeyId: e.target.value });
                          setTouched({ ...touched, sshKeyId: true });
                        }}
                        style={{
                          width: '100%',
                          padding: '14px 40px 14px 16px',
                          background: darkTheme.bg,
                          border: `1px solid ${touched.sshKeyId && formErrors.sshKeyId ? darkTheme.error : darkTheme.border}`,
                          borderRadius: '8px',
                          color: newConnection.sshKeyId
                            ? darkTheme.textPrimary
                            : darkTheme.textTertiary,
                          fontSize: '14px',
                          outline: 'none',
                          cursor: 'pointer',
                          appearance: 'none',
                          boxSizing: 'border-box'
                        }}
                      >
                        <option value="">Select an SSH key...</option>
                        {sshKeys.map((key) => (
                          <option key={key.id} value={key.id}>
                            {key.name} ({key.type.toUpperCase()})
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        style={{
                          position: 'absolute',
                          right: '14px',
                          width: '18px',
                          height: '18px',
                          color: darkTheme.textTertiary,
                          pointerEvents: 'none'
                        }}
                      />
                    </div>
                    <div style={{ marginTop: '10px' }}>
                      <button
                        onClick={() => setIsSSHKeyModalOpen(true)}
                        style={{
                          padding: '8px 14px',
                          background: 'transparent',
                          border: `1px solid ${darkTheme.border}`,
                          borderRadius: '6px',
                          color: darkTheme.accent,
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Plus style={{ width: '14px', height: '14px' }} />
                        Add New Key
                      </button>
                    </div>
                    {touched.sshKeyId && formErrors.sshKeyId && (
                      <p
                        style={{
                          fontSize: '12px',
                          color: darkTheme.error,
                          marginTop: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <XCircle style={{ width: '12px', height: '12px' }} />
                        {formErrors.sshKeyId}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Password Input */}
            {newConnection.authType === 'password' && (
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: darkTheme.textSecondary,
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em'
                  }}
                >
                  <Lock style={{ width: '12px', height: '12px' }} />
                  Password
                </label>
                <input
                  type="password"
                  value={newConnection.authCredential}
                  onChange={(e) => {
                    setNewConnection({ ...newConnection, authCredential: e.target.value });
                    setTouched({ ...touched, authCredential: true });
                  }}
                  placeholder="Enter SSH password"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: darkTheme.bg,
                    border: `1px solid ${touched.authCredential && formErrors.authCredential ? darkTheme.error : darkTheme.border}`,
                    borderRadius: '8px',
                    color: darkTheme.textPrimary,
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    if (!formErrors.authCredential) {
                      e.target.style.borderColor = darkTheme.accent;
                      e.target.style.boxShadow = `0 0 0 3px rgba(212, 176, 140, 0.1)`;
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor =
                      touched.authCredential && formErrors.authCredential
                        ? darkTheme.error
                        : darkTheme.border;
                    e.target.style.boxShadow = 'none';
                  }}
                />
                {touched.authCredential && formErrors.authCredential && (
                  <p
                    style={{
                      fontSize: '12px',
                      color: darkTheme.error,
                      marginTop: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <XCircle style={{ width: '12px', height: '12px' }} />
                    {formErrors.authCredential}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '14px', paddingTop: '8px' }}>
              <button
                onClick={handleAddConnection}
                style={{
                  flex: 1,
                  padding: '14px 24px',
                  background: darkTheme.accent,
                  border: 'none',
                  borderRadius: '8px',
                  color: '#1a1a1a',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = darkTheme.accentHover;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = darkTheme.accent;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Save Connection
              </button>
              <button
                onClick={handleCancel}
                style={{
                  flex: 1,
                  padding: '14px 24px',
                  background: 'transparent',
                  border: `1px solid ${darkTheme.borderStrong}`,
                  borderRadius: '8px',
                  color: darkTheme.textPrimary,
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = darkTheme.bgTertiary;
                  e.currentTarget.style.borderColor = darkTheme.border;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = darkTheme.borderStrong;
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Connection List */}
      {connections.length === 0 ? (
        <GlassCard
          elevation="flat"
          blur="sm"
          padding="xl"
          rounded="lg"
          style={{
            textAlign: 'center',
            border: `2px dashed ${darkTheme.border}`,
            background: darkTheme.bgSecondary
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              margin: '0 auto 24px',
              borderRadius: '18px',
              background: 'rgba(212, 176, 140, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Server style={{ width: '36px', height: '36px', color: darkTheme.accent }} />
          </div>
          <h4
            style={{
              fontSize: '16px',
              fontWeight: '600',
              color: darkTheme.textPrimary,
              marginBottom: '10px',
              letterSpacing: '-0.01em'
            }}
          >
            No VPS Connections
          </h4>
          <p
            style={{
              fontSize: '13px',
              color: darkTheme.textTertiary,
              marginBottom: '28px',
              maxWidth: '420px',
              marginLeft: 'auto',
              marginRight: 'auto',
              lineHeight: '1.6'
            }}
          >
            Add your first VPS to start running AI agents on your own infrastructure via SSH. Your
            credentials stay encrypted on your device.
          </p>
          {!isAddingConnection && (
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setIsMarketplaceOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '14px 24px',
                  background: 'transparent',
                  border: `1px solid ${darkTheme.accent}`,
                  borderRadius: '8px',
                  color: darkTheme.accent,
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <ShoppingCart style={{ width: '16px', height: '16px' }} />
                Browse Providers
              </button>
              <button
                onClick={() => setIsAddingConnection(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '14px 24px',
                  background: darkTheme.accent,
                  border: 'none',
                  borderRadius: '8px',
                  color: '#1a1a1a',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = darkTheme.accentHover;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = darkTheme.accent;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Plus style={{ width: '16px', height: '16px' }} />
                Add Your First VPS
              </button>
            </div>
          )}
        </GlassCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {connections.map((conn) => {
            const testResult = testResults[conn.id];
            const isTesting = testingId === conn.id;

            return (
              <GlassCard
                key={conn.id}
                elevation="raised"
                blur="md"
                padding="md"
                rounded="lg"
                style={{
                  background: darkTheme.bgSecondary,
                  borderColor: darkTheme.border
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '18px'
                  }}
                >
                  {/* Icon */}
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '12px',
                      background:
                        conn.status === 'connected'
                          ? 'rgba(52, 199, 89, 0.12)'
                          : conn.status === 'error'
                            ? 'rgba(239, 68, 68, 0.12)'
                            : conn.status === 'connecting'
                              ? 'rgba(245, 158, 11, 0.12)'
                              : 'rgba(212, 176, 140, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {conn.status === 'connecting' ? (
                      <Loader2
                        style={{
                          width: '26px',
                          height: '26px',
                          color: darkTheme.warning,
                          animation: 'spin 1s linear infinite'
                        }}
                      />
                    ) : (
                      <Server
                        style={{
                          width: '26px',
                          height: '26px',
                          color:
                            conn.status === 'connected'
                              ? darkTheme.success
                              : conn.status === 'error'
                                ? darkTheme.error
                                : darkTheme.accent
                        }}
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '6px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <h4
                        style={{
                          fontSize: '15px',
                          fontWeight: '600',
                          color: darkTheme.textPrimary,
                          margin: 0,
                          letterSpacing: '-0.01em'
                        }}
                      >
                        {conn.name}
                      </h4>
                      {conn.status === 'connected' && (
                        <CheckCircle
                          style={{ width: '16px', height: '16px', color: darkTheme.success } }
                        />
                      )}
                      {conn.status === 'error' && (
                        <XCircle
                          style={{ width: '16px', height: '16px', color: darkTheme.error } }
                        />
                      )}
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          background:
                            conn.authType === 'key'
                              ? 'rgba(212, 176, 140, 0.15)'
                              : 'rgba(100, 100, 100, 0.15)',
                          color: conn.authType === 'key' ? darkTheme.accent : darkTheme.textSecondary,
                          borderRadius: '4px',
                          fontWeight: '500'
                        }}
                      >
                        {conn.authType === 'key' ? 'SSH Key' : 'Password'}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        color: darkTheme.textTertiary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <Terminal style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '200px'
                        }}
                      >
                        {conn.username}@{conn.host}
                      </span>
                      <span style={{ color: darkTheme.borderStrong }}>:</span>
                      <span>{conn.port}</span>
                      {testResult && (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            color: testResult.success ? darkTheme.success : darkTheme.error
                          }}
                        >
                          <Clock style={{ width: '10px', height: '10px' }} />
                          {new Date(testResult.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                    <button
                      onClick={() => handleTestConnection(conn)}
                      disabled={isTesting || conn.status === 'connecting'}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        background: isTesting ? darkTheme.border : 'transparent',
                        border: `1px solid ${darkTheme.borderStrong}`,
                        borderRadius: '8px',
                        color: darkTheme.textPrimary,
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: isTesting ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap',
                        opacity: isTesting ? 0.6 : 1
                      }}
                    >
                      {isTesting ? (
                        <>
                          <Loader2
                            style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }}
                          />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Zap style={{ width: '14px', height: '14px' }} />
                          Test
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleRemoveConnection(conn.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        background: 'transparent',
                        border: `1px solid rgba(239, 68, 68, 0.3)`,
                        borderRadius: '8px',
                        color: darkTheme.error,
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Trash2 style={{ width: '14px', height: '14px' }} />
                      Remove
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Info Box */}
      <GlassSurface
        elevation="flat"
        border="accent"
        padding="md"
        rounded="lg"
        style={{
          marginTop: '28px',
          background: 'rgba(212, 176, 140, 0.06)',
          borderColor: 'rgba(212, 176, 140, 0.25)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(212, 176, 140, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Shield style={{ width: '20px', height: '20px', color: darkTheme.accent }} />
          </div>
          <div style={{ flex: 1 }}>
            <h4
              style={{
                fontSize: '14px',
                fontWeight: '600',
                color: darkTheme.accent,
                marginBottom: '8px',
                letterSpacing: '-0.01em'
              }}
            >
              About VPS Connections
            </h4>
            <p
              style={{
                fontSize: '13px',
                color: darkTheme.textTertiary,
                lineHeight: '1.6',
                margin: 0
              }}
            >
              VPS connections enable you to run AI agents on your own infrastructure via SSH. Your
              credentials are encrypted and stored locally. SSH keys are recommended over passwords
              for better security. Install the A2R runtime on your VPS to enable secure agent
              execution.
            </p>
          </div>
        </div>
      </GlassSurface>

      {/* Modals */}
      <MarketplaceModal isOpen={isMarketplaceOpen} onClose={() => setIsMarketplaceOpen(false)} />
      <SSHKeyModal
        isOpen={isSSHKeyModalOpen}
        onClose={() => setIsSSHKeyModalOpen(false)}
        onKeyAdded={handleSSHKeyAdded}
      />
    </div>
  );
};

// Add keyframes for spin animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

export default VPSConnectionsPanel;
