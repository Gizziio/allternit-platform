import https from 'https';
import { BaseProvider, CreateInstanceOptions, InstanceInfo, InstanceAction } from './BaseProvider';
import { CloudProviderInfo, DeploymentEstimate } from '../models/Deployment';
import { logger } from '../utils/logger';
import { CloudProviderError } from '../utils/errors';

interface HetznerServer {
  id: number;
  name: string;
  status: string;
  server_type: {
    id: number;
    name: string;
    description: string;
    cores: number;
    memory: number;
    disk: number;
    prices: Array<{
      location: string;
      price_hourly: {
        net: string;
        gross: string;
      };
    }>;
  };
  public_net: {
    ipv4?: {
      ip: string;
      blocked: boolean;
    };
    ipv6?: {
      ip: string;
      blocked: boolean;
    };
  };
  private_net: Array<any>;
  datacenter: {
    id: number;
    name: string;
    location: {
      id: number;
      name: string;
      description: string;
    };
  };
  image?: {
    id: number;
    name: string;
    description: string;
    os_flavor: string;
    os_version: string;
  };
  labels: Record<string, string>;
  created: string;
}

interface HetznerAction {
  id: number;
  command: string;
  status: string;
  progress: number;
  started: string;
  finished?: string;
  error?: {
    code: string;
    message: string;
  };
  resources: Array<{
    id: number;
    type: string;
  }>;
}

export class HetznerProvider extends BaseProvider {
  constructor(apiKey: string, apiUrl: string = 'https://api.hetzner.cloud/v1') {
    super('hetzner', apiKey, apiUrl, apiKey.length > 0);
  }

  /**
   * Make authenticated request to Hetzner API
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
        options.headers!['Content-Length'] = Buffer.byteLength(bodyString);
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
              const error = response.error || { message: `HTTP ${res.statusCode}` };
              logger.error('Hetzner API error', { statusCode: res.statusCode, error });
              reject(new CloudProviderError(
                error.message,
                'hetzner',
                { statusCode: res.statusCode, code: error.code }
              ));
            }
          } catch (e) {
            reject(new CloudProviderError(
              `Failed to parse response: ${e instanceof Error ? e.message : 'Unknown error'}`,
              'hetzner'
            ));
          }
        });
      });

      req.on('error', (error) => {
        logger.error('Hetzner API request failed', { error: error.message });
        reject(new CloudProviderError(error.message, 'hetzner'));
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
      await this.request('GET', '/servers');
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
      // Fetch locations
      const locationsResponse = await this.request<{ locations: any[] }>('GET', '/locations');
      const regions = locationsResponse.locations.map(loc => ({
        id: loc.name,
        name: loc.description,
        available: true,
      }));

      // Fetch server types
      const serverTypesResponse = await this.request<{ server_types: any[] }>('GET', '/server_types');
      const instance_types = serverTypesResponse.server_types.map(type => ({
        id: type.name,
        name: type.description,
        cpu: type.cores,
        memory_gb: type.memory / 1024,
        disk_gb: type.disk,
        price_hourly: parseFloat(type.prices[0]?.price_hourly?.gross || '0'),
        available: true,
      }));

      // Fetch images
      const imagesResponse = await this.request<{ images: any[] }>('GET', '/images?type=system');
      const images = imagesResponse.images.map(img => ({
        id: img.id.toString(),
        name: img.description || img.name,
        distribution: img.os_flavor,
        version: img.os_version,
      }));

      return {
        id: 'hetzner',
        name: 'Hetzner Cloud',
        enabled: this.isEnabled(),
        regions,
        instance_types,
        images,
      };
    } catch (error) {
      logger.error('Failed to get Hetzner provider info', { error });
      throw error;
    }
  }

  /**
   * Create a new server instance
   */
  async createInstance(options: CreateInstanceOptions): Promise<{
    instance: InstanceInfo;
    rootPassword?: string;
    action?: InstanceAction;
  }> {
    logger.info('Creating Hetzner server', { name: options.name, region: options.region });

    const body: any = {
      name: this.generateInstanceName(options.name),
      server_type: options.instanceType,
      image: options.image,
      location: options.region,
      labels: {
        'managed-by': 'allternit',
        ...options.tags,
      },
    };

    if (options.sshKeys && options.sshKeys.length > 0) {
      body.ssh_keys = options.sshKeys.map(key => parseInt(key, 10)).filter(id => !isNaN(id));
    }

    if (options.userData) {
      body.user_data = Buffer.from(options.userData).toString('base64');
    }

    if (options.networks && options.networks.length > 0) {
      body.networks = options.networks.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    }

    try {
      const response = await this.request<{ server: HetznerServer; action: HetznerAction; root_password: string }>(
        'POST',
        '/servers',
        body
      );

      logger.info('Hetzner server created', { 
        id: response.server.id, 
        name: response.server.name 
      });

      return {
        instance: this.mapServerToInstance(response.server),
        rootPassword: response.root_password,
        action: this.mapAction(response.action),
      };
    } catch (error) {
      logger.error('Failed to create Hetzner server', { error });
      throw error;
    }
  }

  /**
   * Get server by ID
   */
  async getInstance(instanceId: string): Promise<InstanceInfo | null> {
    try {
      const response = await this.request<{ server: HetznerServer }>(
        'GET',
        `/servers/${instanceId}`
      );
      return this.mapServerToInstance(response.server);
    } catch (error) {
      if (error instanceof CloudProviderError && error.details?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List all servers
   */
  async listInstances(): Promise<InstanceInfo[]> {
    try {
      const response = await this.request<{ servers: HetznerServer[] }>('GET', '/servers');
      return response.servers.map(server => this.mapServerToInstance(server));
    } catch (error) {
      logger.error('Failed to list Hetzner servers', { error });
      throw error;
    }
  }

  /**
   * Start a server
   */
  async startInstance(instanceId: string): Promise<InstanceAction> {
    try {
      const response = await this.request<{ action: HetznerAction }>(
        'POST',
        `/servers/${instanceId}/actions/poweron`
      );
      return this.mapAction(response.action);
    } catch (error) {
      logger.error('Failed to start Hetzner server', { instanceId, error });
      throw error;
    }
  }

  /**
   * Stop a server
   */
  async stopInstance(instanceId: string): Promise<InstanceAction> {
    try {
      const response = await this.request<{ action: HetznerAction }>(
        'POST',
        `/servers/${instanceId}/actions/poweroff`
      );
      return this.mapAction(response.action);
    } catch (error) {
      logger.error('Failed to stop Hetzner server', { instanceId, error });
      throw error;
    }
  }

  /**
   * Reboot a server
   */
  async rebootInstance(instanceId: string): Promise<InstanceAction> {
    try {
      const response = await this.request<{ action: HetznerAction }>(
        'POST',
        `/servers/${instanceId}/actions/reboot`
      );
      return this.mapAction(response.action);
    } catch (error) {
      logger.error('Failed to reboot Hetzner server', { instanceId, error });
      throw error;
    }
  }

  /**
   * Delete/Terminate a server
   */
  async deleteInstance(instanceId: string): Promise<void> {
    try {
      await this.request('DELETE', `/servers/${instanceId}`);
      logger.info('Hetzner server deleted', { instanceId });
    } catch (error) {
      logger.error('Failed to delete Hetzner server', { instanceId, error });
      throw error;
    }
  }

  /**
   * Get action details
   */
  async getAction(actionId: string): Promise<InstanceAction> {
    try {
      const response = await this.request<{ action: HetznerAction }>(
        'GET',
        `/actions/${actionId}`
      );
      return this.mapAction(response.action);
    } catch (error) {
      logger.error('Failed to get Hetzner action', { actionId, error });
      throw error;
    }
  }

  /**
   * Get pricing estimate
   */
  async getPricingEstimate(
    region: string,
    instanceType: string,
    hours: number
  ): Promise<DeploymentEstimate> {
    try {
      const response = await this.request<{ server_types: any[] }>('GET', '/server_types');
      const serverType = response.server_types.find(st => st.name === instanceType);
      
      if (!serverType) {
        throw new CloudProviderError(`Unknown server type: ${instanceType}`, 'hetzner');
      }

      const priceInfo = serverType.prices.find(p => p.location === region);
      const hourlyPrice = priceInfo ? parseFloat(priceInfo.price_hourly.gross) : 0;

      return {
        provider: 'hetzner',
        region,
        instance_type: instanceType,
        hourly_cost: hourlyPrice,
        monthly_estimate: hourlyPrice * 730, // Average hours per month
        currency: 'EUR',
      };
    } catch (error) {
      logger.error('Failed to get Hetzner pricing estimate', { region, instanceType, error });
      throw error;
    }
  }

  /**
   * List SSH keys
   */
  async listSSHKeys(): Promise<Array<{ id: string; name: string; fingerprint: string; publicKey: string }>> {
    try {
      const response = await this.request<{ ssh_keys: any[] }>('GET', '/ssh_keys');
      return response.ssh_keys.map(key => ({
        id: key.id.toString(),
        name: key.name,
        fingerprint: key.fingerprint,
        publicKey: key.public_key,
      }));
    } catch (error) {
      logger.error('Failed to list Hetzner SSH keys', { error });
      throw error;
    }
  }

  /**
   * Upload SSH key
   */
  async uploadSSHKey(name: string, publicKey: string): Promise<{ id: string; fingerprint: string }> {
    try {
      const response = await this.request<{ ssh_key: any }>('POST', '/ssh_keys', {
        name,
        public_key: publicKey,
      });
      return {
        id: response.ssh_key.id.toString(),
        fingerprint: response.ssh_key.fingerprint,
      };
    } catch (error) {
      logger.error('Failed to upload Hetzner SSH key', { name, error });
      throw error;
    }
  }

  /**
   * Delete SSH key
   */
  async deleteSSHKey(keyId: string): Promise<void> {
    try {
      await this.request('DELETE', `/ssh_keys/${keyId}`);
      logger.info('Hetzner SSH key deleted', { keyId });
    } catch (error) {
      logger.error('Failed to delete Hetzner SSH key', { keyId, error });
      throw error;
    }
  }

  /**
   * Reset server password
   */
  async resetPassword(instanceId: string): Promise<{ success: boolean; newPassword?: string }> {
    try {
      const response = await this.request<{ action: HetznerAction; root_password: string }>(
        'POST',
        `/servers/${instanceId}/actions/reset_password`
      );
      return {
        success: true,
        newPassword: response.root_password,
      };
    } catch (error) {
      logger.error('Failed to reset Hetzner server password', { instanceId, error });
      throw error;
    }
  }

  /**
   * Create server snapshot
   */
  async createSnapshot(instanceId: string, name: string): Promise<{ id: string; status: string }> {
    try {
      const response = await this.request<{ action: HetznerAction; image: any }>(
        'POST',
        `/servers/${instanceId}/actions/create_image`,
        { description: name, type: 'snapshot' }
      );
      return {
        id: response.image.id.toString(),
        status: response.image.status,
      };
    } catch (error) {
      logger.error('Failed to create Hetzner snapshot', { instanceId, name, error });
      throw error;
    }
  }

  /**
   * Map Hetzner server to InstanceInfo
   */
  private mapServerToInstance(server: HetznerServer): InstanceInfo {
    return {
      id: server.id.toString(),
      name: server.name,
      status: this.mapInstanceStatus(server.status),
      ip: server.public_net.ipv4?.ip,
      ipv6: server.public_net.ipv6?.ip,
      privateIp: server.private_net?.[0]?.ip,
      region: server.datacenter.location.name,
      instanceType: server.server_type.name,
      image: server.image?.name || 'unknown',
      createdAt: new Date(server.created),
      labels: server.labels,
    };
  }

  /**
   * Map Hetzner action to InstanceAction
   */
  private mapAction(action: HetznerAction): InstanceAction {
    return {
      id: action.id.toString(),
      status: action.status === 'running' ? 'in_progress' : action.status,
      progress: action.progress,
      startedAt: new Date(action.started),
      completedAt: action.finished ? new Date(action.finished) : undefined,
      error: action.error?.message,
    };
  }

  /**
   * Map Hetzner server status to internal status
   */
  protected mapInstanceStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'running': 'running',
      'initializing': 'provisioning',
      'starting': 'provisioning',
      'stopping': 'stopping',
      'off': 'stopped',
      'deleting': 'terminating',
      'migrating': 'provisioning',
      'rebuilding': 'provisioning',
      'unknown': 'error',
    };
    return statusMap[status] || 'pending';
  }
}

export default HetznerProvider;
