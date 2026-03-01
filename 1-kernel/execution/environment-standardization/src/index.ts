/**
 * Environment Standardization
 *
 * Normalized Environment Spec (NES) for reproducible, spawnable, portable environments.
 */

// ============================================================================
// Types
// ============================================================================

export interface NormalizedEnvironmentSpec {
  apiVersion: 'a2r.dev/v1';
  kind: 'Environment';
  metadata: EnvironmentMetadata;
  spec: EnvironmentSpec;
}

export interface EnvironmentMetadata {
  name: string;
  version: string;
  description?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface EnvironmentSpec {
  toolchain: ToolchainConfig;
  packages: PackageConfig;
  services: ServiceConfig;
  tasks: TaskConfig;
  resources: ResourceConfig;
  security: SecurityConfig;
}

export interface ToolchainConfig {
  language: string;
  version: string;
  packageManager: string;
  buildTools: string[];
}

export interface PackageConfig {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  systemPackages: string[];
}

export interface ServiceConfig {
  databases: DatabaseService[];
  caches: CacheService[];
  queues: QueueService[];
  other: OtherService[];
}

export interface DatabaseService {
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis';
  version: string;
  port: number;
  credentials: CredentialRef;
}

export interface CacheService {
  type: 'redis' | 'memcached';
  version: string;
  port: number;
  memoryLimit: string;
}

export interface QueueService {
  type: 'rabbitmq' | 'kafka' | 'sqs';
  version: string;
  port?: number;
}

export interface OtherService {
  name: string;
  image: string;
  port?: number;
  env?: Record<string, string>;
}

export interface CredentialRef {
  secretName: string;
  key: string;
}

export interface TaskConfig {
  setup: Task[];
  build: Task[];
  test: Task[];
  start: Task[];
}

export interface Task {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  timeout?: number;
  retry?: RetryConfig;
}

export interface RetryConfig {
  maxAttempts: number;
  delay: number;
  backoff: 'linear' | 'exponential';
}

export interface ResourceConfig {
  cpu: string;
  memory: string;
  disk: string;
  gpu?: GPUConfig;
}

export interface GPUConfig {
  type: string;
  count: number;
}

export interface SecurityConfig {
  networkPolicy: NetworkPolicy;
  secretsPolicy: SecretsPolicy;
  isolationLevel: 'process' | 'container' | 'vm';
}

export interface NetworkPolicy {
  egress: string[];
  ingress: string[];
  allowExternal: boolean;
}

export interface SecretsPolicy {
  ephemeral: boolean;
  ttl: number;
  rotationPolicy: string;
}

// ============================================================================
// Determinism Hashing
// ============================================================================

export interface DeterminismHash {
  envHash: string;
  policyHash: string;
  inputsHash: string;
  codeHash: string;
  combinedHash: string;
}

export function computeDeterminismHash(
  spec: NormalizedEnvironmentSpec,
  policy: unknown,
  inputs: unknown,
  code: string
): DeterminismHash {
  const envHash = hash(JSON.stringify(spec));
  const policyHash = hash(JSON.stringify(policy));
  const inputsHash = hash(JSON.stringify(inputs));
  const codeHash = hash(code);
  
  const combinedHash = hash(envHash + policyHash + inputsHash + codeHash);
  
  return { envHash, policyHash, inputsHash, codeHash, combinedHash };
}

function hash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h) + input.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h).toString(36);
}

// ============================================================================
// Lifecycle Runner
// ============================================================================

export type LifecyclePhase = 'resolve' | 'provision' | 'bootstrap' | 'start' | 'ready' | 'run' | 'collect' | 'teardown';

export interface LifecycleRunner {
  resolve(spec: NormalizedEnvironmentSpec): Promise<ResolvedEnvironment>;
  provision(resolved: ResolvedEnvironment): Promise<ProvisionedEnvironment>;
  bootstrap(provisioned: ProvisionedEnvironment): Promise<void>;
  start(provisioned: ProvisionedEnvironment): Promise<void>;
  ready(provisioned: ProvisionedEnvironment): Promise<boolean>;
  run(provisioned: ProvisionedEnvironment, task: Task): Promise<TaskResult>;
  collect(provisioned: ProvisionedEnvironment): Promise<CollectionResult>;
  teardown(provisioned: ProvisionedEnvironment): Promise<void>;
}

export interface ResolvedEnvironment {
  spec: NormalizedEnvironmentSpec;
  resolvedDependencies: Record<string, string>;
  resolvedServices: ServiceConfig;
}

export interface ProvisionedEnvironment {
  id: string;
  spec: NormalizedEnvironmentSpec;
  status: EnvironmentStatus;
  endpoints: Record<string, string>;
  credentials: Record<string, string>;
}

export interface EnvironmentStatus {
  phase: LifecyclePhase;
  health: 'healthy' | 'degraded' | 'unhealthy';
  startedAt?: string;
  readyAt?: string;
}

export interface TaskResult {
  success: boolean;
  output: string;
  duration: number;
  exitCode: number;
}

export interface CollectionResult {
  artifacts: Artifact[];
  logs: string;
  metrics: Metrics;
}

export interface Artifact {
  name: string;
  path: string;
  hash: string;
}

export interface Metrics {
  cpuUsage: number;
  memoryUsage: number;
  duration: number;
}

// ============================================================================
// Compatibility Tiers
// ============================================================================

export type CompatibilityTier = 'tier0' | 'tier1' | 'tier2';

export interface CompatibilityConfig {
  tier: CompatibilityTier;
  reproducibility: 'best-effort' | 'strict' | 'verified';
  portability: 'local' | 'byoc' | 'marketplace';
}

export const COMPATIBILITY_TIERS: Record<CompatibilityTier, CompatibilityConfig> = {
  tier0: {
    tier: 'tier0',
    reproducibility: 'best-effort',
    portability: 'local',
  },
  tier1: {
    tier: 'tier1',
    reproducibility: 'strict',
    portability: 'byoc',
  },
  tier2: {
    tier: 'tier2',
    reproducibility: 'verified',
    portability: 'marketplace',
  },
};

// ============================================================================
// Environment Standardization Engine
// ============================================================================

export class EnvironmentStandardizationEngine {
  private environments: Map<string, ProvisionedEnvironment>;

  constructor() {
    this.environments = new Map();
  }

  /**
   * Normalize environment from various sources
   */
  async normalize(source: EnvironmentSource): Promise<NormalizedEnvironmentSpec> {
    if (source.type === 'devcontainer') {
      return this.fromDevContainer(source.content);
    } else if (source.type === 'a2r-native') {
      return JSON.parse(source.content) as NormalizedEnvironmentSpec;
    }
    throw new Error(`Unknown source type: ${source.type}`);
  }

  private fromDevContainer(content: string): NormalizedEnvironmentSpec {
    const devContainer = JSON.parse(content);
    
    // Convert devcontainer.json to NES
    return {
      apiVersion: 'a2r.dev/v1',
      kind: 'Environment',
      metadata: {
        name: devContainer.name || 'dev-container',
        version: '1.0.0',
      },
      spec: {
        toolchain: {
          language: this.detectLanguage(devContainer),
          version: devContainer.image?.split(':')?.[1] || 'latest',
          packageManager: this.detectPackageManager(devContainer),
          buildTools: devContainer.postCreateCommand ? [devContainer.postCreateCommand] : [],
        },
        packages: {
          dependencies: devContainer.customizations?.vscode?.extensions || {},
          devDependencies: {},
          systemPackages: devContainer.features || [],
        },
        services: {
          databases: [],
          caches: [],
          queues: [],
          other: [],
        },
        tasks: {
          setup: [],
          build: [],
          test: [],
          start: [],
        },
        resources: {
          cpu: '1',
          memory: '2Gi',
          disk: '10Gi',
        },
        security: {
          networkPolicy: {
            egress: ['*'],
            ingress: [],
            allowExternal: false,
          },
          secretsPolicy: {
            ephemeral: true,
            ttl: 3600,
            rotationPolicy: 'on-exit',
          },
          isolationLevel: 'container',
        },
      },
    };
  }

  private detectLanguage(devContainer: unknown): string {
    // Simple detection logic
    return 'typescript';
  }

  private detectPackageManager(devContainer: unknown): string {
    return 'npm';
  }

  /**
   * Spawn environment
   */
  async spawn(spec: NormalizedEnvironmentSpec): Promise<ProvisionedEnvironment> {
    const id = `env_${Date.now()}`;
    
    const env: ProvisionedEnvironment = {
      id,
      spec,
      status: {
        phase: 'resolve',
        health: 'healthy',
      },
      endpoints: {},
      credentials: {},
    };

    this.environments.set(id, env);
    return env;
  }

  /**
   * Get environment by ID
   */
  get(id: string): ProvisionedEnvironment | null {
    return this.environments.get(id) || null;
  }

  /**
   * Destroy environment
   */
  async destroy(id: string): Promise<boolean> {
    return this.environments.delete(id);
  }

  /**
   * Compute determinism hash for environment
   */
  computeHash(spec: NormalizedEnvironmentSpec, policy: unknown, inputs: unknown): DeterminismHash {
    return computeDeterminismHash(spec, policy, inputs, '');
  }
}

export interface EnvironmentSource {
  type: 'devcontainer' | 'a2r-native' | 'nix';
  content: string;
  path?: string;
}

// ============================================================================
// Singleton
// ============================================================================

export const envStandardization = new EnvironmentStandardizationEngine();
