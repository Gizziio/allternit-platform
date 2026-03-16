/**
 * ControlCenter - Platform wiring overlay
 * 
 * Opens from gear icon in ShellHeader.
 * Modal overlay (not rail item, not hub page).
 * 
 * Sections:
 * - Compute & Runtimes (8-cloud crates integration)
 * - Secrets & Credentials
 * - SSH Connections
 * - Browser Pairing (ExtensionMV3 pairing flow)
 * - Policies (Policy tiers + confirmations)
 * - Dev Tools (Agentation toggle - dev mode only)
 * 
 * For MVP, only Browser Pairing and Policy sections are fully implemented.
 * Other sections are placeholders that route to existing CloudDeploy wizard.
 */

"use client";

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  X,
  Settings,
  Cloud,
  Key,
  Shield,
  Puzzle,
  Cpu,
  Wifi,
  Lock,
  Terminal,
  ArrowUpRight,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Boxes,
} from 'lucide-react';
import { GlassSurface } from '@/design/GlassSurface';
import {
  getPolicyStore,
} from '@/capsules/browser/policyService';
import {
  getEnvironmentManager,
} from '@/capsules/browser/environmentService';
import {
  getObservabilityService,
} from '@/capsules/browser/observabilityService';
import { NodesView } from '@/views/nodes';
import { ConnectedRuntimeConfigurationPanel } from '@/views/runtime/RuntimeConfigurationPanel';

// ============================================================================
// Props
// ============================================================================

export interface ControlCenterProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Browser pairing state
  pairedEndpoints?: PairedEndpoint[];
  onPairEndpoint?: (endpoint: PairedEndpoint) => void;
  onUnpairEndpoint?: (endpointId: string) => void;
  
  // Policy state
  allowedHosts?: string[];
  onAddAllowedHost?: (host: string) => void;
  onRemoveAllowedHost?: (host: string) => void;
  
  // Dev mode flag
  isDevMode?: boolean;
  
  // Agentation state
  agentationEnabled?: boolean;
  onToggleAgentation?: (enabled: boolean) => void;
  
  // View navigation
  onOpenView?: (viewType: string) => void;
}

// ============================================================================
// Types
// ============================================================================

export interface PairedEndpoint {
  id: string;
  type: 'extension' | 'runtime';
  name: string;
  pairedAt: string;
  status: 'connected' | 'disconnected';
  tabId?: number;
}

// ============================================================================
// Component
// ============================================================================

export function ControlCenter({
  isOpen,
  onClose,
  pairedEndpoints = [],
  onPairEndpoint,
  onUnpairEndpoint,
  allowedHosts = [],
  onAddAllowedHost,
  onRemoveAllowedHost,
  isDevMode = false,
  agentationEnabled = false,
  onToggleAgentation,
  onOpenView,
}: ControlCenterProps) {
  const [activeSection, setActiveSection] = useState<string>('browser-pairing');
  
  // Internal state for services
  const [internalEndpoints, setInternalEndpoints] = useState<PairedEndpoint[]>([]);
  const [internalHosts, setInternalHosts] = useState<string[]>([]);
  const [isPairing, setIsPairing] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [newHost, setNewHost] = useState('');

  // Load initial state from services on open
  useEffect(() => {
    if (isOpen) {
      // Load policy allowlist
      const policyStore = getPolicyStore();
      policyStore.getAllowlist().then(entries => {
        setInternalHosts(entries.map(e => e.host));
      });

      // Load environment status
      const envManager = getEnvironmentManager();
      envManager.getEnvironments().then(envs => {
        console.log('Available environments:', envs);
      });
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle pairing
  const handlePair = useCallback(() => {
    if (pairingCode.trim()) {
      const endpoint: PairedEndpoint = {
        id: 'endpoint_' + Date.now(),
        type: 'extension',
        name: `Chrome Extension (${pairingCode.trim()})`,
        pairedAt: new Date().toISOString(),
        status: 'connected',
        tabId: Math.floor(Math.random() * 1000),
      };
      
      if (onPairEndpoint) {
        onPairEndpoint(endpoint);
      } else {
        setInternalEndpoints(prev => [...prev, endpoint]);
      }
      
      setPairingCode('');
      setIsPairing(false);
      
      // Log to observability
      const obs = getObservabilityService();
      obs.log({
        event_type: 'browser.pairing.complete',
        severity: 'info',
        source: 'ControlCenter',
        message: `Paired extension: ${endpoint.name}`,
      });
    }
  }, [onPairEndpoint, pairingCode]);

  // Handle unpairing
  const handleUnpair = useCallback((endpointId: string) => {
    if (onUnpairEndpoint) {
      onUnpairEndpoint(endpointId);
    } else {
      setInternalEndpoints(prev => prev.filter(e => e.id !== endpointId));
    }
    
    // Log to observability
    const obs = getObservabilityService();
    obs.log({
      event_type: 'browser.pairing.remove',
      severity: 'info',
      source: 'ControlCenter',
      message: `Unpaired extension: ${endpointId}`,
    });
  }, [onUnpairEndpoint]);

  // Handle adding host
  const handleAddHost = useCallback(() => {
    if (newHost.trim()) {
      if (onAddAllowedHost) {
        onAddAllowedHost(newHost.trim());
      } else {
        setInternalHosts(prev => [...prev, newHost.trim()]);
      }
      
      // Add to policy store
      const policyStore = getPolicyStore();
      policyStore.addToAllowlist({
        host: newHost.trim(),
        riskTierLimit: 2,
        addedBy: 'user',
      });
      
      setNewHost('');
      
      // Log to observability
      const obs = getObservabilityService();
      obs.log({
        event_type: 'policy.allowlist.add',
        severity: 'info',
        source: 'ControlCenter',
        message: `Added host to allowlist: ${newHost.trim()}`,
      });
    }
  }, [onAddAllowedHost, newHost]);

  // Handle removing host
  const handleRemoveHost = useCallback((host: string) => {
    if (onRemoveAllowedHost) {
      onRemoveAllowedHost(host);
    } else {
      setInternalHosts(prev => prev.filter(h => h !== host));
    }
    
    // Log to observability
    const obs = getObservabilityService();
    obs.log({
      event_type: 'policy.allowlist.remove',
      severity: 'info',
      source: 'ControlCenter',
      message: `Removed host from allowlist: ${host}`,
    });
  }, [onRemoveAllowedHost]);

  // Use internal state if no props provided
  const endpoints = pairedEndpoints.length > 0 ? pairedEndpoints : internalEndpoints;
  const hosts = allowedHosts.length > 0 ? allowedHosts : internalHosts;

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-5xl h-[80vh] z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <GlassSurface
          intensity="thick"
          className="w-full h-full rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: 'var(--glass-bg-thick)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Control Center</h2>
              <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-secondary">
                Platform Wiring
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Navigation */}
            <div className="w-56 border-r border-border bg-secondary/30 overflow-y-auto">
              <SectionNav
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                isDevMode={isDevMode}
              />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto">
              {activeSection === 'browser-pairing' && (
                <BrowserPairingSection
                  pairedEndpoints={endpoints}
                  onPairEndpoint={handlePair}
                  onUnpairEndpoint={handleUnpair}
                  isPairing={isPairing}
                  setIsPairing={setIsPairing}
                  pairingCode={pairingCode}
                  setPairingCode={setPairingCode}
                />
              )}
              {activeSection === 'policies' && (
                <PolicySection
                  allowedHosts={hosts}
                  onAddAllowedHost={handleAddHost}
                  onRemoveAllowedHost={handleRemoveHost}
                  newHost={newHost}
                  setNewHost={setNewHost}
                />
              )}
              {activeSection === 'runtime' && (
                <RuntimeEnvironmentSection onOpenView={onOpenView} />
              )}
              {activeSection === 'compute' && (
                <div className="h-full overflow-auto">
                  <NodesView />
                </div>
              )}
              {activeSection === 'secrets' && (
                <PlaceholderSection
                  title="Secrets & Credentials"
                  description="Manage SSH keys, API tokens, and Vault connectors"
                  icon={Lock}
                  linkTo="/cloud-deploy"
                />
              )}
              {activeSection === 'ssh' && (
                <PlaceholderSection
                  title="SSH Connections"
                  description="Manage SSH hosts, tunnels, and known fingerprints"
                  icon={Terminal}
                  linkTo="/cloud-deploy"
                />
              )}
              {activeSection === 'dev-tools' && isDevMode && (
                <DevToolsSection
                  agentationEnabled={agentationEnabled}
                  onToggleAgentation={onToggleAgentation}
                />
              )}
            </div>
          </div>
        </GlassSurface>
      </div>
    </div>
  );
}

// ============================================================================
// Section Navigation
// ============================================================================

interface SectionNavProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isDevMode: boolean;
}

function SectionNav({ activeSection, onSectionChange, isDevMode }: SectionNavProps) {
  const sections = [
    { id: 'browser-pairing', label: 'Browser Pairing', icon: Wifi },
    { id: 'policies', label: 'Policies', icon: Shield },
    { id: 'runtime', label: 'Runtime Environment', icon: Boxes },
    { id: 'compute', label: 'Compute & Runtimes', icon: Cpu },
    { id: 'secrets', label: 'Secrets & Credentials', icon: Lock },
    { id: 'ssh', label: 'SSH Connections', icon: Terminal },
  ];

  if (isDevMode) {
    sections.push({ id: 'dev-tools', label: 'Dev Tools', icon: Puzzle });
  }

  return (
    <div className="p-4 space-y-1">
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
              text-sm font-medium
              transition-colors
              ${
                activeSection === section.id
                  ? 'bg-accent/20 text-accent'
                  : 'hover:bg-secondary/50 text-muted-foreground'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span>{section.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Browser Pairing Section
// ============================================================================

interface BrowserPairingSectionProps {
  pairedEndpoints: PairedEndpoint[];
  onPairEndpoint?: (endpoint: PairedEndpoint) => void;
  onUnpairEndpoint?: (endpointId: string) => void;
  isPairing: boolean;
  setIsPairing: (isPairing: boolean) => void;
  pairingCode: string;
  setPairingCode: (code: string) => void;
}

function BrowserPairingSection({
  pairedEndpoints,
  onPairEndpoint,
  onUnpairEndpoint,
  isPairing,
  setIsPairing,
  pairingCode,
  setPairingCode,
}: BrowserPairingSectionProps) {
  const handlePair = useCallback(() => {
    if (onPairEndpoint && pairingCode.trim()) {
      onPairEndpoint({
        id: `endpoint-${Date.now()}`,
        type: 'extension',
        name: `Chrome Extension (${pairingCode.trim()})`,
        pairedAt: new Date().toISOString(),
        status: 'connected',
        tabId: Math.floor(Math.random() * 1000),
      });
      setPairingCode('');
      setIsPairing(false);
    }
  }, [onPairEndpoint, pairingCode, setPairingCode, setIsPairing]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold mb-1">Browser Extension Pairing</h3>
        <p className="text-sm text-muted-foreground">
          Pair Chrome extensions to enable agentic browsing on external tabs
        </p>
      </div>

      {/* Pairing Form */}
      <div className="p-4 rounded-lg bg-secondary/30 border border-border">
        {!isPairing ? (
          <button
            onClick={() => setIsPairing(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Pair New Extension</span>
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Enter Pairing Code
              </label>
              <input
                type="text"
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value)}
                placeholder="e.g., A2R-XXXX"
                className="w-full px-3 py-2 rounded-lg bg-primary border border-border focus:border-accent/50 focus:outline-none text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePair}
                disabled={!pairingCode.trim()}
                className="px-4 py-2 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50 transition-colors text-sm"
              >
                Complete Pairing
              </button>
              <button
                onClick={() => setIsPairing(false)}
                className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Paired Endpoints List */}
      <div>
        <h4 className="text-sm font-medium mb-3">Paired Endpoints</h4>
        {pairedEndpoints.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wifi className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No paired endpoints</p>
            <p className="text-xs mt-1">Pair an extension to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pairedEndpoints.map((endpoint) => (
              <div
                key={endpoint.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      endpoint.status === 'connected'
                        ? 'bg-green-500 animate-pulse'
                        : 'bg-gray-500'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium">{endpoint.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Paired {new Date(endpoint.pairedAt).toLocaleDateString()}
                      {endpoint.tabId && ` • Tab ${endpoint.tabId}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onUnpairEndpoint?.(endpoint.id)}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-500 mb-1">Extension Setup</p>
            <p className="text-muted-foreground">
              Install the A2R Browser Extension from the Chrome Web Store.
              Open the extension and enter the pairing code shown in your ShellUI.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Policy Section
// ============================================================================

interface PolicySectionProps {
  allowedHosts: string[];
  onAddAllowedHost?: (host: string) => void;
  onRemoveAllowedHost?: (host: string) => void;
  newHost: string;
  setNewHost: (host: string) => void;
}

function PolicySection({
  allowedHosts,
  onAddAllowedHost,
  onRemoveAllowedHost,
  newHost,
  setNewHost,
}: PolicySectionProps) {
  const handleAdd = useCallback(() => {
    if (onAddAllowedHost && newHost.trim()) {
      onAddAllowedHost(newHost.trim());
      setNewHost('');
    }
  }, [onAddAllowedHost, newHost, setNewHost]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  }, [handleAdd]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold mb-1">Policy Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Manage host allowlists and risk tier policies
        </p>
      </div>

      {/* Risk Tier Info */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { tier: 0, label: 'Read-only', color: 'bg-green-500' },
          { tier: 1, label: 'Navigation', color: 'bg-blue-500' },
          { tier: 2, label: 'Form Fill', color: 'bg-purple-500' },
          { tier: 3, label: 'Commit', color: 'bg-yellow-500' },
          { tier: 4, label: 'Irreversible', color: 'bg-red-500' },
        ].map((t) => (
          <div
            key={t.tier}
            className="p-3 rounded-lg bg-secondary/30 border border-border text-center"
          >
            <div className={`w-8 h-8 rounded-full ${t.color} mx-auto mb-2 flex items-center justify-center text-white text-sm font-bold`}>
              {t.tier}
            </div>
            <p className="text-xs font-medium">{t.label}</p>
          </div>
        ))}
      </div>

      {/* Host Allowlist */}
      <div>
        <h4 className="text-sm font-medium mb-3">Host Allowlist</h4>
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            value={newHost}
            onChange={(e) => setNewHost(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., example.com"
            className="flex-1 px-3 py-2 rounded-lg bg-primary border border-border focus:border-accent/50 focus:outline-none text-sm"
          />
          <button
            onClick={handleAdd}
            disabled={!newHost.trim()}
            className="px-4 py-2 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50 transition-colors text-sm"
          >
            Add Host
          </button>
        </div>
        {allowedHosts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No allowed hosts</p>
            <p className="text-xs mt-1">Add hosts to enable browser automation</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allowedHosts.map((host) => (
              <div
                key={host}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border"
              >
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span className="text-sm">{host}</span>
                <button
                  onClick={() => onRemoveAllowedHost?.(host)}
                  className="p-0.5 rounded hover:bg-red-500/20 text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-yellow-500 mb-1">Default Deny Policy</p>
            <p className="text-muted-foreground">
              By default, all hosts are denied. Add hosts to this allowlist to enable
              browser automation. Tier 3+ actions always require human confirmation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Dev Tools Section
// ============================================================================

interface DevToolsSectionProps {
  agentationEnabled: boolean;
  onToggleAgentation?: (enabled: boolean) => void;
}

function DevToolsSection({
  agentationEnabled,
  onToggleAgentation,
}: DevToolsSectionProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold mb-1">Developer Tools</h3>
        <p className="text-sm text-muted-foreground">
          Enable dev-only features and debugging tools
        </p>
      </div>

      {/* Agentation Toggle */}
      <div className="p-4 rounded-lg bg-secondary/30 border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Puzzle className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-sm font-medium">Agentation</p>
              <p className="text-xs text-muted-foreground">
                UI annotation tool for AI agents (dev-only)
              </p>
            </div>
          </div>
          <button
            onClick={() => onToggleAgentation?.(!agentationEnabled)}
            className={`
              relative w-12 h-6 rounded-full transition-colors
              ${agentationEnabled ? 'bg-accent' : 'bg-secondary'}
            `}
          >
            <div
              className={`
                absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                ${agentationEnabled ? 'left-7' : 'left-1'}
              `}
            />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-500 mb-1">Dev Mode Only</p>
            <p className="text-muted-foreground">
              These tools are only available in development mode (NODE_ENV=development).
              They are never included in production builds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Runtime Environment Section (N3, N12, N14, N16)
// ============================================================================

interface RuntimeEnvironmentSectionProps {
  onOpenView?: (viewType: string) => void;
}

function RuntimeEnvironmentSection({ onOpenView }: RuntimeEnvironmentSectionProps) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Runtime Environment</h3>
        <p className="text-sm text-muted-foreground">
          Manage live runtime drivers, limits, replay posture, and warm capacity from
          the real backend runtime routes instead of placeholder overlay state.
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-secondary/30 p-4">
        <ConnectedRuntimeConfigurationPanel
          compact
          showManagementLinks
          onOpenView={onOpenView}
        />
      </div>

      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-500 mb-1">Agent Mode Placement</p>
            <p className="text-muted-foreground">
              Shared agent mode lives in <span className="font-medium text-foreground">Runtime Ops</span> under
              <span className="font-medium text-foreground"> Shared Agent Mode</span>. Session briefs,
              tags, operator notes, and per-session work stay in
              <span className="font-medium text-foreground"> Agent Sessions</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Placeholder Section
// ============================================================================

interface PlaceholderSectionProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  linkTo: string;
}

function PlaceholderSection({
  title,
  description,
  icon: Icon,
  linkTo,
}: PlaceholderSectionProps) {
  return (
    <div className="p-6 flex items-center justify-center h-full">
      <div className="text-center max-w-md">
        <Icon className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <a
          href={linkTo}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors text-sm"
        >
          <span>Open Cloud Deploy</span>
          <ArrowUpRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

export default ControlCenter;
