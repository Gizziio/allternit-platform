// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrives,
  Cloud,
  Globe,
  Key,
  Plus,
  Trash,
  Check,
  Cpu,
  TreeStructure,
  Pulse,
  Terminal,
  ArrowSquareOut,
  Package,
  Stack,
  RocketLaunch,
  Shield,
  ArrowsClockwise,
  Wallet,
  Files,
  Gear,
  Cube,
  Code,
  AppWindow,
  Sparkle,
  Spinner,
  WarningCircle,
} from "@phosphor-icons/react";

// Import real API clients
import { 
  vpsApi, 
  cloudApi, 
  environmentApi, 
  sshKeyApi,
  InfrastructureWebSocket,
} from '@/api/infrastructure/index';
import type { VPSConnection } from '@/api/infrastructure/vps';
import type { CloudProvider, Deployment, Instance } from '@/api/infrastructure/cloud';
import type { EnvironmentTemplate, Environment, EnvironmentType } from '@/api/infrastructure/environments';
import type { SSHKey } from '@/api/infrastructure/ssh-keys';
import type { InfrastructureEvent } from '@/api/infrastructure/websocket';

// Import toast for notifications
import { useToast } from '../../hooks/use-toast';
import { ConfirmModal } from '@/components/ConfirmModal';

// Import Environment Wizard
import { EnvironmentWizard } from '../../components/environments/EnvironmentWizard';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('InfrastructureSettings');

// =============================================================================
// CONSTANTS
// =============================================================================

const ENV_TYPE_FILTERS = [
  { id: 'all', label: 'All Templates', icon: Stack },
  { id: 'devcontainer', label: 'Dev Containers', icon: Code },
  { id: 'nix', label: 'Nix Flakes', icon: Cube },
  { id: 'sandbox', label: 'Sandbox VMs', icon: Shield },
  { id: 'platform', label: 'Platform', icon: Gear },
];

// =============================================================================
// COMPONENT
// =============================================================================

interface DeployedNode {
  id: string;
  hostname: string;
  status: 'online' | 'offline' | 'busy' | 'error';
  cpu_cores: number;
  memory_gb: number;
  docker_available: boolean;
  gpu_available: boolean;
  last_seen: string;
}

interface InfrastructureError {
  vps?: string;
  deployments?: string;
  instances?: string;
  environments?: string;
  sshKeys?: string;
  providers?: string;
}

interface InfrastructureSettingsProps {
  initialTab?: 'overview' | 'providers' | 'connections' | 'environments' | 'nodes';
}

export const InfrastructureSettings: React.FC<InfrastructureSettingsProps> = ({ initialTab = 'overview' }) => {
  const { addToast } = useToast();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'providers' | 'connections' | 'environments' | 'nodes'>(initialTab);
  
  // Inline state adjustment for initialTab change
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setActiveTab(initialTab);
  }

  // Data states
  const [connections, setConnections] = useState<VPSConnection[]>([]);
  const [providers, setProviders] = useState<CloudProvider[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [nodes, setNodes] = useState<DeployedNode[]>([]);
  const [sshKeys, setSshKeys] = useState<SSHKey[]>([]);
  const [templates, setTemplates] = useState<EnvironmentTemplate[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [environmentProvisioningEnabled, setEnvironmentProvisioningEnabled] = useState(false);
  const [environmentProvisioningReason, setEnvironmentProvisioningReason] = useState<string | null>(null);
  const [cloudDeploymentEnabled, setCloudDeploymentEnabled] = useState(false);
  const [cloudDeploymentReason, setCloudDeploymentReason] = useState<string | null>(null);
  
  // Loading states
  const [isLoadingVPS, setIsLoadingVPS] = useState(false);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [isLoadingDeployments, setIsLoadingDeployments] = useState(false);
  const [isLoadingEnvironments, setIsLoadingEnvironments] = useState(false);
  const [isLoadingSSHKeys, setIsLoadingSSHKeys] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [deployingProvider, setDeployingProvider] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [destroyingEnvironment, setDestroyingEnvironment] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  
  // Error states
  const [errors, setErrors] = useState<InfrastructureError>({});
  
  // Environment filter
  const [envFilter, setEnvFilter] = useState<EnvironmentTemplate['type'] | 'all'>('all');
  
  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardInitialTemplate, setWizardInitialTemplate] = useState<string | undefined>(undefined);

  // =============================================================================
  // WEBSOCKET HANDLER
  // =============================================================================

  const handleWebSocketEvent = useCallback((event: InfrastructureEvent) => {
    switch (event.type) {
      case 'deployment_update':
        const deploymentUpdate = event.data as Deployment;
        setDeployments(prev => 
          prev.map(d => d.id === deploymentUpdate.id ? deploymentUpdate : d)
        );
        break;
      case 'instance_update':
        const instanceUpdate = event.data as Instance;
        setInstances(prev => {
          const newInstances = prev.map(i => i.id === instanceUpdate.id ? instanceUpdate : i);
          // Also update nodes based on new instances
          setNodes(prevNodes => prevNodes.map(node => {
            const inst = newInstances.find((i: Instance) => i.id === node.id);
            if (inst) {
              return {
                id: inst.id,
                hostname: inst.name,
                status: inst.status === 'running' ? 'online' : 
                        inst.status === 'stopped' ? 'offline' : 'error',
                cpu_cores: inst.cpu,
                memory_gb: Math.round(inst.ram / 1024),
                docker_available: inst.docker_available,
                gpu_available: inst.gpu_available,
                last_seen: inst.last_seen,
              };
            }
            return node;
          }));
          return newInstances;
        });
        break;
      case 'environment_status':
        const envUpdate = event.data as Environment;
        setEnvironments(prev => 
          prev.map(e => e.id === envUpdate.id ? envUpdate : e)
        );
        break;
      case 'vps_status':
        const vpsUpdate = event.data as VPSConnection;
        setConnections(prev => 
          prev.map(c => c.id === vpsUpdate.id ? vpsUpdate : c)
        );
        break;
    }
  }, []); // No dependencies needed since we use functional updates

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  const loadVPSConnections = async () => {
    setIsLoadingVPS(true);
    setErrors(prev => ({ ...prev, vps: undefined }));
    try {
      const data = await vpsApi.list();
      setConnections(data);
    } catch (err: any) {
      const message = err.message || 'Failed to load VPS connections';
      setErrors(prev => ({ ...prev, vps: message }));
      addToast({
        title: 'Error',
        description: message,
        type: 'error',
      });
    } finally {
      setIsLoadingVPS(false);
    }
  };

  const loadProviders = async () => {
    setIsLoadingProviders(true);
    setErrors(prev => ({ ...prev, providers: undefined }));
    try {
      const [data, capabilities] = await Promise.all([
        cloudApi.listProviders(),
        cloudApi.getCapabilities(),
      ]);
      setCloudDeploymentEnabled(capabilities.deploymentEnabled);
      setCloudDeploymentReason(capabilities.reason ?? null);
      setProviders(data);
    } catch (err: any) {
      const message = err.message || 'Failed to load cloud providers';
      setErrors(prev => ({ ...prev, providers: message }));
      addToast({
        title: 'Error',
        description: message,
        type: 'error',
      });
    } finally {
      setIsLoadingProviders(false);
    }
  };

  const loadDeployments = async () => {
    setIsLoadingDeployments(true);
    setErrors(prev => ({ ...prev, deployments: undefined }));
    try {
      if (!cloudDeploymentEnabled) {
        setDeployments([]);
        setInstances([]);
        setNodes([]);
        return;
      }

      const [deps, insts] = await Promise.all([
        cloudApi.listDeployments(),
        cloudApi.listInstances(),
      ]);
      setDeployments(deps);
      setInstances(insts);
      
      // Convert instances to DeployedNode format
      const nodeData: DeployedNode[] = insts.map(inst => ({
        id: inst.id,
        hostname: inst.name,
        status: inst.status === 'running' ? 'online' : 
                inst.status === 'stopped' ? 'offline' : 'error',
        cpu_cores: inst.cpu,
        memory_gb: Math.round(inst.ram / 1024),
        docker_available: inst.docker_available,
        gpu_available: inst.gpu_available,
        last_seen: inst.last_seen,
      }));
      setNodes(nodeData);
    } catch (err: any) {
      const message = err.message || 'Failed to load deployments';
      setErrors(prev => ({ ...prev, deployments: message, instances: message }));
      addToast({
        title: 'Error',
        description: message,
        type: 'error',
      });
    } finally {
      setIsLoadingDeployments(false);
    }
  };

  /**
   * Load the environment template catalog and provisioning capability state.
   */
  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    setErrors(prev => ({ ...prev, templates: undefined }));
    try {
      const capabilities = await environmentApi.getCapabilities();
      setEnvironmentProvisioningEnabled(capabilities.provisioningEnabled);
      setEnvironmentProvisioningReason(capabilities.reason ?? null);
      const data = await environmentApi.listTemplates();
      setTemplates(data);
    } catch (err: any) {
      const message = err.message || 'Failed to load environment templates';
      setTemplates([]);
      setErrors(prev => ({ ...prev, templates: message }));
      addToast({
        title: 'Error',
        description: message,
        type: 'error',
      });
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  /**
   * Load provisioned environments
   */
  const loadEnvironments = async () => {
    setIsLoadingEnvironments(true);
    setErrors(prev => ({ ...prev, environments: undefined }));
    try {
      if (!environmentProvisioningEnabled) {
        setEnvironments([]);
        return;
      }

      const envs = await environmentApi.list();
      setEnvironments(envs);
    } catch (err: any) {
      const message = err.message || 'Failed to load environments';
      setErrors(prev => ({ ...prev, environments: message }));
      // Don't show toast for this - environments might just be empty
      console.debug('[InfrastructureSettings] Failed to load environments:', message);
    } finally {
      setIsLoadingEnvironments(false);
    }
  };

  const loadSSHKeys = async () => {
    setIsLoadingSSHKeys(true);
    setErrors(prev => ({ ...prev, sshKeys: undefined }));
    try {
      const data = await sshKeyApi.list();
      setSshKeys(data);
    } catch (err: any) {
      const message = err.message || 'Failed to load SSH keys';
      setErrors(prev => ({ ...prev, sshKeys: message }));
      addToast({
        title: 'Error',
        description: message,
        type: 'error',
      });
    } finally {
      setIsLoadingSSHKeys(false);
    }
  };

  // =============================================================================
  // ACTIONS
  // =============================================================================

  const handleTestConnection = async (id: string) => {
    setTestingConnection(id);
    try {
      const result = await vpsApi.test(id);
      addToast({
        title: result.success ? 'Success' : 'Connection Failed',
        description: result.message,
        type: result.success ? 'success' : 'error',
      });
      // Refresh the connection to get updated status
      await loadVPSConnections();
    } catch (err: any) {
      addToast({
        title: 'Error',
        description: err.message || 'Failed to test connection',
        type: 'error',
      });
    } finally {
      setTestingConnection(null);
    }
  };

  const handleDeleteConnection = (id: string) => {
    setConfirmDialog({
      message: 'Are you sure you want to delete this VPS connection?',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await vpsApi.delete(id);
          addToast({ title: 'Success', description: 'VPS connection deleted', type: 'success' });
          await loadVPSConnections();
        } catch (err: any) {
          addToast({ title: 'Error', description: err.message || 'Failed to delete connection', type: 'error' });
        }
      },
    });
  };

  const handleDeploy = async (providerId: string) => {
    if (!cloudDeploymentEnabled) {
      addToast({
        title: 'Cloud Deploy Unavailable',
        description: cloudDeploymentReason || 'Cloud deployment is not wired to a backend yet.',
        type: 'warning',
      });
      return;
    }

    setDeployingProvider(providerId);
    try {
      // Open cloud deploy modal with selected provider
      window.dispatchEvent(new CustomEvent('allternit:open-cloud-deploy', { 
        detail: { provider: providerId } 
      }));
      
      addToast({
        title: 'Deployment Started',
        description: `Starting deployment to ${providerId}...`,
        type: 'info',
      });
      
      // Poll for deployment updates
      const pollInterval = setInterval(async () => {
        await loadDeployments();
      }, 5000);
      
      // Stop polling after 2 minutes
      setTimeout(() => clearInterval(pollInterval), 120000);
    } catch (err: any) {
      addToast({
        title: 'Error',
        description: err.message || 'Failed to initiate deployment',
        type: 'error',
      });
    } finally {
      setDeployingProvider(null);
    }
  };

  const handleDeleteSSHKey = (id: string) => {
    setConfirmDialog({
      message: 'Are you sure you want to delete this SSH key?',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await sshKeyApi.delete(id);
          addToast({ title: 'Success', description: 'SSH key deleted', type: 'success' });
          await loadSSHKeys();
        } catch (err: any) {
          addToast({ title: 'Error', description: err.message || 'Failed to delete SSH key', type: 'error' });
        }
      },
    });
  };

  /**
   * Handle provisioning a new environment from a template
   */
  const handleProvision = async (templateId: string) => {
    if (!environmentProvisioningEnabled) {
      addToast({
        title: 'Provisioning Unavailable',
        description: environmentProvisioningReason || 'Environment provisioning is not wired to a backend yet.',
        type: 'warning',
      });
      return;
    }

    setIsProvisioning(true);
    try {
      const template = templates.find(t => t.id === templateId);
      const dateStr = isClient ? new Date().toISOString().slice(0, 10) : '';
      const name = `${template?.name || 'Environment'} ${dateStr}`;
      const env = await environmentApi.provision(templateId, name);
      addToast({
        title: 'Provisioning Started',
        description: `Environment "${env.name}" is being provisioned...`,
        type: 'info',
      });
      // Refresh both templates and environments
      await loadEnvironments();
    } catch (err: any) {
      addToast({
        title: 'Error',
        description: err.message || 'Failed to provision environment',
        type: 'error',
      });
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleDestroyEnvironment = (id: string) => {
    setConfirmDialog({
      message: 'Are you sure you want to destroy this environment? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmDialog(null);
        setDestroyingEnvironment(id);
        try {
          await environmentApi.destroy(id);
          addToast({ title: 'Success', description: 'Environment destroyed', type: 'success' });
          await loadEnvironments();
        } catch (err: any) {
          addToast({ title: 'Error', description: err.message || 'Failed to destroy environment', type: 'error' });
        } finally {
          setDestroyingEnvironment(null);
        }
      },
    });
  };

  const handleDestroyInstance = (id: string) => {
    setConfirmDialog({
      message: 'Are you sure you want to destroy this instance? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await cloudApi.destroyInstance(id);
          addToast({ title: 'Success', description: 'Instance destroyed', type: 'success' });
          await loadDeployments();
        } catch (err: any) {
          addToast({ title: 'Error', description: err.message || 'Failed to destroy instance', type: 'error' });
        }
      },
    });
  };

  // =============================================================================
  // EFFECTS
  // =============================================================================

  // Use a ref to track mounted state
  const isMountedRef = React.useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Load all data on mount (only once)
    const loadAllData = async () => {
      await Promise.all([
        loadVPSConnections(),
        loadProviders(),
        loadDeployments(),
        loadEnvironments(),
        loadSSHKeys(),
      ]);
    };
    
    loadAllData();
    
    // Setup WebSocket for real-time updates
    const ws = new InfrastructureWebSocket();
    if (ws.isSupported()) {
      ws.onEvent(handleWebSocketEvent);
      ws.connect();
    }
    
    return () => {
      ws.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  const filteredTemplates = templates.filter(
    t => envFilter === 'all' || t.type === envFilter
  );

  // =============================================================================
  // RENDER
  // =============================================================================

  const renderOverview = () => (
    <div className="flex flex-col gap-6">
      {/* Status Cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatusCard
          title="Connected VPS"
          value={connections.length}
          icon={<HardDrives size={20} />}
          color="var(--status-success)"
          action="Manage"
          onAction={() => setActiveTab('connections')}
          isLoading={isLoadingVPS}
        />
        <StatusCard
          title="Active Nodes"
          value={nodes.filter(n => n.status === 'online').length}
          icon={<Cpu size={20} />}
          color="var(--status-info)"
          action="View"
          onAction={() => setActiveTab('nodes')}
          isLoading={isLoadingDeployments}
        />
        <StatusCard
          title="Environments"
          value={environments.filter(e => e.status === 'running').length}
          icon={<Package size={20} />}
          color="var(--accent-primary)"
          action="Browse"
          onAction={() => setActiveTab('environments')}
          isLoading={isLoadingEnvironments}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-[var(--surface-hover)] rounded-xl p-6 border border-solid border-[var(--ui-border-muted)]">
        <h3 className="text-base font-semibold m-[0_0_16px_0] text-[var(--ui-text-primary)]">
          Quick Actions
        </h3>
        <div className="flex gap-3 flex-wrap">
          <ActionButton
            icon={<RocketLaunch size={18} />}
            label="Deploy to Cloud"
            onClick={() => setActiveTab('providers')}
            primary
          />
          <ActionButton
            icon={<Code size={18} />}
            label="New Environment"
            onClick={() => setActiveTab('environments')}
          />
          <ActionButton
            icon={<HardDrives size={18} />}
            label="Connect VPS"
            onClick={() => setActiveTab('connections')}
          />
          <ActionButton
            icon={<Shield size={18} />}
            label="Create Sandbox"
            onClick={() => { setEnvFilter('sandbox'); setActiveTab('environments'); }}
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-[var(--surface-hover)] rounded-xl p-6 border border-solid border-[var(--ui-border-muted)]">
        <h3 className="text-base font-semibold m-[0_0_16px_0] text-[var(--ui-text-primary)]">
          Recent Activity
        </h3>
        {deployments.length === 0 && environments.length === 0 ? (
          <EmptyState
            icon={<HardDrives size={48} className="text-[#333]" />}
            title="No infrastructure connected"
            description="Deploy to a cloud provider or connect your VPS to get started."
            action="Get Started"
            onAction={() => setActiveTab('providers')}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {[...deployments.slice(0, 3), ...environments.slice(0, 3)]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 5)
              .map((item, idx) => (
                <div key={`infrastructuresettings-${idx}`} className="flex items-center gap-3 p-3 bg-[var(--surface-hover)] rounded-lg">
                  <div className={`size-2 rounded-full ${
                    'instance_name' in item ? 'bg-[var(--status-info)]' : 'bg-[var(--status-success)]'
                  }`} />
                  <div className="flex-1">
                    <div className="text-sm text-[var(--ui-text-primary)]">
                      {'instance_name' in item ? `Deployed ${item.instance_name}` : `Created ${(item as Environment).name}`}
                    </div>
                    <div className="text-[12px] text-[var(--text-muted)]">
                      {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderProviders = () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold m-[0_0_8px_0] text-[var(--ui-text-primary)]">
            Cloud Providers
          </h2>
          <p className="text-sm text-[var(--ui-text-secondary)] m-0">
            Deploy Allternit nodes to your preferred cloud provider
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button"
            onClick={loadProviders}
            disabled={isLoadingProviders}
            className="p-[8px_16px] rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent text-[var(--ui-text-secondary)] text-[13px] cursor-pointer flex items-center gap-1.5"
          >
            <ArrowsClockwise size={14} className={isLoadingProviders ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {errors.providers && (
        <ErrorAlert message={errors.providers} onRetry={loadProviders} />
      )}

      {isLoadingProviders ? (
        <LoadingState message="Loading cloud providers..." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            {providers.map(provider => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onDeploy={() => handleDeploy(provider.id)}
                isDeploying={deployingProvider === provider.id}
              />
            ))}
          </div>
          {!cloudDeploymentEnabled && cloudDeploymentReason && (
            <div className="mt-4 text-[13px] text-[var(--ui-text-muted)]">
              {cloudDeploymentReason}
            </div>
          )}

          {/* Deployments Section */}
          {deployments.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold m-[0_0_16px_0] text-[var(--ui-text-primary)]">
                Active Deployments
              </h3>
              <div className="flex flex-col gap-3">
                {deployments.map(deployment => (
                  <DeploymentRow 
                    key={deployment.id} 
                    deployment={deployment}
                    onCancel={() => cloudApi.cancelDeployment(deployment.id).then(loadDeployments)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* BYOC Section */}
      <div className="mt-8 p-6 bg-gradient-to-br from-[var(--accent-primary)]/5 to-transparent rounded-xl border border-solid border-[var(--accent-primary)]/20">
        <div className="flex items-center gap-4 mb-4">
          <div className="size-12 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center">
            <HardDrives size={24} className="text-[var(--accent-primary)]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold m-[0_0_4px_0] text-[var(--ui-text-primary)]">
              Bring Your Own Server
            </h3>
            <p className="text-[14px] text-[var(--ui-text-secondary)] m-0">
              Already have a VPS? Connect it to Allternit in minutes.
            </p>
          </div>
        </div>
        <button type="button"
          onClick={() => setActiveTab('connections')}
          className="p-[10px_20px] rounded-lg border border-solid border-[#d4b08c] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-sm font-medium cursor-pointer flex items-center gap-2"
        >
          <Plus size={16} />
          Connect Existing VPS
        </button>
      </div>
    </div>
  );

  const renderConnections = () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold m-[0_0_8px_0] text-[var(--ui-text-primary)]">
            VPS Connections
          </h2>
          <p className="text-sm text-[var(--ui-text-secondary)] m-0">
            Manage your connected servers and their status
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button"
            onClick={loadVPSConnections}
            disabled={isLoadingVPS}
            className="p-[8px_16px] rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent text-[var(--ui-text-secondary)] text-[13px] cursor-pointer flex items-center gap-1.5"
          >
            <ArrowsClockwise size={14} className={isLoadingVPS ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('allternit:open-vps-panel'));
            }}
            className="p-[10px_20px] rounded-lg border-none bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-sm font-semibold cursor-pointer flex items-center gap-2"
          >
            <Plus size={16} />
            Add Connection
          </button>
        </div>
      </div>

      {errors.vps && (
        <ErrorAlert message={errors.vps} onRetry={loadVPSConnections} />
      )}

      {isLoadingVPS ? (
        <LoadingState message="Loading VPS connections..." />
      ) : connections.length === 0 ? (
        <EmptyState
          icon={<HardDrives size={64} className="text-[#333]" />}
          title="No VPS connections"
          description="Connect your existing VPS to manage it through Allternit."
          action="Connect VPS"
          onAction={() => window.dispatchEvent(new CustomEvent('allternit:open-vps-panel'))}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="bg-[var(--surface-hover)] rounded-xl p-[16px_20px] border border-solid border-[var(--ui-border-muted)] flex items-center gap-4"
            >
              <div 
                className={`size-11 rounded-[10px] flex items-center justify-center ${
                  conn.status === 'connected' ? 'bg-[var(--status-success-bg)]' : 
                  conn.status === 'error' ? 'bg-[var(--status-error-bg)]' : 
                  'bg-[var(--accent-primary)]/10'
                }`}
              >
                <HardDrives size={22} color={
                  conn.status === 'connected' ? 'var(--status-success)' : 
                  conn.status === 'error' ? 'var(--status-error)' : 
                  'var(--accent-primary)'
                } />
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-semibold text-[var(--ui-text-primary)] mb-0.5">
                  {conn.name}
                </div>
                <div className="text-[13px] text-[var(--ui-text-muted)]">{conn.host}</div>
                {conn.os && (
                  <div className="text-[12px] text-[var(--ui-text-secondary)] mt-1">
                    {conn.cpu} • {conn.memory} RAM • {conn.os}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <span 
                  className={`p-[4px_10px] rounded-md text-[12px] font-medium capitalize ${
                    conn.status === 'connected' ? 'bg-[var(--status-success-bg)] text-[var(--status-success)]' :
                    conn.status === 'error' ? 'bg-[var(--status-error-bg)] text-[var(--status-error)]' :
                    'bg-[var(--surface-hover)] text-[var(--ui-text-muted)]'
                  }`}
                >
                  {conn.status}
                </span>
                <button type="button"
                  onClick={() => handleTestConnection(conn.id)}
                  disabled={testingConnection === conn.id}
                  className="p-2 rounded-md border-none bg-[var(--surface-hover)] text-[var(--ui-text-secondary)] cursor-pointer"
                  title="Test Connection"
                >
                  {testingConnection === conn.id ? (
                    <Spinner size={18} className="animate-spin" />
                  ) : (
                    <ArrowsClockwise size={18} />
                  )}
                </button>
                <button type="button"
                  onClick={() => handleDeleteConnection(conn.id)}
                  className="p-2 rounded-md border-none bg-transparent text-[var(--ui-text-muted)] cursor-pointer"
                  title="Delete Connection"
                >
                  <Trash size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SSH Keys Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold m-0 text-[var(--ui-text-primary)]">
            SSH Keys
          </h3>
          <button type="button"
            onClick={loadSSHKeys}
            disabled={isLoadingSSHKeys}
            className="p-[6px_12px] rounded-md border border-solid border-[var(--ui-border-default)] bg-transparent text-[var(--ui-text-secondary)] text-[12px] cursor-pointer flex items-center gap-1"
          >
            <ArrowsClockwise size={12} className={isLoadingSSHKeys ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
        
        {errors.sshKeys && (
          <ErrorAlert message={errors.sshKeys} onRetry={loadSSHKeys} />
        )}
        
        {isLoadingSSHKeys ? (
          <LoadingState message="Loading SSH keys..." />
        ) : sshKeys.length === 0 ? (
          <div className="p-8 text-center text-[var(--ui-text-muted)] bg-[var(--surface-hover)] rounded-xl border border-dashed border-[var(--ui-border-default)]">
            <Key size={32} className="mb-2 opacity-50 mx-auto" />
            <div className="text-sm">No SSH keys configured</div>
          </div>
        ) : (
          <div className="bg-[var(--surface-hover)] rounded-xl border border-solid border-[var(--ui-border-muted)] overflow-hidden">
            {sshKeys.map((key, index) => (
              <div
                key={key.id}
                className={`p-[16px_20px] flex items-center justify-between ${index < sshKeys.length - 1 ? 'border-b border-solid border-[var(--ui-border-muted)]' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Key size={18} className="text-[#666]" />
                  <div>
                    <div className="text-sm font-medium text-[var(--ui-text-primary)]">
                      {key.name}
                    </div>
                    <div className="text-[12px] text-[var(--ui-text-muted)]">
                      {key.fingerprint} • Added {new Date(key.added_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <button type="button"
                  onClick={() => handleDeleteSSHKey(key.id)}
                  className="p-1.5 rounded-md border-none bg-transparent text-[var(--ui-text-muted)] cursor-pointer"
                >
                  <Trash size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderEnvironments = () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold m-[0_0_8px_0] text-[var(--ui-text-primary)]">
            Environment Templates
          </h2>
          <p className="text-sm text-[var(--ui-text-secondary)] m-0">
            Railway-style one-click environments. Devcontainers, Nix flakes, or sandbox VMs.
          </p>
        </div>
        <div className="flex gap-3">
          <button type="button"
            onClick={() => {
              setWizardInitialTemplate(undefined);
              setIsWizardOpen(true);
            }}
            className="p-[10px_20px] rounded-lg border-none bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-sm font-semibold cursor-pointer flex items-center gap-2"
          >
            <Plus size={18} />
            New Environment
          </button>
          <button type="button"
            onClick={loadEnvironments}
            disabled={isLoadingEnvironments || isLoadingTemplates}
            className="p-[8px_16px] rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent text-[var(--ui-text-secondary)] text-[13px] cursor-pointer flex items-center gap-1.5"
          >
            <ArrowsClockwise size={14} className={isLoadingEnvironments || isLoadingTemplates ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {errors.environments && (
        <ErrorAlert message={errors.environments} onRetry={loadEnvironments} />
      )}

      {/* Type Filters */}
      <div className="flex gap-2 flex-wrap">
        {ENV_TYPE_FILTERS.map(filter => (
          <button type="button"
            key={filter.id}
            onClick={() => setEnvFilter(filter.id as any)}
            className={`p-[8px_16px] rounded-full border border-solid text-[13px] font-medium cursor-pointer flex items-center gap-2 ${
              envFilter === filter.id 
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' 
                : 'border-[var(--ui-border-default)] bg-transparent text-[var(--ui-text-muted)]'
            }`}
          >
            <filter.icon size={14} />
            {filter.label}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      {isLoadingTemplates ? (
        <LoadingState message="Loading templates..." />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onClick={() => handleProvision(template.id)}
              isProvisioning={isProvisioning || !environmentProvisioningEnabled}
            />
          ))}
        </div>
      )}
      {!environmentProvisioningEnabled && environmentProvisioningReason && (
        <div className="mt-4 text-[13px] text-[var(--ui-text-muted)]">
          {environmentProvisioningReason}
        </div>
      )}

      {/* Provisioned Environments */}
      {environments.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold m-[0_0_16px_0] text-[var(--ui-text-primary)]">
            Provisioned Environments
          </h3>
          <div className="flex flex-col gap-3">
            {environments.map(env => (
              <EnvironmentRow
                key={env.id}
                environment={env}
                onDestroy={() => handleDestroyEnvironment(env.id)}
                isDestroying={destroyingEnvironment === env.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom Environment */}
      <div className="mt-8 p-6 bg-[var(--surface-hover)] rounded-xl border border-dashed border-[var(--ui-border-default)]">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-xl bg-[var(--surface-hover)] flex items-center justify-center">
            <Files size={24} className="text-[#666]" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold m-[0_0_4px_0] text-[var(--ui-text-primary)]">
              Custom Configuration
            </h3>
            <p className="text-sm text-[var(--ui-text-secondary)] m-0">
              Import devcontainer.json, flake.nix, or Dockerfile
            </p>
          </div>
          <button type="button"
            className="p-[10px_20px] rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent text-[var(--ui-text-primary)] text-sm cursor-pointer flex items-center gap-2"
          >
            <Plus size={16} />
            Import
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        <InfoCard
          icon={<Code size={24} className="text-[var(--accent-primary)]" />}
          title="Dev Containers"
          description="VS Code remote containers spec. Works with any IDE supporting the spec."
        />
        <InfoCard
          icon={<Cube size={24} className="text-[#7c3aed]" />}
          title="Nix Flakes"
          description="Reproducible, declarative environments. Pin exact dependency versions."
        />
        <InfoCard
          icon={<Shield size={24} className="text-[var(--status-success)]" />}
          title="Sandbox VMs"
          description="Isolated execution environments for agents. Docker, Kata, or Firecracker."
        />
      </div>
    </div>
  );

  const renderNodes = () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold m-[0_0_8px_0] text-[var(--ui-text-primary)]">
            Allternit Nodes
          </h2>
          <p className="text-sm text-[var(--ui-text-secondary)] m-0">
            Compute nodes running the Allternit agent runtime ({instances.length} from cloud, {connections.length} from VPS)
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button"
            onClick={loadDeployments}
            disabled={isLoadingDeployments}
            className="p-[8px_16px] rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent text-[var(--ui-text-secondary)] text-[13px] cursor-pointer flex items-center gap-1.5"
          >
            <ArrowsClockwise size={14} className={isLoadingDeployments ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('allternit:open-cloud-deploy'))}
            className="p-[10px_20px] rounded-lg border-none bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-sm font-semibold cursor-pointer flex items-center gap-2"
          >
            <Plus size={16} />
            Deploy Node
          </button>
        </div>
      </div>

      {errors.deployments && (
        <ErrorAlert message={errors.deployments} onRetry={loadDeployments} />
      )}

      {isLoadingDeployments ? (
        <LoadingState message="Loading nodes..." />
      ) : nodes.length === 0 ? (
        <EmptyState
          icon={<Cpu size={64} className="text-[#333]" />}
          title="No nodes installed"
          description="Deploy an Allternit node to the cloud or install on your connected VPS."
          action="Deploy Node"
          onAction={() => window.dispatchEvent(new CustomEvent('allternit:open-cloud-deploy'))}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {instances.map((instance) => (
            <div
              key={instance.id}
              className="bg-[var(--surface-hover)] rounded-xl p-[16px_20px] border border-solid border-[var(--ui-border-muted)]"
            >
              <div className="flex items-center gap-3.5 mb-3">
                <div className={`size-10 rounded-[10px] flex items-center justify-center ${
                  instance.status === 'running' ? 'bg-[var(--status-success-bg)]' : 'bg-[var(--status-error-bg)]'
                }`}>
                  <Cpu size={20} color={instance.status === 'running' ? 'var(--status-success)' : 'var(--status-error)'} />
                </div>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold text-[var(--ui-text-primary)]">{instance.name}</div>
                  <div className="text-[13px] text-[var(--ui-text-muted)]">
                    {instance.provider} • {instance.region} • Last seen {new Date(instance.last_seen).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`p-[4px_10px] rounded-md text-[12px] font-medium capitalize ${
                    instance.status === 'running' ? 'bg-[var(--status-success-bg)] text-[var(--status-success)]' : 'bg-[var(--status-error-bg)] text-[var(--status-error)]'
                  }`}>
                    {instance.status}
                  </span>
                  <button type="button"
                    onClick={() => handleDestroyInstance(instance.id)}
                    className="p-2 rounded-md border-none bg-transparent text-[var(--ui-text-muted)] cursor-pointer"
                    title="Destroy Instance"
                  >
                    <Trash size={18} />
                  </button>
                </div>
              </div>
              <div className="flex gap-4 ml-[54px] flex-wrap">
                <div className="flex items-center gap-1.5 text-[13px] text-[var(--ui-text-secondary)]">
                  <Cpu size={14} />
                  {instance.cpu} cores
                </div>
                <div className="flex items-center gap-1.5 text-[13px] text-[var(--ui-text-secondary)]">
                  <TreeStructure size={14} />
                  {Math.round(instance.ram / 1024)} GB
                </div>
                {instance.public_ip && (
                  <div className="flex items-center gap-1.5 text-[13px] text-[var(--ui-text-secondary)]">
                    <Globe size={14} />
                    {instance.public_ip}
                  </div>
                )}
                {instance.docker_available && (
                  <div className="flex items-center gap-1.5 text-[13px] text-[var(--status-success)]">
                    <AppWindow size={14} />
                    Docker Ready
                  </div>
                )}
                {instance.gpu_available && (
                  <div className="flex items-center gap-1.5 text-[13px] text-[#7c3aed]">
                    <Sparkle size={14} />
                    GPU
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-[13px] text-[var(--accent-primary)]">
                  <Wallet size={14} />
                  ${instance.cost_hr.toFixed(3)}/hr
                </div>
              </div>
            </div>
          ))}
          
          {/* VPS Connections as Nodes */}
          {connections.filter(c => c.status === 'connected').map((conn) => (
            <div
              key={`vps-${conn.id}`}
              className="bg-[var(--surface-hover)] rounded-xl p-[16px_20px] border border-solid border-[var(--ui-border-muted)]"
            >
              <div className="flex items-center gap-3.5 mb-3">
                <div className="size-10 rounded-[10px] bg-[var(--status-success-bg)] flex items-center justify-center">
                  <HardDrives size={20} className="text-[var(--status-success)]" />
                </div>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold text-[var(--ui-text-primary)]">{conn.name}</div>
                  <div className="text-[13px] text-[var(--ui-text-muted)]">
                    VPS Connection • {conn.host}
                  </div>
                </div>
                <span className="p-[4px_10px] rounded-md bg-[var(--status-success-bg)] text-[var(--status-success)] text-[12px] font-medium">
                  Connected
                </span>
              </div>
              <div className="flex gap-4 ml-[54px] flex-wrap">
                {conn.cpu && (
                  <div className="flex items-center gap-1.5 text-[13px] text-[var(--ui-text-secondary)]">
                    <Cpu size={14} />
                    {conn.cpu}
                  </div>
                )}
                {conn.memory && (
                  <div className="flex items-center gap-1.5 text-[13px] text-[var(--ui-text-secondary)]">
                    <TreeStructure size={14} />
                    {conn.memory}
                  </div>
                )}
                {conn.os && (
                  <div className="flex items-center gap-1.5 text-[13px] text-[var(--ui-text-secondary)]">
                    <Terminal size={14} />
                    {conn.os}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-[13px] text-[var(--status-success)]">
                  <AppWindow size={14} />
                  Docker Ready
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--surface-hover)] rounded-[10px] mb-6 w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: Pulse },
          { id: 'providers', label: 'Cloud Providers', icon: Cloud },
          { id: 'connections', label: 'VPS Connections', icon: HardDrives },
          { id: 'environments', label: 'Environments', icon: Package },
          { id: 'nodes', label: 'Nodes', icon: Cpu },
        ].map(tab => (
          <button type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`p-[8px_16px] rounded-lg border-none text-[13px] font-medium cursor-pointer flex items-center gap-2 transition-[var(--transition-fast)] ${
              activeTab === tab.id ? 'bg-[var(--ui-border-muted)] text-[var(--ui-text-primary)]' : 'bg-transparent text-[var(--ui-text-muted)]'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'providers' && renderProviders()}
        {activeTab === 'connections' && renderConnections()}
        {activeTab === 'environments' && renderEnvironments()}
        {activeTab === 'nodes' && renderNodes()}
      </div>
      
      {/* Environment Wizard Modal */}
      <EnvironmentWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        initialTemplateId={wizardInitialTemplate}
      />

      <ConfirmModal
        isOpen={confirmDialog !== null}
        title="Confirm"
        message={confirmDialog?.message || ''}
        confirmLabel="Confirm"
        destructive
        onConfirm={confirmDialog?.onConfirm || (() => {})}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatusCard({ title, value, icon, color, action, onAction, isLoading }: any) {
  return (
    <div className="bg-[var(--surface-hover)] rounded-xl p-5 border border-solid border-[var(--ui-border-muted)] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-[var(--ui-text-muted)]">{icon}</div>
        <button type="button"
          onClick={onAction}
          className="text-[12px] bg-transparent border-none cursor-pointer"
          style={{ color }}
        >
          {action}
        </button>
      </div>
      <div>
        <div className="text-[28px] font-semibold text-[var(--ui-text-primary)]">
          {isLoading ? <Spinner size={24} className="animate-spin" /> : value}
        </div>
        <div className="text-[13px] text-[var(--ui-text-secondary)]">{title}</div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, primary }: any) {
  return (
    <button type="button"
      onClick={onClick}
      className={`p-[12px_20px] rounded-[10px] text-sm font-medium cursor-pointer flex items-center gap-2 transition-[var(--transition-fast)] ${
        primary ? 'border-none bg-[var(--accent-primary)] text-[var(--ui-text-inverse)]' : 'border border-solid border-[var(--ui-border-default)] bg-[var(--surface-hover)] text-[var(--ui-text-primary)]'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ProviderCard({ provider, onDeploy, isDeploying }: any) {
  const isAvailable = provider.status === 'available';
  
  return (
    <div className={`bg-[var(--surface-hover)] rounded-2xl p-6 border border-solid border-[var(--ui-border-muted)] flex flex-col gap-4 ${isAvailable ? 'opacity-100' : 'opacity-60'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="size-11 rounded-[10px] flex items-center justify-center text-sm font-bold text-[var(--ui-text-primary)]"
            style={{
              background: provider.logo === 'hetzner' ? '#d50c2d' : 
                         provider.logo === 'digitalocean' ? '#0069ff' :
                         provider.logo === 'aws' ? '#ff9900' :
                         'var(--ui-border-default)',
            }}
          >
            {provider.name[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-[var(--ui-text-primary)]">{provider.name}</span>
              {provider.popular && (
                <span className="px-2 py-0.5 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[12px] font-semibold uppercase">
                  Popular
                </span>
              )}
            </div>
            <div className="text-[13px] text-[var(--ui-text-secondary)]">
              From {provider.currency}{provider.starting_price}/{provider.period}
            </div>
          </div>
        </div>
        <span className="px-2 py-1 rounded bg-[var(--surface-hover)] text-[var(--ui-text-muted)] text-[12px]">
          {provider.deploy_time}
        </span>
      </div>

      <p className="text-[14px] text-[var(--ui-text-muted)] m-0 leading-[1.5]">
        {provider.description}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {provider.features.map((feature: string) => (
          <span
            key={feature}
            className="px-2.5 py-1 rounded-lg bg-[var(--surface-hover)] text-[var(--ui-text-secondary)] text-[12px]"
          >
            {feature}
          </span>
        ))}
      </div>

      <div className="mt-auto flex gap-2">
        <a
          href={provider.signup_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 p-2.5 rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent text-[var(--ui-text-secondary)] text-[13px] text-center no-underline flex items-center justify-center gap-1.5"
        >
          <ArrowSquareOut size={14} />
          Website
        </a>
        <button type="button"
          onClick={onDeploy}
          disabled={!isAvailable || isDeploying}
          className={`flex-[2] p-2.5 rounded-lg border-none text-[13px] font-semibold flex items-center justify-center gap-1.5 ${
            isAvailable ? 'bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] cursor-pointer' : 'bg-[var(--ui-border-default)] text-[var(--ui-text-muted)] cursor-not-allowed'
          } ${isDeploying ? 'opacity-70' : 'opacity-100'}`}
        >
          {isDeploying ? (
            <>
              <Spinner size={14} className="animate-spin" />
              Deploying...
            </>
          ) : (
            <>
              <RocketLaunch size={14} />
              {isAvailable ? 'Deploy' : 'Coming Soon'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * TemplateCard displays an environment template with icon, name, description,
 * features list, and setup time. Clicking provisions the environment.
 */
function TemplateCard({ 
  template, 
  onClick, 
  isProvisioning 
}: { 
  template: EnvironmentTemplate; 
  onClick: () => void;
  isProvisioning?: boolean;
}) {
  const typeColors: Record<EnvironmentType, string> = {
    devcontainer: 'var(--accent-primary)',
    nix: '#7c3aed',
    sandbox: 'var(--status-success)',
    platform: 'var(--status-info)',
  };

  const typeLabels: Record<EnvironmentType, string> = {
    devcontainer: 'Dev Container',
    nix: 'Nix Flake',
    sandbox: 'Sandbox',
    platform: 'Platform',
  };

  const typeIcons: Record<EnvironmentType, React.ReactNode> = {
    devcontainer: <Code size={24} weight="duotone" />,
    nix: <Cube size={24} weight="duotone" />,
    sandbox: <Shield size={24} weight="duotone" />,
    platform: <RocketLaunch size={24} weight="duotone" />,
  };

  const tc = typeColors[template.type];

  return (
    <button type="button"
      onClick={onClick}
      disabled={isProvisioning}
      className={`bg-[var(--surface-hover)] rounded-xl p-5 border border-solid border-[var(--ui-border-muted)] text-left transition-[var(--transition-fast)] flex flex-col gap-3 ${
        isProvisioning ? 'cursor-not-allowed opacity-60' : 'cursor-pointer opacity-100 hover:bg-[var(--surface-hover)] hover:border-[var(--template-accent-40)]'
      }`}
      style={{
        '--template-accent-40': `${tc}40`
      } as React.CSSProperties}
    >
      <div className="flex items-start justify-between">
        <div 
          className="size-10 rounded-[10px] flex items-center justify-center bg-[var(--template-accent-10)]"
          style={{ 
            color: tc,
            '--template-accent-10': `${tc}10`
          } as React.CSSProperties}
        >
          {isProvisioning ? <Spinner size={24} className="animate-spin" /> : typeIcons[template.type]}
        </div>
        <span 
          className="px-2 py-1 rounded text-[12px] font-semibold uppercase bg-[var(--template-accent-15)]"
          style={{
            color: tc,
            '--template-accent-15': `${tc}15`,
          } as React.CSSProperties}
        >
          {typeLabels[template.type]}
        </span>
      </div>

      <div>
        <h4 className="text-[15px] font-semibold m-[0_0_6px_0] text-[var(--ui-text-primary)]">
          {template.name}
        </h4>
        <p className="text-[13px] text-[var(--ui-text-secondary)] m-0 leading-[1.4]">
          {template.description}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        {template.features.slice(0, 4).map((feature: string) => (
          <div key={feature} className="flex items-center gap-1.5 text-[12px] text-[var(--ui-text-muted)]">
            <Check size={12} className="text-[var(--status-success)]" />
            {feature}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-[12px] text-[var(--ui-text-muted)] mt-auto pt-2 border-t border-solid border-[var(--ui-border-muted)]">
        <ArrowsClockwise size={12} />
        {isProvisioning ? 'Provisioning...' : template.setupTime}
      </div>
    </button>
  );
}

function InfoCard({ icon, title, description }: any) {
  return (
    <div className="bg-[var(--surface-hover)] rounded-xl p-5 border border-solid border-[var(--ui-border-muted)]">
      <div className="mb-3">{icon}</div>
      <h4 className="text-[14px] font-semibold m-[0_0_6px_0] text-[var(--ui-text-primary)]">
        {title}
      </h4>
      <p className="text-[13px] text-[var(--ui-text-secondary)] m-0 leading-[1.5]">
        {description}
      </p>
    </div>
  );
}

function EmptyState({ icon, title, description, action, onAction }: any) {
  return (
    <div className="flex flex-col items-center justify-center p-[64px_32px] text-center">
      <div className="mb-6">{icon}</div>
      <h3 className="text-[18px] font-semibold m-[0_0_8px_0] text-[var(--ui-text-primary)]">{title}</h3>
      <p className="text-[14px] text-[var(--ui-text-muted)] m-[0_0_24px_0] max-w-[400px]">{description}</p>
      <button type="button"
        onClick={onAction}
        className="p-[10px_24px] rounded-lg border-none bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-sm font-semibold cursor-pointer"
      >
        {action}
      </button>
    </div>
  );
}

function ErrorAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-[var(--status-error-bg)] rounded-xl border border-solid border-[color-mix(in_srgb,var(--status-error)_20%,transparent)]">
      <WarningCircle size={20} className="text-[var(--status-error)]" />
      <div className="flex-1 text-[var(--status-error)] text-[14px]">
        {message}
      </div>
      <button type="button"
        onClick={onRetry}
        className="p-[8px_16px] rounded-lg border border-solid border-[color-mix(in_srgb,var(--status-error)_40%,transparent)] bg-transparent text-[var(--status-error)] text-[13px] cursor-pointer flex items-center gap-1.5"
      >
        <ArrowsClockwise size={14} />
        Retry
      </button>
    </div>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-[64px_32px] gap-4">
      <Spinner size={32} className="text-[#666] animate-spin" />
      <p className="text-[14px] text-[var(--ui-text-muted)] m-0">{message}</p>
    </div>
  );
}

function DeploymentRow({ deployment, onCancel }: { deployment: Deployment; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-[var(--surface-hover)] rounded-xl border border-solid border-[var(--ui-border-muted)]">
      <div className="size-10 rounded-[10px] bg-[var(--status-info-bg)] flex items-center justify-center">
        <RocketLaunch size={20} className="text-[var(--status-info)]" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-[var(--ui-text-primary)]">
          {deployment.instance_name}
        </div>
        <div className="text-[12px] text-[var(--ui-text-muted)]">
          {(deployment as any).provider_id || deployment.provider} • {deployment.status}
        </div>
        {deployment.message && (
          <div className="text-[12px] text-[var(--ui-text-secondary)] mt-1">
            {deployment.message}
          </div>
        )}
      </div>
      {(deployment.status as string) === 'pending' || (deployment.status as string) === 'provisioning' || (deployment.status as string) === 'configuring' ? (
        <button type="button"
          onClick={onCancel}
          className="p-[8px_16px] rounded-md border-none bg-[var(--status-error-bg)] text-[var(--status-error)] text-[13px] cursor-pointer"
        >
          Cancel
        </button>
      ) : (
        <span className={`p-[4px_10px] rounded-md text-[12px] font-medium capitalize ${
          (deployment.status as string) === 'running' ? 'bg-[var(--status-success-bg)] text-[var(--status-success)]' : 'bg-[var(--status-error-bg)] text-[var(--status-error)]'
        }`}>
          {deployment.status}
        </span>
      )}
    </div>
  );
}

/**
 * EnvironmentRow displays a provisioned environment with name, template type,
 * status indicator, URL if available, and destroy button.
 */
function EnvironmentRow({ 
  environment, 
  onDestroy, 
  isDestroying 
}: { 
  environment: Environment; 
  onDestroy: () => void;
  isDestroying: boolean;
}) {
  // Determine template type from environment or fallback
  const templateType = (environment.template_id?.split('-')[0] as EnvironmentTemplate['type']) || 'devcontainer';
  
  const typeColors: Record<EnvironmentType, string> & { [key: string]: string } = {
    devcontainer: 'var(--accent-primary)',
    nix: '#7c3aed',
    sandbox: 'var(--status-success)',
    platform: 'var(--status-info)',
  };

  const typeIcons: Record<EnvironmentType, React.ReactNode> & { [key: string]: React.ReactNode } = {
    devcontainer: <Code size={20} />,
    nix: <Cube size={20} />,
    sandbox: <Shield size={20} />,
    platform: <RocketLaunch size={20} />,
  };

  const tc = typeColors[templateType] || 'var(--ui-text-muted)';
  const TI = typeIcons[templateType] || <Package size={20} />;

  return (
    <div className="flex items-center gap-3 p-4 bg-[var(--surface-hover)] rounded-xl border border-solid border-[var(--ui-border-muted)]">
      <div 
        className="size-10 rounded-[10px] bg-[var(--type-bg)] flex items-center justify-center text-[var(--type-color)]"
        style={{
          '--type-bg': `${tc}20`,
          '--type-color': tc
        } as React.CSSProperties}
      >
        {TI}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-[var(--ui-text-primary)]">
          {environment.name}
        </div>
        <div className="text-[12px] text-[var(--ui-text-muted)] flex items-center gap-2">
          <span className="capitalize">{templateType}</span>
          <span>•</span>
          <span>Created {new Date(environment.created_at).toLocaleDateString()}</span>
        </div>
        {environment.url && (
          <a 
            href={environment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-[var(--status-info)] flex items-center gap-1 mt-1 no-underline"
          >
            <Globe size={12} />
            {environment.url}
            <ArrowSquareOut size={10} />
          </a>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={`p-[4px_10px] rounded-md text-[12px] font-medium capitalize flex items-center gap-1 ${
          environment.status === 'running' ? 'bg-[var(--status-success-bg)] text-[var(--status-success)]' : 
          environment.status === 'provisioning' ? 'bg-[var(--status-info-bg)] text-[var(--status-info)]' :
          'bg-[var(--status-error-bg)] text-[var(--status-error)]'
        }`}>
          {environment.status === 'provisioning' && <Spinner size={10} className="animate-spin" />}
          {environment.status}
        </span>
        <button type="button"
          onClick={onDestroy}
          disabled={isDestroying}
          className={`p-2 rounded-md border-none bg-transparent text-[var(--ui-text-muted)] transition-opacity ${
            isDestroying ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'
          }`}
          title="Destroy Environment"
        >
          {isDestroying ? <Spinner size={18} className="animate-spin" /> : <Trash size={18} />}
        </button>
      </div>
    </div>
  );
}

export default InfrastructureSettings;
