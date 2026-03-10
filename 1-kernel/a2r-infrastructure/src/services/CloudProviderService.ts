import { query, withTransaction } from '../config/database';
import { redis } from '../config/redis';
import {
  CloudDeployment,
  CloudDeploymentCreate,
  CloudDeploymentUpdate,
  DeploymentEvent,
  DeploymentEventCreate,
  DeploymentStatusUpdate,
  CloudProviderInfo,
  DeploymentEstimate,
} from '../models/Deployment';
import HetznerProvider from '../providers/HetznerProvider';
import DigitalOceanProvider from '../providers/DigitalOceanProvider';
import AWSProvider from '../providers/AWSProvider';
import BaseProvider from '../providers/BaseProvider';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError, CloudProviderError, BadRequestError } from '../utils/errors';
import config from '../config';
import { v4 as uuidv4 } from 'uuid';

export class CloudProviderService {
  private providers: Map<string, BaseProvider>;

  constructor() {
    this.providers = new Map();
    
    // Initialize providers
    if (config.cloudProviders.hetzner.enabled && config.cloudProviders.hetzner.apiKey) {
      this.providers.set('hetzner', new HetznerProvider(
        config.cloudProviders.hetzner.apiKey,
        config.cloudProviders.hetzner.apiUrl
      ));
    }
    
    if (config.cloudProviders.digitalOcean.enabled && config.cloudProviders.digitalOcean.apiKey) {
      this.providers.set('digitalocean', new DigitalOceanProvider(
        config.cloudProviders.digitalOcean.apiKey,
        config.cloudProviders.digitalOcean.apiUrl
      ));
    }
    
    if (config.cloudProviders.aws.enabled && config.cloudProviders.aws.accessKeyId) {
      this.providers.set('aws', new AWSProvider(
        config.cloudProviders.aws.accessKeyId,
        config.cloudProviders.aws.secretAccessKey,
        config.cloudProviders.aws.defaultRegion
      ));
    }
  }

  /**
   * Get all available providers
   */
  getProviders(): string[] {
    return Array.from(this.providers.keys()).filter(p => 
      this.providers.get(p)?.isEnabled()
    );
  }

  /**
   * Get provider instance
   */
  private getProvider(provider: string): BaseProvider {
    const p = this.providers.get(provider);
    if (!p || !p.isEnabled()) {
      throw new BadRequestError(`Provider ${provider} is not available`);
    }
    return p;
  }

  /**
   * Get provider information
   */
  async getProviderInfo(provider: string): Promise<CloudProviderInfo> {
    const p = this.getProvider(provider);
    return await p.getProviderInfo();
  }

  /**
   * Get all providers information
   */
  async getAllProvidersInfo(): Promise<CloudProviderInfo[]> {
    const results: CloudProviderInfo[] = [];
    
    for (const [name, provider] of this.providers) {
      if (provider.isEnabled()) {
        try {
          const info = await provider.getProviderInfo();
          results.push(info);
        } catch (error) {
          logger.error(`Failed to get info for provider ${name}`, { error });
        }
      }
    }
    
    return results;
  }

  /**
   * Validate provider credentials
   */
  async validateCredentials(provider: string): Promise<{ valid: boolean; message: string }> {
    try {
      const p = this.getProvider(provider);
      return await p.validateCredentials();
    } catch (error) {
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get pricing estimate
   */
  async getPricingEstimate(
    provider: string,
    region: string,
    instanceType: string,
    hours: number = 730
  ): Promise<DeploymentEstimate> {
    const p = this.getProvider(provider);
    return await p.getPricingEstimate(region, instanceType, hours);
  }

  /**
   * Create a new deployment
   */
  async createDeployment(data: CloudDeploymentCreate): Promise<CloudDeployment> {
    // Validate required fields
    if (!data.name || !data.provider || !data.region || !data.instance_type) {
      throw new ValidationError('Missing required fields');
    }

    const provider = this.getProvider(data.provider);
    const id = uuidv4();

    // Create deployment record
    const result = await query<CloudDeployment>(
      `INSERT INTO cloud_deployments 
       (id, name, provider, region, instance_type, status, progress, config, ssh_key_id, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [
        id,
        data.name,
        data.provider,
        data.region,
        data.instance_type,
        'pending',
        0,
        JSON.stringify({
          image: data.image,
          ssh_keys: data.ssh_keys,
          user_data: data.user_data,
          volumes: data.volumes,
          networks: data.networks,
          labels: data.labels,
        }),
        data.ssh_key_id || null,
        data.tags || [],
      ]
    );

    const deployment = result.rows[0];

    // Start deployment asynchronously
    this.provisionDeployment(deployment).catch(error => {
      logger.error('Deployment provisioning failed', { deploymentId: id, error });
    });

    logger.info('Deployment created', { id, provider: data.provider, name: data.name });
    return deployment;
  }

  /**
   * Provision deployment (async)
   */
  private async provisionDeployment(deployment: CloudDeployment): Promise<void> {
    try {
      const provider = this.getProvider(deployment.provider);
      
      // Update status to provisioning
      await this.updateDeploymentStatus(deployment.id, {
        status: 'provisioning',
        progress: 10,
      });

      await this.addDeploymentEvent({
        deployment_id: deployment.id,
        event_type: 'info',
        message: 'Starting instance provisioning',
        data: { region: deployment.region, instance_type: deployment.instance_type },
      });

      // Get SSH keys if specified
      let sshKeyIds: string[] = [];
      if (deployment.config?.ssh_keys) {
        sshKeyIds = deployment.config.ssh_keys;
      } else if (deployment.ssh_key_id) {
        // Upload SSH key to provider if needed
        const sshKey = await query('SELECT name, public_key FROM ssh_keys WHERE id = $1', [deployment.ssh_key_id]);
        if (sshKey.rows.length > 0) {
          try {
            const uploadedKey = await provider.uploadSSHKey?.(
              `a2r-${deployment.name}`,
              sshKey.rows[0].public_key
            );
            if (uploadedKey) {
              sshKeyIds = [uploadedKey.id];
            }
          } catch (e) {
            logger.warn('Failed to upload SSH key to provider, will use password auth', { error: e });
          }
        }
      }

      await this.updateDeploymentStatus(deployment.id, { progress: 30 });

      // Create instance
      const instanceResult = await provider.createInstance({
        name: deployment.name,
        region: deployment.region,
        instanceType: deployment.instance_type,
        image: deployment.config?.image || 'ubuntu-22.04',
        sshKeys: sshKeyIds,
        userData: deployment.config?.user_data,
        tags: {
          managed_by: 'a2r',
          deployment_id: deployment.id,
          ...deployment.config?.labels,
        },
        volumes: deployment.config?.volumes,
        networks: deployment.config?.networks,
      });

      await this.addDeploymentEvent({
        deployment_id: deployment.id,
        event_type: 'success',
        message: 'Instance created successfully',
        data: { instance_id: instanceResult.instance.id },
      });

      // Update deployment with instance info
      await this.updateDeploymentStatus(deployment.id, {
        status: 'provisioning',
        progress: 50,
        instance_id: instanceResult.instance.id,
        instance_ip: instanceResult.instance.ip,
        instance_ipv6: instanceResult.instance.ipv6,
      });

      // Store root password if provided
      if (instanceResult.rootPassword) {
        await query(
          'UPDATE cloud_deployments SET root_password_encrypted = $1 WHERE id = $2',
          [instanceResult.rootPassword, deployment.id]
        );
      }

      // Wait for instance to be ready
      if (instanceResult.action) {
        await provider.waitForAction(instanceResult.action.id, 10000, 600000);
      }

      // Wait a bit for network to be ready
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Get updated instance info
      const updatedInstance = await provider.getInstance(instanceResult.instance.id);
      
      await this.updateDeploymentStatus(deployment.id, {
        status: 'running',
        progress: 100,
        instance_ip: updatedInstance?.ip || instanceResult.instance.ip,
        instance_ipv6: updatedInstance?.ipv6 || instanceResult.instance.ipv6,
      });

      await this.addDeploymentEvent({
        deployment_id: deployment.id,
        event_type: 'success',
        message: 'Deployment completed successfully',
        data: { 
          instance_id: instanceResult.instance.id,
          ip: updatedInstance?.ip,
          ipv6: updatedInstance?.ipv6,
        },
      });

      // Publish to Redis for WebSocket notification
      await redis.publish('deployment:events', JSON.stringify({
        type: 'deployment_completed',
        deployment_id: deployment.id,
        status: 'running',
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.updateDeploymentStatus(deployment.id, {
        status: 'error',
        error_message: errorMessage,
      });

      await this.addDeploymentEvent({
        deployment_id: deployment.id,
        event_type: 'error',
        message: `Deployment failed: ${errorMessage}`,
      });

      throw error;
    }
  }

  /**
   * Get all deployments
   */
  async getAllDeployments(): Promise<CloudDeployment[]> {
    const result = await query<CloudDeployment>(
      `SELECT * FROM cloud_deployments ORDER BY created_at DESC`
    );
    return result.rows;
  }

  /**
   * Get deployment by ID
   */
  async getDeploymentById(id: string): Promise<CloudDeployment | null> {
    const result = await query<CloudDeployment>(
      `SELECT * FROM cloud_deployments WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Update deployment status
   */
  async updateDeploymentStatus(id: string, update: DeploymentStatusUpdate): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (update.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(update.status);
      
      if (update.status === 'running') {
        updates.push(`started_at = COALESCE(started_at, NOW())`);
        updates.push(`completed_at = NOW()`);
      }
      if (update.status === 'terminating') {
        updates.push(`terminated_at = NOW()`);
      }
    }
    if (update.progress !== undefined) {
      updates.push(`progress = $${paramIndex++}`);
      values.push(update.progress);
    }
    if (update.instance_id !== undefined) {
      updates.push(`instance_id = $${paramIndex++}`);
      values.push(update.instance_id);
    }
    if (update.instance_ip !== undefined) {
      updates.push(`instance_ip = $${paramIndex++}`);
      values.push(update.instance_ip);
    }
    if (update.instance_ipv6 !== undefined) {
      updates.push(`instance_ipv6 = $${paramIndex++}`);
      values.push(update.instance_ipv6);
    }
    if (update.error_message !== undefined) {
      updates.push(`error_message = $${paramIndex++}`);
      values.push(update.error_message);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await query(
      `UPDATE cloud_deployments SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
  }

  /**
   * Delete/Cancel deployment
   */
  async deleteDeployment(id: string): Promise<void> {
    const deployment = await this.getDeploymentById(id);
    if (!deployment) {
      throw new NotFoundError('Deployment not found');
    }

    // If instance exists, terminate it
    if (deployment.instance_id && deployment.status !== 'terminated') {
      try {
        const provider = this.getProvider(deployment.provider);
        await provider.deleteInstance(deployment.instance_id);
        
        await this.updateDeploymentStatus(id, { status: 'terminating' });
        
        await this.addDeploymentEvent({
          deployment_id: id,
          event_type: 'info',
          message: 'Instance termination initiated',
        });
      } catch (error) {
        logger.error('Failed to terminate instance', { deploymentId: id, error });
      }
    }

    // Delete from database
    await withTransaction(async (client) => {
      await client.query('DELETE FROM deployment_events WHERE deployment_id = $1', [id]);
      await client.query('DELETE FROM cloud_deployments WHERE id = $1', [id]);
    });

    logger.info('Deployment deleted', { id });
  }

  /**
   * Add deployment event
   */
  async addDeploymentEvent(data: DeploymentEventCreate): Promise<DeploymentEvent> {
    const id = uuidv4();
    const result = await query<DeploymentEvent>(
      `INSERT INTO deployment_events (id, deployment_id, event_type, message, data, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [id, data.deployment_id, data.event_type, data.message, JSON.stringify(data.data || {})]
    );

    // Publish to Redis for real-time updates
    await redis.publish(`deployment:${data.deployment_id}:events`, JSON.stringify({
      type: data.event_type,
      message: data.message,
      data: data.data,
      timestamp: new Date().toISOString(),
    }));

    return result.rows[0];
  }

  /**
   * Get deployment events
   */
  async getDeploymentEvents(deploymentId: string, limit: number = 100): Promise<DeploymentEvent[]> {
    const result = await query<DeploymentEvent>(
      `SELECT * FROM deployment_events 
       WHERE deployment_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [deploymentId, limit]
    );
    return result.rows;
  }

  /**
   * Sync deployment status with provider
   */
  async syncDeploymentStatus(id: string): Promise<CloudDeployment> {
    const deployment = await this.getDeploymentById(id);
    if (!deployment) {
      throw new NotFoundError('Deployment not found');
    }

    if (!deployment.instance_id) {
      return deployment;
    }

    const provider = this.getProvider(deployment.provider);
    const instance = await provider.getInstance(deployment.instance_id);

    if (instance) {
      await this.updateDeploymentStatus(id, {
        status: instance.status as any,
        instance_ip: instance.ip,
        instance_ipv6: instance.ipv6,
      });
    } else if (deployment.status !== 'terminated') {
      // Instance no longer exists in provider
      await this.updateDeploymentStatus(id, { status: 'terminated' });
    }

    return await this.getDeploymentById(id) as CloudDeployment;
  }
}

export default new CloudProviderService();
