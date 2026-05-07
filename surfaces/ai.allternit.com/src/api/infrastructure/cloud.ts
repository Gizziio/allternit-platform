/**
 * Cloud API - Types and API client for cloud providers and deployments
 */
import { cloudProviderCatalog } from './catalog';

export type Provider = 'hetzner' | 'digitalocean' | 'aws' | 'gcp' | 'azure' | 'linode' | 'vultr';

export type InstanceStatus = 'running' | 'stopped' | 'error' | 'pending' | 'provisioning' | 'destroying';

export type DeploymentStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface Region {
  id: string;
  name: string;
  country: string;
  available: boolean;
}

export interface InstanceType {
  id: string;
  name: string;
  cpu: number;
  ram: number; // in MB
  disk: number; // in GB
  price_hourly: number;
  price_monthly: number;
}

export interface CloudProvider {
  id: Provider;
  name: string;
  logo: string;
  description: string;
  status: 'available' | 'coming_soon' | 'deprecated';
  popular?: boolean;
  signup_url: string;
  features: string[];
  currency: string;
  starting_price: number;
  period: string;
  deploy_time: string;
  regions?: Region[];
  instance_types?: InstanceType[];
}

export interface Instance {
  id: string;
  name: string;
  provider: Provider;
  region: string;
  instance_type: string;
  status: InstanceStatus;
  cpu: number;
  ram: number; // in MB
  disk: number; // in GB
  public_ip?: string;
  private_ip?: string;
  docker_available: boolean;
  gpu_available: boolean;
  cost_hr: number;
  last_seen: string;
  created_at: string;
  updated_at: string;
}

export interface Deployment {
  id: string;
  provider: Provider;
  instance_name: string;
  region: string;
  instance_type: string;
  status: DeploymentStatus;
  progress?: number;
  message?: string;
  instance_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DeployRequest {
  provider: Provider;
  region: string;
  instance_type: string;
  name: string;
  ssh_key_ids?: string[];
  user_data?: string;
}

export interface CloudCapabilities {
  providerCatalogAvailable: boolean;
  deploymentEnabled: boolean;
  reason?: string;
}

const CLOUD_UNAVAILABLE_MESSAGE =
  'Cloud deployment is not wired to a backend yet. Provider browsing is available, but deploy/cancel/destroy operations are disabled.';

export const cloudApi = {
  async getCapabilities(): Promise<CloudCapabilities> {
    return {
      providerCatalogAvailable: true,
      deploymentEnabled: false,
      reason: CLOUD_UNAVAILABLE_MESSAGE,
    };
  },

  async listProviders(): Promise<CloudProvider[]> {
    return cloudProviderCatalog;
  },

  async listInstances(): Promise<Instance[]> {
    return [];
  },

  async listDeployments(): Promise<Deployment[]> {
    return [];
  },

  async deploy(request: DeployRequest): Promise<Deployment> {
    throw new Error(CLOUD_UNAVAILABLE_MESSAGE);
  },

  async cancelDeployment(deploymentId: string): Promise<void> {
    throw new Error(CLOUD_UNAVAILABLE_MESSAGE);
  },

  async destroyInstance(instanceId: string): Promise<void> {
    throw new Error(CLOUD_UNAVAILABLE_MESSAGE);
  },

  async getRegions(provider: Provider): Promise<Region[]> {
    return [];
  },

  async getInstanceTypes(provider: Provider): Promise<InstanceType[]> {
    return [];
  },
};
