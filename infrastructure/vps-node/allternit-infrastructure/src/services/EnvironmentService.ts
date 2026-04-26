import { query, withTransaction } from '../config/database';
import { redis } from '../config/redis';
import {
  Environment,
  EnvironmentCreate,
  EnvironmentUpdate,
  EnvironmentTemplate,
  EnvironmentEvent,
  EnvironmentEventCreate,
  EnvironmentLogs,
  ProvisioningProgress,
} from '../models/Environment';
import { NotFoundError, ValidationError, DockerError } from '../utils/errors';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import {
  connectSSH,
  disconnectSSH,
  execCommand,
} from '../utils/ssh';
import {
  checkDocker,
  installDocker,
  deployCompose,
  stopCompose,
  getComposeLogs,
  listContainers,
  getContainer,
  getContainerLogs,
} from '../utils/docker';

export class EnvironmentService {
  /**
   * Get all environment templates
   */
  async getAllTemplates(): Promise<EnvironmentTemplate[]> {
    const result = await query<EnvironmentTemplate>(
      `SELECT id, name, description, docker_compose, environment_variables, 
              required_ports, volume_mappings, resource_limits, tags, is_active, created_at, updated_at
       FROM environment_templates 
       WHERE is_active = true
       ORDER BY name`
    );
    return result.rows;
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string): Promise<EnvironmentTemplate | null> {
    const result = await query<EnvironmentTemplate>(
      `SELECT id, name, description, docker_compose, environment_variables, 
              required_ports, volume_mappings, resource_limits, tags, is_active, created_at, updated_at
       FROM environment_templates 
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all environments
   */
  async getAllEnvironments(): Promise<Environment[]> {
    const result = await query<Environment>(
      `SELECT * FROM environments ORDER BY created_at DESC`
    );
    return result.rows;
  }

  /**
   * Get environment by ID
   */
  async getEnvironmentById(id: string): Promise<Environment | null> {
    const result = await query<Environment>(
      `SELECT * FROM environments WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new environment
   */
  async createEnvironment(data: EnvironmentCreate): Promise<Environment> {
    // Validate required fields
    if (!data.name || !data.template_id || !data.target_vps_id) {
      throw new ValidationError('Missing required fields: name, template_id, target_vps_id');
    }

    // Check if template exists
    const template = await this.getTemplateById(data.template_id);
    if (!template) {
      throw new NotFoundError('Environment template not found');
    }

    // Check if VPS exists
    const vps = await query('SELECT id, host, port, username, auth_type, credentials_encrypted, ssh_key_id FROM vps_connections WHERE id = $1', [data.target_vps_id]);
    if (vps.rows.length === 0) {
      throw new NotFoundError('Target VPS not found');
    }

    const id = uuidv4();
    const containerName = `allternit-env-${data.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    // Create environment record
    const result = await query<Environment>(
      `INSERT INTO environments 
       (id, name, template_id, target_vps_id, status, container_name, 
        environment_variables, ports, tags, health_status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [
        id,
        data.name,
        data.template_id,
        data.target_vps_id,
        'pending',
        containerName,
        JSON.stringify(data.environment_variables || {}),
        JSON.stringify(data.port_mappings || template.required_ports?.map(port => ({
          host: port,
          container: port,
          protocol: 'tcp',
        })) || []),
        data.tags || [],
        'starting',
      ]
    );

    const environment = result.rows[0];

    // Start provisioning asynchronously
    this.provisionEnvironment(environment, template, vps.rows[0]).catch(error => {
      logger.error('Environment provisioning failed', { environmentId: id, error });
    });

    logger.info('Environment created', { id, name: data.name, template: template.name });
    return environment;
  }

  /**
   * Provision environment (async)
   */
  private async provisionEnvironment(
    environment: Environment,
    template: EnvironmentTemplate,
    vpsData: any
  ): Promise<void> {
    try {
      await this.addEnvironmentEvent({
        environment_id: environment.id,
        event_type: 'provisioning',
        message: 'Starting environment provisioning',
        data: { template: template.name, vps: vpsData.host },
      });

      // Get VPS credentials
      let credentials: { password?: string; privateKey?: string; passphrase?: string } = {};
      
      if (vpsData.credentials_encrypted) {
        const decrypted = this.decrypt(vpsData.credentials_encrypted);
        const creds = JSON.parse(decrypted);
        credentials = {
          password: creds.password,
          privateKey: creds.private_key,
          passphrase: creds.passphrase,
        };
      }

      // Connect to VPS
      await this.updateEnvironmentStatus(environment.id, {
        status: 'provisioning',
        health_status: 'starting',
      });

      const sshConnection = await connectSSH({
        host: vpsData.host,
        port: vpsData.port,
        username: vpsData.username,
        ...credentials,
      });

      try {
        // Check Docker
        await this.addEnvironmentEvent({
          environment_id: environment.id,
          event_type: 'info',
          message: 'Checking Docker installation',
        });

        const dockerCheck = await checkDocker(sshConnection.client);
        
        if (!dockerCheck.installed) {
          await this.addEnvironmentEvent({
            environment_id: environment.id,
            event_type: 'info',
            message: 'Installing Docker',
          });
          await installDocker(sshConnection.client);
        }

        // Prepare docker-compose with environment variables
        let composeContent = template.docker_compose;
        const envVars = {
          ...template.environment_variables,
          ...environment.environment_variables,
        };

        // Replace environment variables in compose
        for (const [key, value] of Object.entries(envVars)) {
          composeContent = composeContent.replace(
            new RegExp(`\\$\\{${key}:-([^}]+)\\}`, 'g'),
            value as string
          );
          composeContent = composeContent.replace(
            new RegExp(`\\$\\{${key}\\}`, 'g'),
            value as string
          );
        }

        // Set container name
        composeContent = composeContent.replace(
          /container_name: .*/g,
          `container_name: ${environment.container_name}`
        );

        await this.updateEnvironmentStatus(environment.id, {
          status: 'provisioning',
          health_status: 'starting',
        });

        await this.addEnvironmentEvent({
          environment_id: environment.id,
          event_type: 'info',
          message: 'Deploying containers',
          data: { compose_file_size: composeContent.length },
        });

        // Deploy
        const deployResult = await deployCompose(
          sshConnection.client,
          composeContent,
          {
            projectName: `allternit-${environment.name}`,
          }
        );

        if (!deployResult.success) {
          throw new DockerError(`Deployment failed: ${deployResult.output}`);
        }

        // Get container info
        const containers = await listContainers(sshConnection.client);
        const container = containers.find(c => 
          c.names.some(n => n.includes(environment.container_name!))
        );

        if (container) {
          await query(
            `UPDATE environments 
             SET container_id = $1, ports = $2, status = 'running', 
                 started_at = NOW(), health_status = 'healthy', updated_at = NOW()
             WHERE id = $3`,
            [container.id, JSON.stringify(container.ports), environment.id]
          );
        }

        await this.addEnvironmentEvent({
          environment_id: environment.id,
          event_type: 'success',
          message: 'Environment provisioned successfully',
          data: { container_id: container?.id },
        });

        // Publish to Redis
        await redis.publish('environment:events', JSON.stringify({
          type: 'environment_ready',
          environment_id: environment.id,
          status: 'running',
        }));

      } finally {
        disconnectSSH(sshConnection.client);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.updateEnvironmentStatus(environment.id, {
        status: 'error',
        health_status: 'unhealthy',
        error_message: errorMessage,
      });

      await this.addEnvironmentEvent({
        environment_id: environment.id,
        event_type: 'error',
        message: `Provisioning failed: ${errorMessage}`,
      });

      throw error;
    }
  }

  /**
   * Update environment
   */
  async updateEnvironment(id: string, data: EnvironmentUpdate): Promise<Environment> {
    const existing = await this.getEnvironmentById(id);
    if (!existing) {
      throw new NotFoundError('Environment not found');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.environment_variables !== undefined) {
      updates.push(`environment_variables = $${paramIndex++}`);
      values.push(JSON.stringify(data.environment_variables));
    }
    if (data.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(data.tags);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query<Environment>(
      `UPDATE environments SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Update environment status
   */
  private async updateEnvironmentStatus(
    id: string,
    update: {
      status?: string;
      health_status?: string;
      error_message?: string;
      container_id?: string;
      ports?: any[];
    }
  ): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (update.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(update.status);
    }
    if (update.health_status !== undefined) {
      updates.push(`health_status = $${paramIndex++}`);
      values.push(update.health_status);
      if (update.health_status === 'healthy') {
        updates.push(`last_health_check = NOW()`);
      }
    }
    if (update.error_message !== undefined) {
      updates.push(`error_message = $${paramIndex++}`);
      values.push(update.error_message);
    }
    if (update.container_id !== undefined) {
      updates.push(`container_id = $${paramIndex++}`);
      values.push(update.container_id);
    }
    if (update.ports !== undefined) {
      updates.push(`ports = $${paramIndex++}`);
      values.push(JSON.stringify(update.ports));
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await query(
      `UPDATE environments SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
  }

  /**
   * Get environment logs
   */
  async getEnvironmentLogs(
    id: string,
    options: { tail?: number; since?: string } = {}
  ): Promise<EnvironmentLogs> {
    const environment = await this.getEnvironmentById(id);
    if (!environment) {
      throw new NotFoundError('Environment not found');
    }

    if (!environment.target_vps_id) {
      return { environment_id: id, entries: [], total_count: 0 };
    }

    // Get VPS connection
    const vps = await query(
      `SELECT host, port, username, auth_type, credentials_encrypted, ssh_key_id 
       FROM vps_connections WHERE id = $1`,
      [environment.target_vps_id]
    );

    if (vps.rows.length === 0) {
      throw new NotFoundError('VPS not found');
    }

    const vpsData = vps.rows[0];

    // Get credentials
    let credentials: { password?: string; privateKey?: string; passphrase?: string } = {};
    
    if (vpsData.credentials_encrypted) {
      const decrypted = this.decrypt(vpsData.credentials_encrypted);
      const creds = JSON.parse(decrypted);
      credentials = {
        password: creds.password,
        privateKey: creds.private_key,
        passphrase: creds.passphrase,
      };
    }

    const sshConnection = await connectSSH({
      host: vpsData.host,
      port: vpsData.port,
      username: vpsData.username,
      ...credentials,
    });

    try {
      const logs = await getComposeLogs(
        sshConnection.client,
        `/tmp/allternit-compose/allternit-${environment.name}`,
        {
          tail: options.tail || 100,
        }
      );

      const entries = logs.split('\n').map(line => ({
        timestamp: new Date(),
        source: 'stdout' as const,
        message: line,
      }));

      return {
        environment_id: id,
        entries,
        total_count: entries.length,
      };
    } finally {
      disconnectSSH(sshConnection.client);
    }
  }

  /**
   * Destroy environment
   */
  async destroyEnvironment(id: string): Promise<void> {
    const environment = await this.getEnvironmentById(id);
    if (!environment) {
      throw new NotFoundError('Environment not found');
    }

    if (environment.target_vps_id && environment.status !== 'destroyed') {
      try {
        // Get VPS connection
        const vps = await query(
          `SELECT host, port, username, auth_type, credentials_encrypted, ssh_key_id 
           FROM vps_connections WHERE id = $1`,
          [environment.target_vps_id]
        );

        if (vps.rows.length > 0) {
          const vpsData = vps.rows[0];

          let credentials: { password?: string; privateKey?: string; passphrase?: string } = {};
          
          if (vpsData.credentials_encrypted) {
            const decrypted = this.decrypt(vpsData.credentials_encrypted);
            const creds = JSON.parse(decrypted);
            credentials = {
              password: creds.password,
              privateKey: creds.private_key,
              passphrase: creds.passphrase,
            };
          }

          const sshConnection = await connectSSH({
            host: vpsData.host,
            port: vpsData.port,
            username: vpsData.username,
            ...credentials,
          });

          try {
            await stopCompose(
              sshConnection.client,
              `/tmp/allternit-compose/allternit-${environment.name}`,
              { removeVolumes: true }
            );
          } finally {
            disconnectSSH(sshConnection.client);
          }
        }
      } catch (error) {
        logger.error('Failed to stop environment containers', { environmentId: id, error });
      }
    }

    await query(
      `UPDATE environments 
       SET status = 'destroyed', destroyed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    await this.addEnvironmentEvent({
      environment_id: id,
      event_type: 'info',
      message: 'Environment destroyed',
    });

    logger.info('Environment destroyed', { id });
  }

  /**
   * Add environment event
   */
  async addEnvironmentEvent(data: EnvironmentEventCreate): Promise<EnvironmentEvent> {
    const id = uuidv4();
    const result = await query<EnvironmentEvent>(
      `INSERT INTO environment_events (id, environment_id, event_type, message, data, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [id, data.environment_id, data.event_type, data.message, JSON.stringify(data.data || {})]
    );

    // Publish to Redis
    await redis.publish(`environment:${data.environment_id}:events`, JSON.stringify({
      type: data.event_type,
      message: data.message,
      data: data.data,
      timestamp: new Date().toISOString(),
    }));

    return result.rows[0];
  }

  /**
   * Get environment events
   */
  async getEnvironmentEvents(environmentId: string, limit: number = 100): Promise<EnvironmentEvent[]> {
    const result = await query<EnvironmentEvent>(
      `SELECT * FROM environment_events 
       WHERE environment_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [environmentId, limit]
    );
    return result.rows;
  }

  /**
   * Decrypt credentials (same as in VPSService)
   */
  private decrypt(encryptedText: string): string {
    const key = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'default-key').digest();
    const parts = encryptedText.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted format');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

export default new EnvironmentService();
