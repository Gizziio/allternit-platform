import { DeploymentStatusUpdate, CloudProviderInfo, DeploymentEstimate } from '../models/Deployment';

export interface CreateInstanceOptions {
  name: string;
  region: string;
  instanceType: string;
  image: string;
  sshKeys?: string[];
  userData?: string;
  tags?: Record<string, string>;
  volumes?: Array<{
    size: number;
    name?: string;
  }>;
  networks?: string[];
}

export interface InstanceInfo {
  id: string;
  name: string;
  status: string;
  ip?: string;
  ipv6?: string;
  privateIp?: string;
  region: string;
  instanceType: string;
  image: string;
  createdAt: Date;
  labels?: Record<string, string>;
}

export interface InstanceAction {
  id: string;
  status: string;
  progress: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export abstract class BaseProvider {
  protected readonly name: string;
  protected readonly apiKey: string;
  protected readonly apiUrl: string;
  protected enabled: boolean;

  constructor(name: string, apiKey: string, apiUrl: string, enabled: boolean = true) {
    this.name = name;
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    this.enabled = enabled;
  }

  /**
   * Get provider name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Check if provider is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.apiKey.length > 0;
  }

  /**
   * Validate API credentials
   */
  abstract validateCredentials(): Promise<{ valid: boolean; message: string }>;

  /**
   * Get provider information including regions, instance types, and images
   */
  abstract getProviderInfo(): Promise<CloudProviderInfo>;

  /**
   * Create a new instance
   */
  abstract createInstance(options: CreateInstanceOptions): Promise<{
    instance: InstanceInfo;
    rootPassword?: string;
    action?: InstanceAction;
  }>;

  /**
   * Get instance by ID
   */
  abstract getInstance(instanceId: string): Promise<InstanceInfo | null>;

  /**
   * List all instances
   */
  abstract listInstances(): Promise<InstanceInfo[]>;

  /**
   * Start an instance
   */
  abstract startInstance(instanceId: string): Promise<InstanceAction>;

  /**
   * Stop an instance
   */
  abstract stopInstance(instanceId: string): Promise<InstanceAction>;

  /**
   * Reboot an instance
   */
  abstract rebootInstance(instanceId: string): Promise<InstanceAction>;

  /**
   * Delete/Terminate an instance
   */
  abstract deleteInstance(instanceId: string): Promise<void>;

  /**
   * Get instance action/progress
   */
  abstract getAction(actionId: string): Promise<InstanceAction>;

  /**
   * Get pricing estimate for an instance configuration
   */
  abstract getPricingEstimate(
    region: string,
    instanceType: string,
    hours: number
  ): Promise<DeploymentEstimate>;

  /**
   * Get console URL for instance (if supported)
   */
  abstract getConsoleUrl?(instanceId: string): Promise<string | null>;

  /**
   * Reset root password (if supported)
   */
  abstract resetPassword?(instanceId: string): Promise<{ success: boolean; newPassword?: string }>;

  /**
   * Create a snapshot/backup of an instance (if supported)
   */
  abstract createSnapshot?(instanceId: string, name: string): Promise<{ id: string; status: string }>;

  /**
   * List available SSH keys
   */
  abstract listSSHKeys?(): Promise<Array<{ id: string; name: string; fingerprint: string; publicKey: string }>>;

  /**
   * Upload SSH key
   */
  abstract uploadSSHKey?(name: string, publicKey: string): Promise<{ id: string; fingerprint: string }>;

  /**
   * Delete SSH key
   */
  abstract deleteSSHKey?(keyId: string): Promise<void>;

  /**
   * Convert provider instance status to internal status
   */
  protected abstract mapInstanceStatus(providerStatus: string): string;

  /**
   * Map internal status to deployment status
   */
  protected mapToDeploymentStatus(instanceStatus: string): DeploymentStatusUpdate['status'] {
    switch (instanceStatus.toLowerCase()) {
      case 'running':
      case 'active':
      case 'powered_on':
        return 'running';
      case 'starting':
      case 'initializing':
      case 'provisioning':
      case 'pending':
        return 'provisioning';
      case 'stopping':
        return 'stopping';
      case 'stopped':
      case 'off':
        return 'stopped';
      case 'terminating':
      case 'deleting':
        return 'terminating';
      case 'terminated':
      case 'deleted':
        return 'terminated';
      case 'error':
      case 'failed':
        return 'error';
      default:
        return 'pending';
    }
  }

  /**
   * Handle API errors
   */
  protected handleError(error: any, context: string): Error {
    const message = error?.response?.data?.error?.message || 
                    error?.message || 
                    `Unknown error in ${context}`;
    return new Error(`${context}: ${message}`);
  }

  /**
   * Generate unique instance name
   */
  protected generateInstanceName(baseName: string): string {
    const timestamp = Date.now().toString(36);
    const sanitized = baseName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    return `allternit-${sanitized}-${timestamp}`.substring(0, 63);
  }

  /**
   * Wait for an action to complete
   */
  async waitForAction(
    actionId: string,
    checkInterval: number = 5000,
    maxWaitTime: number = 600000
  ): Promise<InstanceAction> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const action = await this.getAction(actionId);
      
      if (action.status === 'success' || action.status === 'completed') {
        return action;
      }
      
      if (action.status === 'error' || action.error) {
        throw new Error(`Action failed: ${action.error || 'Unknown error'}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error(`Action timed out after ${maxWaitTime}ms`);
  }
}

export default BaseProvider;
