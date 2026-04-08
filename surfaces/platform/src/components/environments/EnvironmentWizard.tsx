/**
 * Environment Setup Wizard
 * 
 * A2R-native wizard for creating and provisioning development environments.
 * Features:
 * - 4-step guided creation (Template Selection, Configuration, Target Selection, Review & Deploy)
 * - Template library with search and filtering
 * - Dynamic form generation based on template variables
 * - Target selection (Local Docker, VPS, Cloud)
 * - Real-time deployment logs
 * - Dark theme with A2R styling
 * 
 * @module EnvironmentWizard
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cube,
  MagnifyingGlass,
  Funnel,
  Check,
  CaretRight,
  CaretLeft,
  HardDrives,
  Cloud,
  Cpu,
  HardDrive,
  Globe,
  Terminal,
  GearSix,
  Warning,
  CheckCircle,
  XCircle,
  CircleNotch,
  Clock,
  Lightning,
  Shield,
  Code,
  Database,
  Layout,
  Sparkle,
  X,
  Eye,
  EyeSlash,
  Copy,
  ArrowSquareOut,
  ArrowsClockwise,
} from '@phosphor-icons/react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  environmentApi, 
  vpsApi,
} from '@/api/infrastructure/index';
import type { EnvironmentTemplate, Environment, EnvironmentLogEntry } from '@/api/infrastructure/environments';
import type { VPSConnection } from '@/api/infrastructure/vps';

// New enhanced components
import { PreFlightCheck } from './PreFlightCheck';
import { TemplatePreview } from './TemplatePreview';
import { CostEstimator } from './CostEstimator';

// ============================================================================
// Types
// ============================================================================

export interface EnvironmentWizardProps {
  isOpen: boolean;
  onClose: () => void;
  initialTemplateId?: string;
  onSuccess?: (environment: Environment) => void;
}

interface WizardState {
  step: 1 | 2 | 3 | 4;
  selectedTemplate: EnvironmentTemplate | null;
  config: Record<string, any>;
  target: 'local' | 'vps' | 'cloud';
  vpsId?: string;
  cloudProvider?: string;
  isDeploying: boolean;
  deploymentId?: string;
  logs: string[];
  deployStatus: 'idle' | 'deploying' | 'success' | 'error';
  deployError?: string;
  preFlightPassed: boolean;
  preFlightIssues: string[];
}

interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'secret';
  label: string;
  description?: string;
  default?: any;
  options?: { label: string; value: string }[];
  required?: boolean;
}

// ============================================================================
// Default Templates (Fallback)
// ============================================================================

const defaultTemplates: EnvironmentTemplate[] = [
  {
    id: 'allternit-platform-dev',
    name: 'A2R Platform Dev',
    type: 'devcontainer',
    description: 'Complete A2R platform development environment with all services pre-configured',
    icon: 'sparkles',
    features: ['Node.js 20', 'Rust', 'Python', 'Docker', 'PostgreSQL', 'Redis'],
    setupTime: '3 minutes',
    tags: ['official', 'fullstack'],
    defaultPorts: [3000, 8787, 5432, 6379],
    preinstalledTools: ['git', 'gh', 'cargo', 'pnpm', 'python3', 'docker'],
    resourceRequirements: {
      minMemory: '4GB',
      minCpu: 2,
      recommendedDisk: '20GB',
    },
    config: {
      devcontainer: {
        image: 'mcr.microsoft.com/devcontainers/typescript-node:20',
        features: ['ghcr.io/devcontainers/features/docker-in-docker:2'],
      },
    },
  },
  {
    id: 'a2r-agent-workspace',
    name: 'A2R Agent Workspace',
    type: 'devcontainer',
    description: 'Lightweight environment for agent development and testing',
    icon: 'bot',
    features: ['Node.js 20', 'Python 3.11', 'Agent SDK', 'Test Framework'],
    setupTime: '2 minutes',
    tags: ['official', 'agent'],
    defaultPorts: [3000, 8080],
    preinstalledTools: ['git', 'node', 'python3', 'pip'],
    resourceRequirements: {
      minMemory: '2GB',
      minCpu: 1,
      recommendedDisk: '10GB',
    },
    config: {
      devcontainer: {
        image: 'mcr.microsoft.com/devcontainers/python:3.11',
      },
    },
  },
  {
    id: 'nodejs-typescript',
    name: 'Node.js + TypeScript',
    type: 'devcontainer',
    description: 'Modern Node.js development with TypeScript support',
    icon: 'code',
    features: ['Node.js 20', 'TypeScript', 'ESLint', 'Prettier', 'Jest'],
    setupTime: '1 minute',
    tags: ['nodejs', 'web'],
    defaultPorts: [3000, 8080],
    preinstalledTools: ['node', 'npm', 'pnpm', 'yarn'],
    resourceRequirements: {
      minMemory: '1GB',
      minCpu: 1,
      recommendedDisk: '5GB',
    },
    config: {
      devcontainer: {
        image: 'mcr.microsoft.com/devcontainers/typescript-node:20',
      },
    },
  },
  {
    id: 'python-ml',
    name: 'Python ML/Data Science',
    type: 'devcontainer',
    description: 'Data science environment with PyTorch, TensorFlow, and Jupyter',
    icon: 'brain',
    features: ['Python 3.11', 'PyTorch', 'TensorFlow', 'Jupyter', 'Pandas', 'NumPy'],
    setupTime: '4 minutes',
    tags: ['python', 'ml', 'data-science'],
    defaultPorts: [8888, 6006, 5000],
    preinstalledTools: ['python3', 'pip', 'jupyter', 'conda'],
    resourceRequirements: {
      minMemory: '8GB',
      minCpu: 4,
      recommendedDisk: '50GB',
    },
    config: {
      devcontainer: {
        image: 'mcr.microsoft.com/devcontainers/python:3.11',
        features: ['ghcr.io/devcontainers/features/nvidia-cuda:1'],
      },
    },
  },
  {
    id: 'rust-systems',
    name: 'Rust Systems Programming',
    type: 'devcontainer',
    description: 'Rust development environment with cargo and common tools',
    icon: 'cpu',
    features: ['Rust 1.75+', 'Cargo', 'Clippy', 'Rustfmt', 'VS Code extensions'],
    setupTime: '2 minutes',
    tags: ['rust', 'systems'],
    defaultPorts: [8080],
    preinstalledTools: ['rustc', 'cargo', 'rustfmt', 'clippy'],
    resourceRequirements: {
      minMemory: '2GB',
      minCpu: 2,
      recommendedDisk: '10GB',
    },
    config: {
      devcontainer: {
        image: 'mcr.microsoft.com/devcontainers/rust:latest',
      },
    },
  },
  {
    id: 'fullstack-web',
    name: 'Fullstack Web',
    type: 'devcontainer',
    description: 'Complete web development stack with frontend and backend tools',
    icon: 'globe',
    features: ['Node.js 20', 'React', 'Next.js', 'PostgreSQL', 'Redis', 'Docker'],
    setupTime: '3 minutes',
    tags: ['fullstack', 'web'],
    defaultPorts: [3000, 8080, 5432, 6379],
    preinstalledTools: ['node', 'npm', 'pnpm', 'docker', 'git'],
    resourceRequirements: {
      minMemory: '4GB',
      minCpu: 2,
      recommendedDisk: '20GB',
    },
    config: {
      devcontainer: {
        image: 'mcr.microsoft.com/devcontainers/typescript-node:20',
        features: ['ghcr.io/devcontainers/features/docker-in-docker:2'],
      },
    },
  },
];

// Template variables definition (would normally come from template.json)
const templateVariables: Record<string, TemplateVariable[]> = {
  'allternit-platform-dev': [
    { name: 'PROJECT_NAME', type: 'string', label: 'Project Name', default: 'a2r-project', required: true },
    { name: 'ENABLE_GPU', type: 'boolean', label: 'Enable GPU Support', default: false },
    { name: 'DATABASE', type: 'select', label: 'Database', default: 'postgres', options: [
      { label: 'PostgreSQL', value: 'postgres' },
      { label: 'MySQL', value: 'mysql' },
      { label: 'SQLite', value: 'sqlite' },
    ]},
  ],
  'a2r-agent-workspace': [
    { name: 'AGENT_NAME', type: 'string', label: 'Agent Name', default: 'my-agent', required: true },
    { name: 'LOG_LEVEL', type: 'select', label: 'Log Level', default: 'info', options: [
      { label: 'Debug', value: 'debug' },
      { label: 'Info', value: 'info' },
      { label: 'Warn', value: 'warn' },
      { label: 'Error', value: 'error' },
    ]},
  ],
  'nodejs-typescript': [
    { name: 'PACKAGE_MANAGER', type: 'select', label: 'Package Manager', default: 'pnpm', options: [
      { label: 'pnpm', value: 'pnpm' },
      { label: 'npm', value: 'npm' },
      { label: 'yarn', value: 'yarn' },
    ]},
    { name: 'ENABLE_TESTING', type: 'boolean', label: 'Enable Testing Setup', default: true },
  ],
  'python-ml': [
    { name: 'GPU_ENABLED', type: 'boolean', label: 'Enable CUDA/GPU', default: false },
    { name: 'JUPYTER_TOKEN', type: 'secret', label: 'Jupyter Token', description: 'Access token for Jupyter (auto-generated if empty)' },
    { name: 'PYTHON_VERSION', type: 'select', label: 'Python Version', default: '3.11', options: [
      { label: '3.12', value: '3.12' },
      { label: '3.11', value: '3.11' },
      { label: '3.10', value: '3.10' },
    ]},
  ],
  'rust-systems': [
    { name: 'RUST_EDITION', type: 'select', label: 'Rust Edition', default: '2021', options: [
      { label: '2021', value: '2021' },
      { label: '2018', value: '2018' },
    ]},
    { name: 'CROSS_COMPILE', type: 'boolean', label: 'Enable Cross-compilation', default: false },
  ],
  'fullstack-web': [
    { name: 'FRONTEND_FRAMEWORK', type: 'select', label: 'Frontend Framework', default: 'next', options: [
      { label: 'Next.js', value: 'next' },
      { label: 'React', value: 'react' },
      { label: 'Vue', value: 'vue' },
      { label: 'Svelte', value: 'svelte' },
    ]},
    { name: 'BACKEND_FRAMEWORK', type: 'select', label: 'Backend Framework', default: 'express', options: [
      { label: 'Express', value: 'express' },
      { label: 'Fastify', value: 'fastify' },
      { label: 'NestJS', value: 'nestjs' },
    ]},
    { name: 'INCLUDE_AUTH', type: 'boolean', label: 'Include Auth Setup', default: true },
  ],
};

// A2R official template IDs
const allternitOfficialIds = ['allternit-platform-dev', 'a2r-agent-workspace'];

// Cloud providers
const cloudProviders = [
  { id: 'aws', name: 'AWS', logo: '☁️', description: 'Amazon Web Services', startingPrice: 0.0116, currency: 'USD', period: 'hour' },
  { id: 'gcp', name: 'Google Cloud', logo: '☁️', description: 'Google Cloud Platform', startingPrice: 0.0100, currency: 'USD', period: 'hour' },
  { id: 'azure', name: 'Azure', logo: '☁️', description: 'Microsoft Azure', startingPrice: 0.0120, currency: 'USD', period: 'hour' },
  { id: 'digitalocean', name: 'DigitalOcean', logo: '🌊', description: 'DigitalOcean Droplets', startingPrice: 0.007, currency: 'USD', period: 'hour' },
  { id: 'hetzner', name: 'Hetzner', logo: '🇩🇪', description: 'Hetzner Cloud', startingPrice: 0.004, currency: 'USD', period: 'hour' },
];

// ============================================================================
// Main Component
// ============================================================================

export function EnvironmentWizard({ isOpen, onClose, initialTemplateId, onSuccess }: EnvironmentWizardProps) {
  const [templates, setTemplates] = useState<EnvironmentTemplate[]>([]);
  const [vpsConnections, setVpsConnections] = useState<VPSConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [logUnsubscribe, setLogUnsubscribe] = useState<(() => void) | null>(null);

  const [state, setState] = useState<WizardState>({
    step: 1,
    selectedTemplate: null,
    config: {},
    target: 'local',
    logs: [],
    deployStatus: 'idle',
    isDeploying: false,
    preFlightPassed: true,
    preFlightIssues: [],
  });

  // Load templates and VPS connections
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        // Try API first
        const [apiTemplates, vpsList] = await Promise.all([
          environmentApi.getTemplates().catch(() => [] as EnvironmentTemplate[]),
          vpsApi.list().catch(() => [] as VPSConnection[]),
        ]);

        setTemplates(apiTemplates.length > 0 ? apiTemplates : defaultTemplates);
        setVpsConnections(vpsList.filter(v => v.status === 'connected'));

        // Auto-select initial template if provided
        if (initialTemplateId) {
          const template = (apiTemplates.length > 0 ? apiTemplates : defaultTemplates)
            .find((t: EnvironmentTemplate) => t.id === initialTemplateId);
          if (template) {
            setState(prev => ({ ...prev, selectedTemplate: template }));
          }
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        setTemplates(defaultTemplates);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, initialTemplateId]);

  // Cleanup log subscription on unmount
  useEffect(() => {
    return () => {
      if (logUnsubscribe) {
        logUnsubscribe();
      }
    };
  }, [logUnsubscribe]);

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleSelectTemplate = (template: EnvironmentTemplate) => {
    // Initialize config with defaults
    const vars = templateVariables[template.id] || [];
    const defaultConfig = vars.reduce((acc, v) => {
      acc[v.name] = v.default;
      return acc;
    }, {} as Record<string, any>);

    updateState({
      selectedTemplate: template,
      config: { name: `${template.name.toLowerCase().replace(/\s+/g, '-')}-env`, ...defaultConfig },
    });
  };

  const handleDeploy = async () => {
    if (!state.selectedTemplate) return;

    updateState({ isDeploying: true, deployStatus: 'deploying', logs: [] });

    try {
      const env = await environmentApi.provisionFromTemplate(
        state.selectedTemplate.id,
        state.config.name || `${state.selectedTemplate.id}-env`,
        state.target === 'vps' ? state.vpsId : undefined
      );

      updateState({ deploymentId: env.id });

      // Subscribe to logs
      const unsubscribe = environmentApi.subscribeToLogs(env.id, (log: EnvironmentLogEntry) => {
        setState(prev => ({
          ...prev,
          logs: [...prev.logs, `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`],
        }));
      });

      setLogUnsubscribe(() => unsubscribe);

      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const status = await environmentApi.get(env.id);
          if (status.status === 'running') {
            clearInterval(pollInterval);
            updateState({ deployStatus: 'success', isDeploying: false });
            onSuccess?.(status);
          } else if (status.status === 'error') {
            clearInterval(pollInterval);
            updateState({ 
              deployStatus: 'error', 
              isDeploying: false, 
              deployError: status.errorMessage || 'Deployment failed' 
            });
          }
        } catch (err) {
          // Continue polling
        }
      }, 3000);

      // Stop polling after 10 minutes
      setTimeout(() => clearInterval(pollInterval), 10 * 60 * 1000);
    } catch (err) {
      updateState({ 
        deployStatus: 'error', 
        isDeploying: false, 
        deployError: err instanceof Error ? err.message : 'Deployment failed' 
      });
    }
  };

  const canProceed = () => {
    switch (state.step) {
      case 1:
        return state.selectedTemplate !== null;
      case 2:
        return state.config.name?.trim().length > 0;
      case 3:
        if (state.target === 'vps') return state.vpsId !== undefined;
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (state.step < 4) {
      updateState({ step: (state.step + 1) as WizardState['step'] });
    }
  };

  const handleBack = () => {
    if (state.step > 1) {
      updateState({ step: (state.step - 1) as WizardState['step'] });
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' ||
                           (selectedCategory === 'allternit' && allternitOfficialIds.includes(template.id)) ||
                           (selectedCategory === 'web' && ['fullstack-web', 'nodejs-typescript'].includes(template.id)) ||
                           (selectedCategory === 'ml' && template.id === 'python-ml') ||
                           (selectedCategory === 'systems' && template.id === 'rust-systems');
    return matchesSearch && matchesCategory;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
        className="w-full max-w-5xl max-h-[90vh] overflow-hidden bg-background border rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <WizardHeader 
          step={state.step} 
          onClose={onClose}
          isDeploying={state.isDeploying}
        />

        {/* Content */}
        <div className="flex flex-col" style={{ height: '600px' }}>
          {/* Step Indicator */}
          <StepIndicator step={state.step} />

          {/* Main Content */}
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={state.step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {state.step === 1 && (
                  <TemplateSelectionStep
                    templates={filteredTemplates}
                    selectedTemplate={state.selectedTemplate}
                    onSelectTemplate={handleSelectTemplate}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    selectedCategory={selectedCategory}
                    onCategoryChange={setSelectedCategory}
                    isLoading={isLoading}
                  />
                )}
                {state.step === 2 && state.selectedTemplate && (
                  <ConfigurationStep
                    template={state.selectedTemplate}
                    config={state.config}
                    onConfigChange={(key, value) => 
                      updateState({ config: { ...state.config, [key]: value } })
                    }
                  />
                )}
                {state.step === 3 && (
                  <TargetSelectionStep
                    target={state.target}
                    onTargetChange={(target) => updateState({ target })}
                    vpsConnections={vpsConnections}
                    selectedVpsId={state.vpsId}
                    onVpsChange={(vpsId) => updateState({ vpsId })}
                    selectedCloudProvider={state.cloudProvider}
                    onCloudProviderChange={(cloudProvider) => updateState({ cloudProvider })}
                  />
                )}
                {state.step === 4 && (
                  <ReviewDeployStep
                    state={state}
                    onDeploy={handleDeploy}
                    logs={state.logs}
                    onRetry={() => updateState({ deployStatus: 'idle', logs: [], deployError: undefined })}
                    onClose={onClose}
                    updateState={updateState}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        {state.step !== 4 && (
          <WizardFooter
            step={state.step}
            canProceed={canProceed()}
            onNext={handleNext}
            onBack={handleBack}
            onClose={onClose}
            isDeploying={state.isDeploying}
          />
        )}
      </motion.div>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function WizardHeader({ 
  step, 
  onClose,
  isDeploying,
}: { 
  step: number;
  onClose: () => void;
  isDeploying: boolean;
}) {
  const stepTitles = [
    'Choose Template',
    'Configure Environment',
    'Select Target',
    'Review & Deploy',
  ];

  return (
    <div className="relative px-6 py-4 border-b bg-muted/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Cube className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Create Environment</h2>
            <p className="text-sm text-muted-foreground">
              Step {step} of 4: {stepTitles[step - 1]}
            </p>
          </div>
        </div>

        {!isDeploying && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: number }) {
  const steps = [
    { id: 1, label: 'Template', icon: Layout },
    { id: 2, label: 'Configure', icon: GearSix },
    { id: 3, label: 'Target', icon: HardDrives },
    { id: 4, label: 'Deploy', icon: Cloud },
  ];

  return (
    <div className="px-6 py-4 border-b bg-muted/30">
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, index) => {
          const Icon = s.icon;
          const isActive = s.id === step;
          const isCompleted = s.id < step;

          return (
            <React.Fragment key={s.id}>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                    isActive && "bg-primary text-primary-foreground",
                    isCompleted && "bg-green-500/20 text-green-500",
                    !isActive && !isCompleted && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check size={16} />
                  ) : (
                    <Icon size={16} />
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm font-medium hidden sm:block",
                    isActive && "text-foreground",
                    isCompleted && "text-green-500",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  {s.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "w-8 h-0.5 mx-1",
                    s.id < step ? "bg-green-500" : "bg-muted"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function TemplateSelectionStep({
  templates,
  selectedTemplate,
  onSelectTemplate,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  isLoading,
}: {
  templates: EnvironmentTemplate[];
  selectedTemplate: EnvironmentTemplate | null;
  onSelectTemplate: (t: EnvironmentTemplate) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
  isLoading: boolean;
}) {
  const categories = [
    { id: 'all', label: 'All', count: templates.length },
    { id: 'allternit', label: 'Allternit Official', count: templates.filter(t => allternitOfficialIds.includes(t.id)).length },
    { id: 'web', label: 'Web', count: templates.filter(t => ['fullstack-web', 'nodejs-typescript'].includes(t.id)).length },
    { id: 'ml', label: 'ML', count: templates.filter(t => t.id === 'python-ml').length },
    { id: 'systems', label: 'Systems', count: templates.filter(t => t.id === 'rust-systems').length },
  ];

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <CircleNotch className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search and Filters */}
      <div className="p-6 border-b space-y-4">
        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={selectedCategory} onValueChange={onCategoryChange}>
          <TabsList className="flex-wrap h-auto gap-1">
            {categories.map(cat => (
              <TabsTrigger key={cat.id} value={cat.id} className="text-xs">
                {cat.label}
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  {cat.count}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Template Grid */}
      <ScrollArea className="flex-1 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={selectedTemplate?.id === template.id}
              onClick={() => onSelectTemplate(template)}
            />
          ))}
        </div>
        {templates.length === 0 && (
          <div className="text-center py-12">
            <Funnel className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No templates match your search</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function TemplateCard({
  template,
  isSelected,
  onClick,
}: {
  template: EnvironmentTemplate;
  isSelected: boolean;
  onClick: () => void;
}) {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    sparkles: Sparkle,
    bot: Cube,
    code: Code,
    brain: Database,
    cpu: Cpu,
    globe: Globe,
  };

  const Icon = (template.icon && iconMap[template.icon]) || Box;
  const isOfficial = allternitOfficialIds.includes(template.id);

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary border-primary"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              <Icon size={20} />
            </div>
            <div>
              <CardTitle className="text-base">{template.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {isOfficial && (
                  <Badge variant="default" className="text-[10px] bg-primary/20 text-primary hover:bg-primary/30">
                    A2R Official
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock size={12} />
                  {template.setupTime}
                </span>
              </div>
            </div>
          </div>
          {isSelected && <CheckCircle className="w-5 h-5 text-primary" />}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="text-sm mb-3">
          {template.description}
        </CardDescription>
        <div className="flex flex-wrap gap-1">
          {template.features.slice(0, 4).map((feature, i) => (
            <Badge key={i} variant="secondary" className="text-[10px]">
              {feature}
            </Badge>
          ))}
          {template.features.length > 4 && (
            <Badge variant="outline" className="text-[10px]">
              +{template.features.length - 4}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ConfigurationStep({
  template,
  config,
  onConfigChange,
}: {
  template: EnvironmentTemplate;
  config: Record<string, any>;
  onConfigChange: (key: string, value: any) => void;
}) {
  const variables = templateVariables[template.id] || [];

  return (
    <ScrollArea className="h-full p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Template Info */}
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <Cube className="w-8 h-8 text-primary" />
          <div>
            <h3 className="font-medium">{template.name}</h3>
            <p className="text-sm text-muted-foreground">{template.description}</p>
          </div>
        </div>

        {/* Environment Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Environment Name <span className="text-destructive">*</span>
          </label>
          <Input
            value={config.name || ''}
            onChange={(e) => onConfigChange('name', e.target.value)}
            placeholder="my-dev-environment"
          />
          <p className="text-xs text-muted-foreground">
            A unique name to identify this environment
          </p>
        </div>

        {/* Resource Limits */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Cpu size={16} />
            Resource Limits
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">CPU Cores</label>
              <Select
                value={String(config.cpu || template.resourceRequirements?.minCpu || 1)}
                onValueChange={(v) => onConfigChange('cpu', parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 4, 8, 16].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} cores</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Memory</label>
              <Select
                value={config.memory || template.resourceRequirements?.minMemory || '1GB'}
                onValueChange={(v) => onConfigChange('memory', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['512MB', '1GB', '2GB', '4GB', '8GB', '16GB', '32GB'].map(n => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Template Variables */}
        {variables.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <GearSix size={16} />
              Configuration Variables
            </h4>
            <div className="space-y-4">
              {variables.map(variable => (
                <VariableInput
                  key={variable.name}
                  variable={variable}
                  value={config[variable.name]}
                  onChange={(value) => onConfigChange(variable.name, value)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Exposed Ports */}
        {template.defaultPorts && template.defaultPorts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Globe size={16} />
              Exposed Ports
            </h4>
            <div className="flex flex-wrap gap-2">
              {template.defaultPorts.map(port => (
                <Badge key={port} variant="outline">
                  :{port}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Cost Estimate */}
        <CostEstimator
          template={template}
          target="local"
          config={config}
        />

        {/* Template Preview */}
        <TemplatePreview
          template={template}
          config={config}
        />
      </div>
    </ScrollArea>
  );
}

function VariableInput({
  variable,
  value,
  onChange,
}: {
  variable: TemplateVariable;
  value: any;
  onChange: (value: any) => void;
}) {
  const [showSecret, setShowSecret] = useState(false);

  switch (variable.type) {
    case 'string':
      return (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {variable.label}
            {variable.required && <span className="text-destructive">*</span>}
          </label>
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={variable.description}
          />
        </div>
      );

    case 'number':
      return (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {variable.label}
            {variable.required && <span className="text-destructive">*</span>}
          </label>
          <Input
            type="number"
            value={value || 0}
            onChange={(e) => onChange(parseFloat(e.target.value))}
          />
        </div>
      );

    case 'boolean':
      return (
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <label className="text-sm font-medium">{variable.label}</label>
            {variable.description && (
              <p className="text-xs text-muted-foreground">{variable.description}</p>
            )}
          </div>
          <Switch
            checked={value || false}
            onCheckedChange={onChange}
          />
        </div>
      );

    case 'select':
      return (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {variable.label}
            {variable.required && <span className="text-destructive">*</span>}
          </label>
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {variable.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case 'secret':
      return (
        <div className="space-y-2">
          <label className="text-sm font-medium">{variable.label}</label>
          <div className="relative">
            <Input
              type={showSecret ? 'text' : 'password'}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={variable.description || '••••••••'}
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showSecret ? <EyeSlash size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      );

    default:
      return null;
  }
}

function TargetSelectionStep({
  target,
  onTargetChange,
  vpsConnections,
  selectedVpsId,
  onVpsChange,
  selectedCloudProvider,
  onCloudProviderChange,
}: {
  target: 'local' | 'vps' | 'cloud';
  onTargetChange: (target: 'local' | 'vps' | 'cloud') => void;
  vpsConnections: VPSConnection[];
  selectedVpsId?: string;
  onVpsChange: (vpsId: string) => void;
  selectedCloudProvider?: string;
  onCloudProviderChange: (provider: string) => void;
}) {
  const selectedProvider = cloudProviders.find(p => p.id === selectedCloudProvider);

  return (
    <ScrollArea className="h-full p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Local Docker */}
        <TargetCard
          id="local"
          name="Local Docker"
          description="Run environment on your local machine using Docker"
          icon={Terminal}
          isSelected={target === 'local'}
          onClick={() => onTargetChange('local')}
          details={[
            { icon: Cpu, label: 'Uses local resources' },
            { icon: HardDrive, label: 'Data persists locally' },
            { icon: Lightning, label: 'Fastest setup' },
          ]}
        />

        {/* Connected VPS */}
        <TargetCard
          id="vps"
          name="Connected VPS"
          description="Deploy to one of your connected VPS instances"
          icon={HardDrives}
          isSelected={target === 'vps'}
          onClick={() => onTargetChange('vps')}
          disabled={vpsConnections.length === 0}
          disabledMessage="No VPS connections available. Connect a VPS first."
        >
          {target === 'vps' && (
            <div className="mt-4 pt-4 border-t">
              <label className="text-sm font-medium mb-2 block">Select VPS</label>
              <Select value={selectedVpsId} onValueChange={onVpsChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a VPS..." />
                </SelectTrigger>
                <SelectContent>
                  {vpsConnections.map(vps => (
                    <SelectItem key={vps.id} value={vps.id}>
                      {vps.name} ({vps.host})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </TargetCard>

        {/* Cloud Deploy */}
        <TargetCard
          id="cloud"
          name="Cloud Deploy"
          description="Deploy to a cloud provider (new instance)"
          icon={Cloud}
          isSelected={target === 'cloud'}
          onClick={() => onTargetChange('cloud')}
        >
          {target === 'cloud' && (
            <div className="mt-4 pt-4 border-t space-y-4">
              <label className="text-sm font-medium block">Select Provider</label>
              <div className="grid grid-cols-1 gap-2">
                {cloudProviders.map(provider => (
                  <button
                    key={provider.id}
                    onClick={() => onCloudProviderChange(provider.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                      selectedCloudProvider === provider.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <span className="text-2xl">{provider.logo}</span>
                    <div className="flex-1">
                      <div className="font-medium">{provider.name}</div>
                      <div className="text-xs text-muted-foreground">{provider.description}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        ${provider.startingPrice}/{provider.period}
                      </div>
                      <div className="text-xs text-muted-foreground">starting price</div>
                    </div>
                  </button>
                ))}
              </div>
              {selectedProvider && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Warning size={16} />
                    Estimated cost: ~${(selectedProvider.startingPrice * 730).toFixed(2)}/month
                  </div>
                </div>
              )}
            </div>
          )}
        </TargetCard>
      </div>
    </ScrollArea>
  );
}

function TargetCard({
  id,
  name,
  description,
  icon: Icon,
  isSelected,
  onClick,
  disabled,
  disabledMessage,
  details,
  children,
}: {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
  disabledMessage?: string;
  details?: { icon: React.ComponentType<{ className?: string }>; label: string }[];
  children?: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "transition-all",
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && "cursor-pointer hover:border-primary/50",
        isSelected && "ring-2 ring-primary border-primary"
      )}
      onClick={() => !disabled && onClick()}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
            isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            <Icon size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{name}</h3>
              {isSelected && <CheckCircle className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
            
            {details && (
              <div className="flex flex-wrap gap-3 mt-3">
                {details.map((detail, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <detail.icon className="w-3.5 h-3.5" />
                    {detail.label}
                  </div>
                ))}
              </div>
            )}

            {disabled && disabledMessage && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-500">
                <Warning size={16} />
                {disabledMessage}
              </div>
            )}

            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewDeployStep({
  state,
  onDeploy,
  logs,
  onRetry,
  onClose,
  updateState,
}: {
  state: WizardState;
  onDeploy: () => void;
  logs: string[];
  onRetry: () => void;
  onClose: () => void;
  updateState: (updates: Partial<WizardState>) => void;
}) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (state.deployStatus === 'success') {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">Environment Ready!</h3>
            <p className="text-muted-foreground mt-2">
              Your environment <strong>{state.config.name}</strong> has been successfully provisioned.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
            <Button onClick={() => {/* Open environment */}}>
              <ArrowSquareOut className="w-4 h-4 mr-2" />
              Open Environment
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (state.deployStatus === 'error') {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mx-auto">
            <XCircle className="w-10 h-10 text-destructive" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">Deployment Failed</h3>
            <p className="text-muted-foreground mt-2">{state.deployError}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
            <Button onClick={onRetry} variant="outline">
              <ArrowsClockwise className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex gap-6 flex-1 min-h-0">
        {/* Summary */}
        <div className="w-1/3 space-y-4 overflow-auto">
          <h3 className="font-medium">Deployment Summary</h3>
          
          {state.selectedTemplate && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="text-xs text-muted-foreground uppercase">Template</div>
              <div className="font-medium">{state.selectedTemplate.name}</div>
              <div className="text-sm text-muted-foreground">{state.selectedTemplate.description}</div>
            </div>
          )}

          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="text-xs text-muted-foreground uppercase">Configuration</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span>{state.config.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CPU</span>
                <span>{state.config.cpu || state.selectedTemplate?.resourceRequirements?.minCpu || 1} cores</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Memory</span>
                <span>{state.config.memory || state.selectedTemplate?.resourceRequirements?.minMemory || '1GB'}</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="text-xs text-muted-foreground uppercase">Target</div>
            <div className="flex items-center gap-2">
              {state.target === 'local' && <Terminal size={16} />}
              {state.target === 'vps' && <HardDrives size={16} />}
              {state.target === 'cloud' && <Cloud size={16} />}
              <span className="capitalize">{state.target}</span>
            </div>
          </div>

          {/* Pre-flight Check */}
          {state.selectedTemplate && (
            <PreFlightCheck
              template={state.selectedTemplate}
              targetVpsId={state.target === 'vps' ? state.vpsId : undefined}
              onCheckComplete={(passed, issues) => {
                updateState({ preFlightPassed: passed, preFlightIssues: issues });
              }}
            />
          )}
          
          {!state.preFlightPassed && state.preFlightIssues.length > 0 && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-600">
              <div className="flex items-center gap-2">
                <Warning size={16} />
                <span>{state.preFlightIssues.length} issue(s) found</span>
              </div>
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="flex-1 flex flex-col min-h-0">
          <h3 className="font-medium mb-3">Deployment Logs</h3>
          <div className="flex-1 bg-black rounded-lg p-4 font-mono text-sm overflow-auto">
            {logs.length === 0 ? (
              <div className="text-muted-foreground flex items-center gap-2">
                <CircleNotch className="w-4 h-4 animate-spin" />
                Waiting to start...
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className="text-green-400">
                    {log}
                  </div>
                ))}
                {state.isDeploying && (
                  <div className="text-green-400 animate-pulse">_</div>
                )}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deploy Button */}
      <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
        <Button onClick={onClose} variant="outline" disabled={state.isDeploying}>
          Cancel
        </Button>
        <Button 
          onClick={onDeploy} 
          disabled={state.isDeploying || !state.preFlightPassed}
          className="min-w-[120px]"
        >
          {state.isDeploying ? (
            <>
              <CircleNotch className="w-4 h-4 mr-2 animate-spin" />
              Deploying...
            </>
          ) : !state.preFlightPassed ? (
            <>
              <Warning className="w-4 h-4 mr-2" />
              Fix Issues to Deploy
            </>
          ) : (
            <>
              <Cloud className="w-4 h-4 mr-2" />
              Deploy
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function WizardFooter({
  step,
  canProceed,
  onNext,
  onBack,
  onClose,
  isDeploying,
}: {
  step: number;
  canProceed: boolean;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
  isDeploying: boolean;
}) {
  return (
    <div className="px-6 py-4 border-t bg-muted/30 flex justify-between items-center">
      <Button
        variant="outline"
        onClick={step === 1 ? onClose : onBack}
        disabled={isDeploying}
      >
        {step === 1 ? 'Cancel' : (
          <>
            <CaretLeft className="w-4 h-4 mr-2" />
            Back
          </>
        )}
      </Button>

      <Button
        onClick={onNext}
        disabled={!canProceed || isDeploying}
      >
        Next
        <CaretRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

// ============================================================================
// Export
// ============================================================================

export default EnvironmentWizard;
