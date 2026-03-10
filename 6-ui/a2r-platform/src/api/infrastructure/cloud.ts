/**
 * Cloud API - Types and API client for cloud providers and deployments
 */

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

// Stub API implementation
export const cloudApi = {
  async listProviders(): Promise<CloudProvider[]> {
    // TODO: Implement actual API call
    return [
      {
        id: 'hetzner',
        name: 'Hetzner',
        logo: 'hetzner',
        description: 'High performance cloud servers with excellent price-to-performance ratio.',
        status: 'available',
        popular: true,
        signup_url: 'https://www.hetzner.com/cloud',
        features: ['AMD EPYC CPUs', 'NVMe SSDs', 'Unmetered traffic', 'DDoS protection'],
        currency: '€',
        starting_price: 4.51,
        period: 'month',
        deploy_time: '~2 min',
      },
      {
        id: 'digitalocean',
        name: 'DigitalOcean',
        logo: 'digitalocean',
        description: 'Developer-friendly cloud platform with simple pricing.',
        status: 'available',
        popular: true,
        signup_url: 'https://www.digitalocean.com',
        features: ['SSD storage', 'Global data centers', 'Kubernetes', 'App Platform'],
        currency: '$',
        starting_price: 4,
        period: 'month',
        deploy_time: '~1 min',
      },
    ];
  },

  async listInstances(): Promise<Instance[]> {
    // TODO: Implement actual API call
    return [];
  },

  async listDeployments(): Promise<Deployment[]> {
    // TODO: Implement actual API call
    return [];
  },

  async deploy(request: DeployRequest): Promise<Deployment> {
    // TODO: Implement actual API call
    return {
      id: `deploy-${Date.now()}`,
      provider: request.provider,
      instance_name: request.name,
      region: request.region,
      instance_type: request.instance_type,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  },

  async cancelDeployment(deploymentId: string): Promise<void> {
    // TODO: Implement actual API call
    console.log('Cancelling deployment:', deploymentId);
  },

  async destroyInstance(instanceId: string): Promise<void> {
    // TODO: Implement actual API call
    console.log('Destroying instance:', instanceId);
  },

  async getRegions(provider: Provider): Promise<Region[]> {
    // TODO: Implement actual API call
    return [];
  },

  async getInstanceTypes(provider: Provider): Promise<InstanceType[]> {
    // TODO: Implement actual API call
    return [];
  },
};
