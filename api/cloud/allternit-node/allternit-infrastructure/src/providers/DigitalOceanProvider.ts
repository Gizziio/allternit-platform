import https from 'https';
import { BaseProvider, CreateInstanceOptions, InstanceInfo, InstanceAction } from './BaseProvider';
import { CloudProviderInfo, DeploymentEstimate } from '../models/Deployment';
import { logger } from '../utils/logger';
import { CloudProviderError } from '../utils/errors';

interface DigitalOceanDroplet {
  id: number;
  name: string;
  memory: number;
  vcpus: number;
  disk: number;
  region: {
    slug: string;
    name: string;
    available: boolean;
  };
  image: {
    id: number;
    name: string;
    distribution: string;
    slug: string;
  };
  size_slug: string;
  status: string;
  networks: {
    v4: Array<{
      ip_address: string;
      netmask: string;
      gateway: string;
      type: string;
    }>;
    v6: Array<{
      ip_address: string;
      netmask: number;
      gateway: string;
      type: string;
    }>;
  };
  created_at: string;
  tags: string[];
}

interface DigitalOceanAction {
  id: number;
  status: string;
  type: string;
  started_at: string;
  completed_at?: string;
  resource_id: number;
  resource_type: string;
  region?: {
    slug: string;
    name: string;
  };
}

export class DigitalOceanProvider extends BaseProvider {
  constructor(apiKey: string, apiUrl: string = 'https://api.digitalocean.com/v2') {
    super('digitalocean', apiKey, apiUrl, apiKey.length > 0);
  }

  /**
   * Make authenticated request to DigitalOcean API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.apiUrl);
      
      const options: https.RequestOptions = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: method.toUpperCase(),
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      };

      if (body) {
        const bodyString = JSON.stringify(body);
        (options.headers as any)!['Content-Length'] = Buffer.byteLength(bodyString);
      }

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (res.statusCode! >= 200 && res.statusCode! < 300) {
              resolve(response as T);
            } else {
              const message = response.message || response.error || `HTTP ${res.statusCode}`;
              logger.error('DigitalOcean API error', { statusCode: res.statusCode, message });
              reject(new CloudProviderError(message, 'digitalocean', { statusCode: res.statusCode }));
            }
          } catch (e) {
            reject(new CloudProviderError(
              `Failed to parse response: ${e instanceof Error ? e.message : 'Unknown error'}`,
              'digitalocean'
            ));
          }
        });
      });

      req.on('error', (error) => {
        logger.error('DigitalOcean API request failed', { error: error.message });
        reject(new CloudProviderError(error.message, 'digitalocean'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * Validate API credentials
   */
  async validateCredentials(): Promise<{ valid: boolean; message: string }> {
    try {
      await this.request('GET', '/account');
      return { valid: true, message: 'Credentials valid' };
    } catch (error) {
      return { 
        valid: false, 
        message: error instanceof Error ? error.message : 'Invalid credentials' 
      };
    }
  }

  /**
   * Get provider information
   */
  async getProviderInfo(): Promise<CloudProviderInfo> {
    try {
      // Fetch regions
      const regionsResponse = await this.request<{ regions: any[] }>('GET', '/regions');
      const regions = regionsResponse.regions
        .filter(r => r.available)
        .map(r => ({
          id: r.slug,
          name: r.name,
          available: r.available,
        }));

      // Fetch sizes
      const sizesResponse = await this.request<{ sizes: any[] }>('GET', '/sizes');
      const instance_types = sizesResponse.sizes
        .filter(s => s.available)
        .map(size => ({
          id: size.slug,
          name: `${size.vcpus} vCPUs, ${size.memory / 1024} GB RAM, ${size.disk} GB SSD`,
          cpu: size.vcpus,
          memory_gb: size.memory / 1024,
          disk_gb: size.disk,
          price_hourly: size.price_hourly,
          available: size.available,
        }));

      // Fetch images
      const imagesResponse = await this.request<{ images: any[] }>('GET', '/images?type=distribution&per_page=100');
      const images = imagesResponse.images.map(img => ({
        id: img.slug || img.id.toString(),
        name: img.description || img.name,
        distribution: img.distribution,
        version: img.name,
      }));

      return {
        id: 'digitalocean',
        name: 'DigitalOcean',
        enabled: this.isEnabled(),
        regions,
        instance_types,
        images,
      };
    } catch (error) {
      logger.error('Failed to get DigitalOcean provider info', { error });
      throw error;
    }
  }

  /**
   * Create a new droplet
   */
  async createInstance(options: CreateInstanceOptions): Promise<{
    instance: InstanceInfo;
    rootPassword?: string;
    action?: InstanceAction;
  }> {
    logger.info('Creating DigitalOcean droplet', { name: options.name, region: options.region });

    const body: any = {
      name: this.generateInstanceName(options.name),
      region: options.region,
      size: options.instanceType,
      image: options.image,
      tags: ['allternit', ...(options.tags ? Object.entries(options.tags).map(([k, v]) => `${k}:${v}`) : [])],
      monitoring: true,
    };

    if (options.sshKeys && options.sshKeys.length > 0) {
      body.ssh_keys = options.sshKeys.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    }

    if (options.userData) {
      body.user_data = options.userData;
    }

    try {
      const response = await this.request<{ droplet: DigitalOceanDroplet; links: any }>(
        'POST',
        '/droplets',
        body
      );

      logger.info('DigitalOcean droplet created', { 
        id: response.droplet.id, 
        name: response.droplet.name 
      });

      // Get the create action
      const actions = await this.request<{ actions: DigitalOceanAction[] }>(
        'GET',
        `/droplets/${response.droplet.id}/actions`
      );
      const createAction = actions.actions.find(a => a.type === 'create');

      return {
        instance: this.mapDropletToInstance(response.droplet),
        action: createAction ? this.mapAction(createAction) : undefined,
      };
    } catch (error) {
      logger.error('Failed to create DigitalOcean droplet', { error });
      throw error;
    }
  }

  /**
   * Get droplet by ID
   */
  async getInstance(instanceId: string): Promise<InstanceInfo | null> {
    try {
      const response = await this.request<{ droplet: DigitalOceanDroplet }>(
        'GET',
        `/droplets/${instanceId}`
      );
      return this.mapDropletToInstance(response.droplet);
    } catch (error) {
      if (error instanceof CloudProviderError && error.details?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List all droplets
   */
  async listInstances(): Promise<InstanceInfo[]> {
    try {
      const response = await this.request<{ droplets: DigitalOceanDroplet[] }>('GET', '/droplets');
      return response.droplets.map(droplet => this.mapDropletToInstance(droplet));
    } catch (error) {
      logger.error('Failed to list DigitalOcean droplets', { error });
      throw error;
    }
  }

  /**
   * Start a droplet (power on)
   */
  async startInstance(instanceId: string): Promise<InstanceAction> {
    try {
      const response = await this.request<{ action: DigitalOceanAction }>(
        'POST',
        `/droplets/${instanceId}/actions`,
        { type: 'power_on' }
      );
      return this.mapAction(response.action);
    } catch (error) {
      logger.error('Failed to start DigitalOcean droplet', { instanceId, error });
      throw error;
    }
  }

  /**
   * Stop a droplet (power off)
   */
  async stopInstance(instanceId: string): Promise<InstanceAction> {
    try {
      const response = await this.request<{ action: DigitalOceanAction }>(
        'POST',
        `/droplets/${instanceId}/actions`,
        { type: 'power_off' }
      );
      return this.mapAction(response.action);
    } catch (error) {
      logger.error('Failed to stop DigitalOcean droplet', { instanceId, error });
      throw error;
    }
  }

  /**
   * Reboot a droplet
   */
  async rebootInstance(instanceId: string): Promise<InstanceAction> {
    try {
      const response = await this.request<{ action: DigitalOceanAction }>(
        'POST',
        `/droplets/${instanceId}/actions`,
        { type: 'reboot' }
      );
      return this.mapAction(response.action);
    } catch (error) {
      logger.error('Failed to reboot DigitalOcean droplet', { instanceId, error });
      throw error;
    }
  }

  /**
   * Delete a droplet
   */
  async deleteInstance(instanceId: string): Promise<void> {
    try {
      await this.request('DELETE', `/droplets/${instanceId}`);
      logger.info('DigitalOcean droplet deleted', { instanceId });
    } catch (error) {
      logger.error('Failed to delete DigitalOcean droplet', { instanceId, error });
      throw error;
    }
  }

  /**
   * Get action details
   */
  async getAction(actionId: string): Promise<InstanceAction> {
    try {
      const response = await this.request<{ action: DigitalOceanAction }>(
        'GET',
        `/actions/${actionId}`
      );
      return this.mapAction(response.action);
    } catch (error) {
      logger.error('Failed to get DigitalOcean action', { actionId, error });
      throw error;
    }
  }

  /**
   * Get pricing estimate
   */
  async getPricingEstimate(
    region: string,
    instanceType: string,
    _hours: number
  ): Promise<DeploymentEstimate> {
    try {
      const response = await this.request<{ sizes: any[] }>('GET', '/sizes');
      const size = response.sizes.find(s => s.slug === instanceType);
      
      if (!size) {
        throw new CloudProviderError(`Unknown size: ${instanceType}`, 'digitalocean');
      }

      return {
        provider: 'digitalocean',
        region,
        instance_type: instanceType,
        hourly_cost: size.price_hourly,
        monthly_estimate: size.price_monthly,
        currency: 'USD',
      };
    } catch (error) {
      logger.error('Failed to get DigitalOcean pricing estimate', { region, instanceType, error });
      throw error;
    }
  }

  /**
   * List SSH keys
   */
  async listSSHKeys(): Promise<Array<{ id: string; name: string; fingerprint: string; publicKey: string }>> {
    try {
      const response = await this.request<{ ssh_keys: any[] }>('GET', '/account/keys');
      return response.ssh_keys.map(key => ({
        id: key.id.toString(),
        name: key.name,
        fingerprint: key.fingerprint,
        publicKey: key.public_key,
      }));
    } catch (error) {
      logger.error('Failed to list DigitalOcean SSH keys', { error });
      throw error;
    }
  }

  /**
   * Upload SSH key
   */
  async uploadSSHKey(name: string, publicKey: string): Promise<{ id: string; fingerprint: string }> {
    try {
      const response = await this.request<{ ssh_key: any }>('POST', '/account/keys', {
        name,
        public_key: publicKey,
      });
      return {
        id: response.ssh_key.id.toString(),
        fingerprint: response.ssh_key.fingerprint,
      };
    } catch (error) {
      logger.error('Failed to upload DigitalOcean SSH key', { name, error });
      throw error;
    }
  }

  /**
   * Delete SSH key
   */
  async deleteSSHKey(keyId: string): Promise<void> {
    try {
      await this.request('DELETE', `/account/keys/${keyId}`);
      logger.info('DigitalOcean SSH key deleted', { keyId });
    } catch (error) {
      logger.error('Failed to delete DigitalOcean SSH key', { keyId, error });
      throw error;
    }
  }

  /**
   * Map DigitalOcean droplet to InstanceInfo
   */
  private mapDropletToInstance(droplet: DigitalOceanDroplet): InstanceInfo {
    const publicV4 = droplet.networks.v4.find(n => n.type === 'public');
    const privateV4 = droplet.networks.v4.find(n => n.type === 'private');
    const publicV6 = droplet.networks.v6.find(n => n.type === 'public');

    return {
      id: droplet.id.toString(),
      name: droplet.name,
      status: this.mapInstanceStatus(droplet.status),
      ip: publicV4?.ip_address,
      ipv6: publicV6?.ip_address,
      privateIp: privateV4?.ip_address,
      region: droplet.region.slug,
      instanceType: droplet.size_slug,
      image: droplet.image?.slug || droplet.image?.name || 'unknown',
      createdAt: new Date(droplet.created_at),
      labels: droplet.tags.reduce((acc, tag) => {
        const [key, value] = tag.split(':');
        acc[key] = value || 'true';
        return acc;
      }, {} as Record<string, string>),
    };
  }

  /**
   * Map DigitalOcean action to InstanceAction
   */
  private mapAction(action: DigitalOceanAction): InstanceAction {
    return {
      id: action.id.toString(),
      status: action.status === 'in-progress' ? 'in_progress' : action.status,
      progress: action.status === 'completed' ? 100 : action.status === 'in-progress' ? 50 : 0,
      startedAt: new Date(action.started_at),
      completedAt: action.completed_at ? new Date(action.completed_at) : undefined,
    };
  }

  async getConsoleUrl(_instanceId: string): Promise<string | null> { return null; }
  async resetPassword(_instanceId: string): Promise<{ success: boolean; newPassword?: string }> { return { success: false }; }
  async createSnapshot(_instanceId: string, _name: string): Promise<{ id: string; status: string }> {
    throw new CloudProviderError('Not implemented', 'digitalocean');
  }

  /**
   * Map DigitalOcean droplet status to internal status
   */
  protected mapInstanceStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'new': 'pending',
      'active': 'running',
      'off': 'stopped',
      'archive': 'terminated',
    };
    return statusMap[status] || 'pending';
  }
}

export default DigitalOceanProvider;
