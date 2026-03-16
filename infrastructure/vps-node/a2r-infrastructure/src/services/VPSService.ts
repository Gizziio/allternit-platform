import { query, withTransaction } from '../config/database';
import {
  VPSConnection,
  VPSConnectionCreate,
  VPSConnectionUpdate,
  VPSConnectionTestResult,
  VPSCommandResult,
  VPSConnectionAttempt,
} from '../models/VPSConnection';
import {
  connectSSH,
  disconnectSSH,
  execCommand,
  testSSHConnection,
  addAuthorizedKey,
  installA2RNode,
} from '../utils/ssh';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError, SSHConnectionError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import config from '../config';

// Simple encryption for credentials (in production, use a proper KMS)
function encrypt(text: string): string {
  const key = crypto.createHash('sha256').update(config.security.encryptionKey).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  const key = crypto.createHash('sha256').update(config.security.encryptionKey).digest();
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

export class VPSService {
  /**
   * Get all VPS connections
   */
  async getAllConnections(): Promise<VPSConnection[]> {
    const result = await query<VPSConnection>(
      `SELECT id, name, host, port, auth_type, username, ssh_key_id, status, 
              last_connected, last_error, tags, metadata, created_at, updated_at 
       FROM vps_connections 
       ORDER BY created_at DESC`
    );
    return result.rows;
  }

  /**
   * Get VPS connection by ID
   */
  async getConnectionById(id: string): Promise<VPSConnection | null> {
    const result = await query<VPSConnection>(
      `SELECT id, name, host, port, auth_type, username, ssh_key_id, status, 
              last_connected, last_error, tags, metadata, created_at, updated_at 
       FROM vps_connections 
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new VPS connection
   */
  async createConnection(data: VPSConnectionCreate): Promise<VPSConnection> {
    // Validate required fields
    if (!data.name || !data.host || !data.username) {
      throw new ValidationError('Missing required fields', [
        { field: 'name', message: 'Name is required' },
        { field: 'host', message: 'Host is required' },
        { field: 'username', message: 'Username is required' },
      ]);
    }

    // Validate authentication
    if (data.auth_type === 'password' && !data.password) {
      throw new ValidationError('Password is required for password authentication');
    }
    if (data.auth_type === 'private_key' && !data.private_key && !data.ssh_key_id) {
      throw new ValidationError('Private key or SSH key ID is required for key authentication');
    }

    const id = uuidv4();
    const port = data.port || 22;

    // Encrypt credentials
    let credentialsEncrypted: string | null = null;
    if (data.password) {
      credentialsEncrypted = encrypt(JSON.stringify({ password: data.password }));
    } else if (data.private_key) {
      credentialsEncrypted = encrypt(JSON.stringify({
        private_key: data.private_key,
        passphrase: data.passphrase,
      }));
    }

    const result = await query<VPSConnection>(
      `INSERT INTO vps_connections 
       (id, name, host, port, auth_type, username, credentials_encrypted, ssh_key_id, 
        status, tags, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
       RETURNING id, name, host, port, auth_type, username, ssh_key_id, status, 
                 last_connected, last_error, tags, metadata, created_at, updated_at`,
      [
        id,
        data.name,
        data.host,
        port,
        data.auth_type,
        data.username,
        credentialsEncrypted,
        data.ssh_key_id || null,
        'pending',
        data.tags || [],
        JSON.stringify(data.metadata || {}),
      ]
    );

    logger.info('VPS connection created', { id, name: data.name, host: data.host });
    return result.rows[0];
  }

  /**
   * Update VPS connection
   */
  async updateConnection(id: string, data: VPSConnectionUpdate): Promise<VPSConnection> {
    const existing = await this.getConnectionById(id);
    if (!existing) {
      throw new NotFoundError('VPS connection not found');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.host !== undefined) {
      updates.push(`host = $${paramIndex++}`);
      values.push(data.host);
    }
    if (data.port !== undefined) {
      updates.push(`port = $${paramIndex++}`);
      values.push(data.port);
    }
    if (data.auth_type !== undefined) {
      updates.push(`auth_type = $${paramIndex++}`);
      values.push(data.auth_type);
    }
    if (data.username !== undefined) {
      updates.push(`username = $${paramIndex++}`);
      values.push(data.username);
    }
    if (data.password !== undefined) {
      const encrypted = encrypt(JSON.stringify({ password: data.password }));
      updates.push(`credentials_encrypted = $${paramIndex++}`);
      values.push(encrypted);
    }
    if (data.private_key !== undefined) {
      const encrypted = encrypt(JSON.stringify({
        private_key: data.private_key,
        passphrase: data.passphrase,
      }));
      updates.push(`credentials_encrypted = $${paramIndex++}`);
      values.push(encrypted);
    }
    if (data.ssh_key_id !== undefined) {
      updates.push(`ssh_key_id = $${paramIndex++}`);
      values.push(data.ssh_key_id);
    }
    if (data.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(data.tags);
    }
    if (data.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(data.metadata));
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query<VPSConnection>(
      `UPDATE vps_connections 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, host, port, auth_type, username, ssh_key_id, status, 
                 last_connected, last_error, tags, metadata, created_at, updated_at`,
      values
    );

    logger.info('VPS connection updated', { id });
    return result.rows[0];
  }

  /**
   * Delete VPS connection
   */
  async deleteConnection(id: string): Promise<void> {
    const existing = await this.getConnectionById(id);
    if (!existing) {
      throw new NotFoundError('VPS connection not found');
    }

    await withTransaction(async (client) => {
      // Delete related records first
      await client.query('DELETE FROM ssh_key_distributions WHERE vps_id = $1', [id]);
      await client.query('DELETE FROM vps_connection_attempts WHERE vps_id = $1', [id]);
      await client.query('DELETE FROM environments WHERE target_vps_id = $1', [id]);
      await client.query('DELETE FROM vps_connections WHERE id = $1', [id]);
    });

    logger.info('VPS connection deleted', { id });
  }

  /**
   * Test SSH connection
   */
  async testConnection(id: string): Promise<VPSConnectionTestResult> {
    const connection = await this.getConnectionById(id);
    if (!connection) {
      throw new NotFoundError('VPS connection not found');
    }

    const credentials = await this.getCredentials(connection);
    const startTime = Date.now();

    try {
      const result = await testSSHConnection({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        ...credentials,
      });

      const latency = Date.now() - startTime;

      // Update connection status
      await query(
        `UPDATE vps_connections 
         SET status = $1, last_connected = NOW(), last_error = NULL, updated_at = NOW()
         WHERE id = $2`,
        [result.success ? 'connected' : 'error', id]
      );

      // Log attempt
      await this.logConnectionAttempt(id, 'test', result.success, result.success ? undefined : result.message);

      return {
        success: result.success,
        message: result.message,
        latency: result.latency || latency,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await query(
        `UPDATE vps_connections 
         SET status = 'error', last_error = $1, updated_at = NOW()
         WHERE id = $2`,
        [errorMessage, id]
      );

      await this.logConnectionAttempt(id, 'test', false, errorMessage);

      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Execute command on VPS
   */
  async executeCommand(id: string, command: string, timeout?: number): Promise<VPSCommandResult> {
    const connection = await this.getConnectionById(id);
    if (!connection) {
      throw new NotFoundError('VPS connection not found');
    }

    const credentials = await this.getCredentials(connection);
    const sshConnection = await connectSSH({
      host: connection.host,
      port: connection.port,
      username: connection.username,
      ...credentials,
    });

    try {
      const result = await execCommand(sshConnection.client, command, { timeout });
      
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exitCode || 0,
        executed_at: new Date(),
      };
    } finally {
      disconnectSSH(sshConnection.client);
    }
  }

  /**
   * Install A2R node on VPS
   */
  async installA2RNode(
    id: string,
    options: { version?: string; port?: number } = {}
  ): Promise<{ success: boolean; message: string; installPath?: string }> {
    const connection = await this.getConnectionById(id);
    if (!connection) {
      throw new NotFoundError('VPS connection not found');
    }

    const credentials = await this.getCredentials(connection);
    const sshConnection = await connectSSH({
      host: connection.host,
      port: connection.port,
      username: connection.username,
      ...credentials,
    });

    try {
      const result = await installA2RNode(sshConnection.client, {
        version: options.version,
        port: options.port,
      });

      if (result.success) {
        await query(
          `UPDATE vps_connections 
           SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{a2r_node}', '{"installed": true, "installed_at": "' || NOW() || '"}'),
               updated_at = NOW()
           WHERE id = $1`,
          [id]
        );
      }

      return result;
    } finally {
      disconnectSSH(sshConnection.client);
    }
  }

  /**
   * Add SSH key to VPS authorized_keys
   */
  async addSSHKey(vpsId: string, publicKey: string): Promise<void> {
    const connection = await this.getConnectionById(vpsId);
    if (!connection) {
      throw new NotFoundError('VPS connection not found');
    }

    const credentials = await this.getCredentials(connection);
    const sshConnection = await connectSSH({
      host: connection.host,
      port: connection.port,
      username: connection.username,
      ...credentials,
    });

    try {
      await addAuthorizedKey(sshConnection.client, publicKey);
    } finally {
      disconnectSSH(sshConnection.client);
    }
  }

  /**
   * Get connection history
   */
  async getConnectionAttempts(id: string, limit: number = 50): Promise<VPSConnectionAttempt[]> {
    const result = await query<VPSConnectionAttempt>(
      `SELECT id, vps_id, attempt_type, success, error_message, ip_address, user_agent, created_at
       FROM vps_connection_attempts
       WHERE vps_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [id, limit]
    );
    return result.rows;
  }

  /**
   * Get credentials for connection
   */
  private async getCredentials(connection: VPSConnection): Promise<{
    password?: string;
    privateKey?: string;
    passphrase?: string;
  }> {
    if (connection.auth_type === 'ssh_agent') {
      return {};
    }

    if (connection.ssh_key_id) {
      // Get SSH key from database
      const result = await query(
        'SELECT private_key_encrypted FROM ssh_keys WHERE id = $1',
        [connection.ssh_key_id]
      );
      if (result.rows.length === 0) {
        throw new SSHConnectionError('SSH key not found');
      }
      const decrypted = decrypt(result.rows[0].private_key_encrypted);
      const keyData = JSON.parse(decrypted);
      return {
        privateKey: keyData.private_key,
        passphrase: keyData.passphrase,
      };
    }

    if (connection.credentials_encrypted) {
      const decrypted = decrypt(connection.credentials_encrypted);
      const creds = JSON.parse(decrypted);
      return {
        password: creds.password,
        privateKey: creds.private_key,
        passphrase: creds.passphrase,
      };
    }

    throw new SSHConnectionError('No credentials available');
  }

  /**
   * Log connection attempt
   */
  private async logConnectionAttempt(
    vpsId: string,
    attemptType: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    await query(
      `INSERT INTO vps_connection_attempts (id, vps_id, attempt_type, success, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv4(), vpsId, attemptType, success, errorMessage || null]
    );
  }
}

export default new VPSService();
