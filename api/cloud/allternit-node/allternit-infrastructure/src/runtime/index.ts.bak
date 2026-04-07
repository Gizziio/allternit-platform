/**
 * A2R Infrastructure - Runtime Environment Provisioning Engine
 * 
 * Railway-style one-click environment setup for devcontainers, Nix flakes, and sandbox VMs.
 */

// Main orchestrator
export { 
  EnvironmentEngine,
  ProvisionConfig,
  Target,
  ResourceRequirements,
  NetworkConfig,
  PortMapping,
  VolumeConfig,
  Environment,
  Endpoint,
  EnvironmentStatus,
  CommandResult,
  LogEntry,
} from './EnvironmentEngine';

// DevContainer runtime
export {
  DevContainerRuntime,
  DevContainerConfig,
  DevContainerTemplate,
  ContainerConfig,
  Container,
  Mount,
  PortAttributes,
} from './DevContainerRuntime';

// Nix runtime
export {
  NixRuntime,
  NixConfig,
  FlakeRef,
  BuildResult,
  ShellSession,
  FlakeOutputs,
} from './NixRuntime';

// Sandbox runtime
export {
  SandboxRuntime,
  SandboxConfig,
  Sandbox,
  ResourceConstraints,
  IsolationConfig,
} from './SandboxRuntime';

// Target adapter
export {
  TargetAdapter,
  Connection,
  ExecuteOptions,
  CloudInstance,
} from './TargetAdapter';

// Template types (from JSON files)
export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  image?: string;
  features?: string[];
  ports?: number[];
  postCreateCommand?: string;
  customizations?: {
    vscode?: {
      extensions?: string[];
      settings?: Record<string, unknown>;
    };
  };
  variables?: Record<string, { default: string; description: string }>;
}

