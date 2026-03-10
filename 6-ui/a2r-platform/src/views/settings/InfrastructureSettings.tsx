import React, { useState, useEffect, useCallback } from 'react';
import { 
  HardDrives, 
  Cloud, 
  Globe, 
  Key, 
  Plus, 
  Trash, 
  Check, 
  X,
  ArrowUpRight,
  Cpu,
  TreeStructure,
  Pulse,
  Terminal,
  ArrowSquareOut,
  CaretRight,
  Package,
  Stack,
  RocketLaunch,
  Shield,
  ArrowsClockwise,
  Play,
  Square,
  DotsThree,
  Wallet,
  MapPin,
  CheckCircle,
  Warning,
  NotePencil,
  House,
  PlugsConnected,
  Files,
  TerminalWindow,
  Copy,
  Gear,
  Flask,
  Database,
  Cube,
  Code,
  GitBranch,
  AppWindow,
  Robot,
  Sparkle,
  Brain,
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
import type { CloudProvider, Deployment, Provider, Region, InstanceType, Instance } from '@/api/infrastructure/cloud';
import type { EnvironmentTemplate, Environment, EnvironmentLogEntry, EnvironmentType } from '@/api/infrastructure/environments';
import type { SSHKey } from '@/api/infrastructure/ssh-keys';
import type { InfrastructureEvent } from '@/api/infrastructure/websocket';

// Import toast for notifications
import { useToast } from '../../hooks/use-toast';

// Import Environment Wizard
import { EnvironmentWizard } from '../../components/environments/EnvironmentWizard';

// =============================================================================
// CONSTANTS
// =============================================================================

// Local fallback templates when API is not available
const LOCAL_TEMPLATES: EnvironmentTemplate[] = [
  {
    id: 'node-dev',
    name: 'Node.js Development',
    type: 'devcontainer',
    description: 'Full-stack Node.js environment with TypeScript, pnpm, and common dev tools.',
    features: ['Node 20 LTS', 'TypeScript', 'pnpm', 'ESLint + Prettier', 'Git configured'],
    setupTime: '2 min',
    tags: ['node', 'javascript', 'typescript'],
    config: {
      devcontainer: {
        image: 'mcr.microsoft.com/devcontainers/javascript-node:20',
        features: ['ghcr.io/devcontainers/features/github-cli:1'],
        postCreateCommand: 'npm install -g pnpm typescript tsx',
      },
    },
  },
  {
    id: 'python-data',
    name: 'Python Data Science',
    type: 'devcontainer',
    description: 'Data science environment with Python, Jupyter, pandas, and ML libraries.',
    features: ['Python 3.12', 'JupyterLab', 'pandas', 'scikit-learn', 'matplotlib'],
    setupTime: '3 min',
    tags: ['python', 'data-science', 'ml'],
    config: {
      devcontainer: {
        image: 'mcr.microsoft.com/devcontainers/python:3.12',
        postCreateCommand: 'pip install jupyter pandas scikit-learn matplotlib',
      },
    },
  },
  {
    id: 'rust-dev',
    name: 'Rust Development',
    type: 'devcontainer',
    description: 'Rust environment with cargo, clippy, rust-analyzer support.',
    features: ['Rust 1.75+', 'cargo', 'clippy', 'rustfmt', 'rust-analyzer'],
    setupTime: '4 min',
    tags: ['rust', 'systems'],
    config: {
      devcontainer: {
        image: 'mcr.microsoft.com/devcontainers/rust:latest',
      },
    },
  },
  {
    id: 'nix-flakes',
    name: 'Nix Flakes',
    type: 'nix',
    description: 'Reproducible development environment using Nix flakes.',
    features: ['Nix package manager', 'Flakes support', 'Declarative config', 'Reproducible builds'],
    setupTime: '5 min',
    tags: ['nix', 'reproducible'],
    config: {
      nix: {
        packages: ['git', 'vim', 'curl'],
      },
    },
  },
  {
    id: 'docker-sandbox',
    name: 'Docker Sandbox',
    type: 'sandbox',
    description: 'Isolated Docker container environment for testing untrusted code.',
    features: ['Docker runtime', 'Resource limits', 'Network isolation', 'Ephemeral storage'],
    setupTime: '1 min',
    tags: ['docker', 'sandbox', 'security'],
    config: {
      sandbox: {
        runtime: 'docker',
        isolation: 'container',
        resources: { cpu: 2, memory: '4GB', disk: '20GB' },
      },
    },
  },
  {
    id: 'firecracker-vm',
    name: 'Firecracker MicroVM',
    type: 'sandbox',
    description: 'Lightweight microVM using AWS Firecracker for secure isolation.',
    features: ['Firecracker', 'MicroVM', 'Kernel isolation', 'Fast boot'],
    setupTime: '30 sec',
    tags: ['firecracker', 'vm', 'microvm'],
    config: {
      sandbox: {
        runtime: 'docker',
        isolation: 'microvm',
        resources: { cpu: 2, memory: '2GB', disk: '10GB' },
      },
    },
  },
  {
    id: 'a2r-platform',
    name: 'A2R Platform',
    type: 'devcontainer',
    description: 'Complete A2R development platform with all services pre-configured.',
    features: ['A2R Runtime', 'Agent Studio', 'Code Server', 'Vector DB', 'Redis'],
    setupTime: '8 min',
    tags: ['a2r', 'platform', 'full-stack'],
    config: {},
  },
];

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

export const InfrastructureSettings: React.FC = () => {
  const { addToast } = useToast();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'providers' | 'connections' | 'environments' | 'nodes'>('overview');
  
  // Data states
  const [connections, setConnections] = useState<VPSConnection[]>([]);
  const [providers, setProviders] = useState<CloudProvider[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [nodes, setNodes] = useState<DeployedNode[]>([]);
  const [sshKeys, setSshKeys] = useState<SSHKey[]>([]);
  const [templates, setTemplates] = useState<EnvironmentTemplate[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  
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
        setInstances(prev => 
          prev.map(i => i.id === instanceUpdate.id ? instanceUpdate : i)
        );
        // Update nodes from instances
        setNodes(prev => prev.map(node => {
          const inst = instances.find(i => i.id === node.id);
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
  }, [instances]);

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
      const data = await cloudApi.listProviders();
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
   * Load templates from API with fallback to local templates
   */
  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const data = await environmentApi.listTemplates();
      setTemplates(data);
    } catch (err: any) {
      // Fallback to local templates if API fails
      console.log('[InfrastructureSettings] API templates failed, using local fallback:', err.message);
      setTemplates(LOCAL_TEMPLATES);
      addToast({
        title: 'Using Local Templates',
        description: 'API unavailable. Displaying built-in environment templates.',
        type: 'warning',
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
      const envs = await environmentApi.list();
      setEnvironments(envs);
    } catch (err: any) {
      const message = err.message || 'Failed to load environments';
      setErrors(prev => ({ ...prev, environments: message }));
      // Don't show toast for this - environments might just be empty
      console.log('[InfrastructureSettings] Failed to load environments:', message);
    } finally {
      setIsLoadingEnvironments(false);
    }
  };

  /**
   * Combined load for environments tab
   */
  const loadEnvironmentTab = async () => {
    await Promise.all([
      loadTemplates(),
      loadEnvironments(),
    ]);
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

  const handleDeleteConnection = async (id: string) => {
    if (!confirm('Are you sure you want to delete this VPS connection?')) {
      return;
    }
    try {
      await vpsApi.delete(id);
      addToast({
        title: 'Success',
        description: 'VPS connection deleted',
        type: 'success',
      });
      await loadVPSConnections();
    } catch (err: any) {
      addToast({
        title: 'Error',
        description: err.message || 'Failed to delete connection',
        type: 'error',
      });
    }
  };

  const handleDeploy = async (providerId: string) => {
    setDeployingProvider(providerId);
    try {
      // Open cloud deploy modal with selected provider
      window.dispatchEvent(new CustomEvent('a2r:open-cloud-deploy', { 
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

  const handleDeleteSSHKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this SSH key?')) {
      return;
    }
    try {
      await sshKeyApi.delete(id);
      addToast({
        title: 'Success',
        description: 'SSH key deleted',
        type: 'success',
      });
      await loadSSHKeys();
    } catch (err: any) {
      addToast({
        title: 'Error',
        description: err.message || 'Failed to delete SSH key',
        type: 'error',
      });
    }
  };

  /**
   * Handle provisioning a new environment from a template
   */
  const handleProvision = async (templateId: string) => {
    setIsProvisioning(true);
    try {
      const template = templates.find(t => t.id === templateId);
      const name = `${template?.name || 'Environment'} ${new Date().toISOString().slice(0, 10)}`;
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

  const handleDestroyEnvironment = async (id: string) => {
    if (!confirm('Are you sure you want to destroy this environment? This action cannot be undone.')) {
      return;
    }
    setDestroyingEnvironment(id);
    try {
      await environmentApi.destroy(id);
      addToast({
        title: 'Success',
        description: 'Environment destroyed',
        type: 'success',
      });
      await loadEnvironments();
    } catch (err: any) {
      addToast({
        title: 'Error',
        description: err.message || 'Failed to destroy environment',
        type: 'error',
      });
    } finally {
      setDestroyingEnvironment(null);
    }
  };

  const handleDestroyInstance = async (id: string) => {
    if (!confirm('Are you sure you want to destroy this instance? This action cannot be undone.')) {
      return;
    }
    try {
      await cloudApi.destroyInstance(id);
      addToast({
        title: 'Success',
        description: 'Instance destroyed',
        type: 'success',
      });
      await loadDeployments();
    } catch (err: any) {
      addToast({
        title: 'Error',
        description: err.message || 'Failed to destroy instance',
        type: 'error',
      });
    }
  };

  // =============================================================================
  // EFFECTS
  // =============================================================================

  useEffect(() => {
    // Load all data on mount
    loadVPSConnections();
    loadProviders();
    loadDeployments();
    loadEnvironments();
    loadSSHKeys();
    
    // Setup WebSocket for real-time updates
    const ws = new InfrastructureWebSocket();
    ws.onEvent(handleWebSocketEvent);
    ws.connect();
    
    return () => {
      ws.disconnect();
    };
  }, [handleWebSocketEvent]);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <StatusCard
          title="Connected VPS"
          value={connections.length}
          icon={<HardDrives size={20} />}
          color="#22c55e"
          action="Manage"
          onAction={() => setActiveTab('connections')}
          isLoading={isLoadingVPS}
        />
        <StatusCard
          title="Active Nodes"
          value={nodes.filter(n => n.status === 'online').length}
          icon={<Cpu size={20} />}
          color="#3b82f6"
          action="View"
          onAction={() => setActiveTab('nodes')}
          isLoading={isLoadingDeployments}
        />
        <StatusCard
          title="Environments"
          value={environments.filter(e => e.status === 'running').length}
          icon={<Package size={20} />}
          color="#d4b08c"
          action="Browse"
          onAction={() => setActiveTab('environments')}
          isLoading={isLoadingEnvironments}
        />
      </div>

      {/* Quick Actions */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0', color: '#fff' }}>
          Quick Actions
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
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
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0', color: '#fff' }}>
          Recent Activity
        </h3>
        {deployments.length === 0 && environments.length === 0 ? (
          <EmptyState
            icon={<HardDrives size={48} color="#333" />}
            title="No infrastructure connected"
            description="Deploy to a cloud provider or connect your VPS to get started."
            action="Get Started"
            onAction={() => setActiveTab('providers')}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[...deployments.slice(0, 3), ...environments.slice(0, 3)]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 5)
              .map((item, idx) => (
                <div key={idx} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '8px',
                }}>
                  <div style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%',
                    background: 'instance_name' in item ? '#3b82f6' : '#22c55e',
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', color: '#fff' }}>
                      {'instance_name' in item ? `Deployed ${item.instance_name}` : `Created ${(item as Environment).name}`}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '600', margin: '0 0 8px 0', color: '#fff' }}>
            Cloud Providers
          </h2>
          <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>
            Deploy A2R nodes to your preferred cloud provider
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={loadProviders}
            disabled={isLoadingProviders}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: '#888',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {providers.map(provider => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onDeploy={() => handleDeploy(provider.id)}
                isDeploying={deployingProvider === provider.id}
              />
            ))}
          </div>

          {/* Deployments Section */}
          {deployments.length > 0 && (
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 16px 0', color: '#fff' }}>
                Active Deployments
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
      <div style={{
        marginTop: '32px',
        padding: '24px',
        background: 'linear-gradient(135deg, rgba(212,176,140,0.05) 0%, transparent 100%)',
        borderRadius: '12px',
        border: '1px solid rgba(212,176,140,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(212,176,140,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <HardDrives size={24} color="#d4b08c" />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 4px 0', color: '#fff' }}>
              Bring Your Own Server
            </h3>
            <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>
              Already have a VPS? Connect it to A2R in minutes.
            </p>
          </div>
        </div>
        <button
          onClick={() => setActiveTab('connections')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: '1px solid #d4b08c',
            background: 'rgba(212,176,140,0.1)',
            color: '#d4b08c',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Plus size={16} />
          Connect Existing VPS
        </button>
      </div>
    </div>
  );

  const renderConnections = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '600', margin: '0 0 8px 0', color: '#fff' }}>
            VPS Connections
          </h2>
          <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>
            Manage your connected servers and their status
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={loadVPSConnections}
            disabled={isLoadingVPS}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: '#888',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowsClockwise size={14} className={isLoadingVPS ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('a2r:open-vps-panel'));
            }}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: '#d4b08c',
              color: '#0a0a0a',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
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
          icon={<HardDrives size={64} color="#333" />}
          title="No VPS connections"
          description="Connect your existing VPS to manage it through A2R."
          action="Connect VPS"
          onAction={() => window.dispatchEvent(new CustomEvent('a2r:open-vps-panel'))}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {connections.map((conn) => (
            <div
              key={conn.id}
              style={{
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '12px',
                padding: '16px 20px',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: conn.status === 'connected' ? 'rgba(34,197,94,0.1)' : 
                           conn.status === 'error' ? 'rgba(239,68,68,0.1)' : 
                           'rgba(212,176,140,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <HardDrives size={22} color={
                  conn.status === 'connected' ? '#22c55e' : 
                  conn.status === 'error' ? '#ef4444' : 
                  '#d4b08c'
                } />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#fff', marginBottom: '2px' }}>
                  {conn.name}
                </div>
                <div style={{ fontSize: '13px', color: '#666' }}>{conn.host}</div>
                {conn.os && (
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                    {conn.cpu} • {conn.memory} RAM • {conn.os}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: conn.status === 'connected' ? 'rgba(34,197,94,0.1)' :
                             conn.status === 'error' ? 'rgba(239,68,68,0.1)' :
                             'rgba(255,255,255,0.05)',
                  color: conn.status === 'connected' ? '#22c55e' :
                         conn.status === 'error' ? '#ef4444' :
                         '#888',
                  fontSize: '12px',
                  fontWeight: '500',
                  textTransform: 'capitalize',
                }}>
                  {conn.status}
                </span>
                <button
                  onClick={() => handleTestConnection(conn.id)}
                  disabled={testingConnection === conn.id}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#888',
                    cursor: 'pointer',
                  }}
                  title="Test Connection"
                >
                  {testingConnection === conn.id ? (
                    <Spinner size={18} className="animate-spin" />
                  ) : (
                    <ArrowsClockwise size={18} />
                  )}
                </button>
                <button
                  onClick={() => handleDeleteConnection(conn.id)}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    color: '#666',
                    cursor: 'pointer',
                  }}
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
      <div style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#fff' }}>
            SSH Keys
          </h3>
          <button
            onClick={loadSSHKeys}
            disabled={isLoadingSSHKeys}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: '#888',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
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
          <div style={{
            padding: '32px',
            textAlign: 'center',
            color: '#666',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '12px',
            border: '1px dashed rgba(255,255,255,0.1)',
          }}>
            <Key size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <div style={{ fontSize: '14px' }}>No SSH keys configured</div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}>
            {sshKeys.map((key, index) => (
              <div
                key={key.id}
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: index < sshKeys.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Key size={18} color="#666" />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#fff' }}>
                      {key.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {key.fingerprint} • Added {new Date(key.added_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteSSHKey(key.id)}
                  style={{
                    padding: '6px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    color: '#666',
                    cursor: 'pointer',
                  }}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '600', margin: '0 0 8px 0', color: '#fff' }}>
            Environment Templates
          </h2>
          <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>
            Railway-style one-click environments. Devcontainers, Nix flakes, or sandbox VMs.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => {
              setWizardInitialTemplate(undefined);
              setIsWizardOpen(true);
            }}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: '#d4b08c',
              color: '#0a0a0a',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Plus size={18} />
            New Environment
          </button>
          <button
            onClick={loadEnvironments}
            disabled={isLoadingEnvironments || isLoadingTemplates}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: '#888',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
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
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
      }}>
        {ENV_TYPE_FILTERS.map(filter => (
          <button
            key={filter.id}
            onClick={() => setEnvFilter(filter.id as any)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: '1px solid',
              borderColor: envFilter === filter.id ? '#d4b08c' : 'rgba(255,255,255,0.1)',
              background: envFilter === filter.id ? 'rgba(212,176,140,0.1)' : 'transparent',
              color: envFilter === filter.id ? '#d4b08c' : '#888',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onClick={() => handleProvision(template.id)}
              isProvisioning={isProvisioning}
            />
          ))}
        </div>
      )}

      {/* Provisioned Environments */}
      {environments.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 16px 0', color: '#fff' }}>
            Provisioned Environments
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
      <div style={{
        marginTop: '32px',
        padding: '24px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '12px',
        border: '1px dashed rgba(255,255,255,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Files size={24} color="#666" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0', color: '#fff' }}>
              Custom Configuration
            </h3>
            <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>
              Import devcontainer.json, flake.nix, or Dockerfile
            </p>
          </div>
          <button
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: '#fff',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Plus size={16} />
            Import
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '16px' }}>
        <InfoCard
          icon={<Code size={24} color="#d4b08c" />}
          title="Dev Containers"
          description="VS Code remote containers spec. Works with any IDE supporting the spec."
        />
        <InfoCard
          icon={<Cube size={24} color="#7c3aed" />}
          title="Nix Flakes"
          description="Reproducible, declarative environments. Pin exact dependency versions."
        />
        <InfoCard
          icon={<Shield size={24} color="#22c55e" />}
          title="Sandbox VMs"
          description="Isolated execution environments for agents. Docker, Kata, or Firecracker."
        />
      </div>
    </div>
  );

  const renderNodes = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '600', margin: '0 0 8px 0', color: '#fff' }}>
            A2R Nodes
          </h2>
          <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>
            Compute nodes running the A2R agent runtime ({instances.length} from cloud, {connections.length} from VPS)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={loadDeployments}
            disabled={isLoadingDeployments}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: '#888',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowsClockwise size={14} className={isLoadingDeployments ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('a2r:open-cloud-deploy'))}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: '#d4b08c',
              color: '#0a0a0a',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
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
          icon={<Cpu size={64} color="#333" />}
          title="No nodes installed"
          description="Deploy an A2R node to the cloud or install on your connected VPS."
          action="Deploy Node"
          onAction={() => window.dispatchEvent(new CustomEvent('a2r:open-cloud-deploy'))}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {instances.map((instance) => (
            <div
              key={instance.id}
              style={{
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '12px',
                padding: '16px 20px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: instance.status === 'running' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Cpu size={20} color={instance.status === 'running' ? '#22c55e' : '#ef4444'} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#fff' }}>{instance.name}</div>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    {instance.provider} • {instance.region} • Last seen {new Date(instance.last_seen).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: instance.status === 'running' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    color: instance.status === 'running' ? '#22c55e' : '#ef4444',
                    fontSize: '12px',
                    fontWeight: '500',
                    textTransform: 'capitalize',
                  }}>
                    {instance.status}
                  </span>
                  <button
                    onClick={() => handleDestroyInstance(instance.id)}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'transparent',
                      color: '#666',
                      cursor: 'pointer',
                    }}
                    title="Destroy Instance"
                  >
                    <Trash size={18} />
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginLeft: '54px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888' }}>
                  <Cpu size={14} />
                  {instance.cpu} cores
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888' }}>
                  <TreeStructure size={14} />
                  {Math.round(instance.ram / 1024)} GB
                </div>
                {instance.public_ip && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888' }}>
                    <Globe size={14} />
                    {instance.public_ip}
                  </div>
                )}
                {instance.docker_available && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#22c55e' }}>
                    <AppWindow size={14} />
                    Docker Ready
                  </div>
                )}
                {instance.gpu_available && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#7c3aed' }}>
                    <Sparkle size={14} />
                    GPU
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#d4b08c' }}>
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
              style={{
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '12px',
                padding: '16px 20px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(34,197,94,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <HardDrives size={20} color="#22c55e" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#fff' }}>{conn.name}</div>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    VPS Connection • {conn.host}
                  </div>
                </div>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(34,197,94,0.1)',
                  color: '#22c55e',
                  fontSize: '12px',
                  fontWeight: '500',
                }}>
                  Connected
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginLeft: '54px', flexWrap: 'wrap' }}>
                {conn.cpu && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888' }}>
                    <Cpu size={14} />
                    {conn.cpu}
                  </div>
                )}
                {conn.memory && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888' }}>
                    <TreeStructure size={14} />
                    {conn.memory}
                  </div>
                )}
                {conn.os && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888' }}>
                    <Terminal size={14} />
                    {conn.os}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#22c55e' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '4px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '10px',
        marginBottom: '24px',
        width: 'fit-content',
      }}>
        {[
          { id: 'overview', label: 'Overview', icon: Pulse },
          { id: 'providers', label: 'Cloud Providers', icon: Cloud },
          { id: 'connections', label: 'VPS Connections', icon: HardDrives },
          { id: 'environments', label: 'Environments', icon: Package },
          { id: 'nodes', label: 'Nodes', icon: Cpu },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === tab.id ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : '#888',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
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
    </div>
  );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatusCard({ title, value, icon, color, action, onAction, isLoading }: any) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: '#666' }}>{icon}</div>
        <button
          onClick={onAction}
          style={{
            fontSize: '12px',
            color: color,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {action}
        </button>
      </div>
      <div>
        <div style={{ fontSize: '28px', fontWeight: '600', color: '#fff' }}>
          {isLoading ? <Spinner size={24} className="animate-spin" /> : value}
        </div>
        <div style={{ fontSize: '13px', color: '#888' }}>{title}</div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, primary }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 20px',
        borderRadius: '10px',
        border: primary ? 'none' : '1px solid rgba(255,255,255,0.1)',
        background: primary ? '#d4b08c' : 'rgba(255,255,255,0.05)',
        color: primary ? '#0a0a0a' : '#fff',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function ProviderCard({ provider, onDeploy, isDeploying }: any) {
  const isAvailable = provider.status === 'available';
  
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid rgba(255,255,255,0.06)',
      opacity: isAvailable ? 1 : 0.6,
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: provider.logo === 'hetzner' ? '#d50c2d' : 
                       provider.logo === 'digitalocean' ? '#0069ff' :
                       provider.logo === 'aws' ? '#ff9900' :
                       'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#fff',
          }}>
            {provider.name[0]}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#fff' }}>{provider.name}</span>
              {provider.popular && (
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(212,176,140,0.2)',
                  color: '#d4b08c',
                  fontSize: '10px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                }}>
                  Popular
                </span>
              )}
            </div>
            <div style={{ fontSize: '13px', color: '#888' }}>
              From {provider.currency}{provider.starting_price}/{provider.period}
            </div>
          </div>
        </div>
        <span style={{
          padding: '4px 8px',
          borderRadius: '4px',
          background: 'rgba(255,255,255,0.05)',
          color: '#666',
          fontSize: '11px',
        }}>
          {provider.deploy_time}
        </span>
      </div>

      <p style={{ fontSize: '14px', color: '#aaa', margin: 0, lineHeight: '1.5' }}>
        {provider.description}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {provider.features.map((feature: string) => (
          <span
            key={feature}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.05)',
              color: '#888',
              fontSize: '12px',
            }}
          >
            {feature}
          </span>
        ))}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
        <a
          href={provider.signup_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent',
            color: '#888',
            fontSize: '13px',
            textAlign: 'center',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <ArrowSquareOut size={14} />
          Website
        </a>
        <button
          onClick={onDeploy}
          disabled={!isAvailable || isDeploying}
          style={{
            flex: 2,
            padding: '10px',
            borderRadius: '8px',
            border: 'none',
            background: isAvailable ? '#d4b08c' : 'rgba(255,255,255,0.1)',
            color: isAvailable ? '#0a0a0a' : '#666',
            fontSize: '13px',
            fontWeight: '600',
            cursor: isAvailable && !isDeploying ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            opacity: isDeploying ? 0.7 : 1,
          }}
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
    devcontainer: '#d4b08c',
    nix: '#7c3aed',
    sandbox: '#22c55e',
    platform: '#3b82f6',
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

  return (
    <button
      onClick={onClick}
      disabled={isProvisioning}
      style={{
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid rgba(255,255,255,0.06)',
        textAlign: 'left',
        cursor: isProvisioning ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        opacity: isProvisioning ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isProvisioning) {
          e.currentTarget.style.borderColor = `${typeColors[template.type]}40`;
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ 
          color: typeColors[template.type],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: `${typeColors[template.type]}10`,
        }}>
          {isProvisioning ? <Spinner size={24} className="animate-spin" /> : typeIcons[template.type]}
        </div>
        <span style={{
          padding: '4px 8px',
          borderRadius: '4px',
          background: `${typeColors[template.type]}15`,
          color: typeColors[template.type],
          fontSize: '10px',
          fontWeight: '600',
          textTransform: 'uppercase',
        }}>
          {typeLabels[template.type]}
        </span>
      </div>

      <div>
        <h4 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 6px 0', color: '#fff' }}>
          {template.name}
        </h4>
        <p style={{ fontSize: '13px', color: '#888', margin: 0, lineHeight: '1.4' }}>
          {template.description}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {template.features.slice(0, 4).map((feature: string) => (
          <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#666' }}>
            <Check size={12} color="#22c55e" />
            {feature}
          </div>
        ))}
      </div>

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px', 
        fontSize: '12px', 
        color: '#555',
        marginTop: 'auto',
        paddingTop: '8px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        <ArrowsClockwise size={12} />
        {isProvisioning ? 'Provisioning...' : template.setupTime}
      </div>
    </button>
  );
}

function InfoCard({ icon, title, description }: any) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ marginBottom: '12px' }}>{icon}</div>
      <h4 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 6px 0', color: '#fff' }}>
        {title}
      </h4>
      <p style={{ fontSize: '13px', color: '#888', margin: 0, lineHeight: '1.5' }}>
        {description}
      </p>
    </div>
  );
}

function EmptyState({ icon, title, description, action, onAction }: any) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '64px 32px',
      textAlign: 'center',
    }}>
      <div style={{ marginBottom: '24px' }}>{icon}</div>
      <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0', color: '#fff' }}>{title}</h3>
      <p style={{ fontSize: '14px', color: '#666', margin: '0 0 24px 0', maxWidth: '400px' }}>{description}</p>
      <button
        onClick={onAction}
        style={{
          padding: '10px 24px',
          borderRadius: '8px',
          border: 'none',
          background: '#d4b08c',
          color: '#0a0a0a',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
        }}
      >
        {action}
      </button>
    </div>
  );
}

function ErrorAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '16px',
      background: 'rgba(239,68,68,0.1)',
      borderRadius: '12px',
      border: '1px solid rgba(239,68,68,0.2)',
    }}>
      <WarningCircle size={20} color="#ef4444" />
      <div style={{ flex: 1, color: '#ef4444', fontSize: '14px' }}>
        {message}
      </div>
      <button
        onClick={onRetry}
        style={{
          padding: '8px 16px',
          borderRadius: '6px',
          border: '1px solid rgba(239,68,68,0.3)',
          background: 'transparent',
          color: '#ef4444',
          fontSize: '13px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <ArrowsClockwise size={14} />
        Retry
      </button>
    </div>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '64px 32px',
      gap: '16px',
    }}>
      <Spinner size={32} color="#666" className="animate-spin" />
      <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>{message}</p>
    </div>
  );
}

function DeploymentRow({ deployment, onCancel }: { deployment: Deployment; onCancel: () => void }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '16px',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        background: 'rgba(59,130,246,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <RocketLaunch size={20} color="#3b82f6" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: '500', color: '#fff' }}>
          {deployment.instance_name}
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          {(deployment as any).provider_id || deployment.provider} • {deployment.status}
        </div>
        {deployment.message && (
          <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
            {deployment.message}
          </div>
        )}
      </div>
      {(deployment.status as string) === 'pending' || (deployment.status as string) === 'provisioning' || (deployment.status as string) === 'configuring' ? (
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: 'rgba(239,68,68,0.1)',
            color: '#ef4444',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      ) : (
        <span style={{
          padding: '4px 10px',
          borderRadius: '6px',
          background: (deployment.status as string) === 'running' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          color: (deployment.status as string) === 'running' ? '#22c55e' : '#ef4444',
          fontSize: '12px',
          fontWeight: '500',
          textTransform: 'capitalize',
        }}>
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
    devcontainer: '#d4b08c',
    nix: '#7c3aed',
    sandbox: '#22c55e',
    platform: '#3b82f6',
  };

  const typeIcons: Record<EnvironmentType, React.ReactNode> & { [key: string]: React.ReactNode } = {
    devcontainer: <Code size={20} />,
    nix: <Cube size={20} />,
    sandbox: <Shield size={20} />,
    platform: <RocketLaunch size={20} />,
  };

  const typeColor = typeColors[templateType] || '#888';
  const typeIcon = typeIcons[templateType] || <Package size={20} />;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '16px',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        background: `${typeColor}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: typeColor,
      }}>
        {typeIcon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: '500', color: '#fff' }}>
          {environment.name}
        </div>
        <div style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ textTransform: 'capitalize' }}>{templateType}</span>
          <span>•</span>
          <span>Created {new Date(environment.created_at).toLocaleDateString()}</span>
        </div>
        {environment.url && (
          <a 
            href={environment.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ 
              fontSize: '12px', 
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '4px',
              textDecoration: 'none',
            }}
          >
            <Globe size={12} />
            {environment.url}
            <ArrowSquareOut size={10} />
          </a>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          padding: '4px 10px',
          borderRadius: '6px',
          background: environment.status === 'running' ? 'rgba(34,197,94,0.1)' : 
                     environment.status === 'provisioning' ? 'rgba(59,130,246,0.1)' :
                     'rgba(239,68,68,0.1)',
          color: environment.status === 'running' ? '#22c55e' : 
                 environment.status === 'provisioning' ? '#3b82f6' :
                 '#ef4444',
          fontSize: '12px',
          fontWeight: '500',
          textTransform: 'capitalize',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          {environment.status === 'provisioning' && <Spinner size={10} className="animate-spin" />}
          {environment.status}
        </span>
        <button
          onClick={onDestroy}
          disabled={isDestroying}
          style={{
            padding: '8px',
            borderRadius: '6px',
            border: 'none',
            background: 'transparent',
            color: '#666',
            cursor: isDestroying ? 'not-allowed' : 'pointer',
            opacity: isDestroying ? 0.5 : 1,
          }}
          title="Destroy Environment"
        >
          {isDestroying ? <Spinner size={18} className="animate-spin" /> : <Trash size={18} />}
        </button>
      </div>
    </div>
  );
}

export default InfrastructureSettings;
