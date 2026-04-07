/**
 * SSH Connection Repository - Database Layer
 * 
 * Manages persistent storage of SSH connections with encrypted credentials.
 * Supports PostgreSQL with encryption at rest for sensitive data.
 */

import { Pool, PoolClient } from 'pg';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface SSHConnectionRecord {
  id: string;
  userId: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'key' | 'password';
  encryptedPrivateKey?: string | null;
  encryptedPassword?: string | null;
  status: 'disconnected' | 'connected' | 'error';
  os?: string | null;
  architecture?: string | null;
  dockerInstalled?: boolean | null;
  a2rInstalled?: boolean | null;
  a2rVersion?: string | null;
  lastConnectedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSSHConnectionInput {
  userId: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'key' | 'password';
  privateKey?: string;
  password?: string;
}

export interface UpdateSSHConnectionInput {
  name?: string;
  host?: string;
  port?: number;
  username?: string;
  authType?: 'key' | 'password';
  privateKey?: string;
  password?: string;
  status?: 'disconnected' | 'connected' | 'error';
  os?: string;
  architecture?: string;
  dockerInstalled?: boolean;
  a2rInstalled?: boolean;
  a2rVersion?: string;
  lastConnectedAt?: Date;
}

// ============================================================================
// Encryption Service
// ============================================================================

export class CredentialEncryption {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  constructor(masterKey: string) {
    // Derive 32-byte key from master key using SHA-256
    this.key = crypto.createHash('sha256').update(masterKey).digest();
  }

  encrypt(plaintext: string): { ciphertext: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  decrypt(ciphertext: string, iv: string, authTag: string): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // For storage - combine all parts into a single string
  serializeEncrypted(encrypted: { ciphertext: string; iv: string; authTag: string }): string {
    return `${encrypted.iv}:${encrypted.authTag}:${encrypted.ciphertext}`;
  }

  deserializeEncrypted(serialized: string): { ciphertext: string; iv: string; authTag: string } {
    const [iv, authTag, ciphertext] = serialized.split(':');
    return { ciphertext, iv, authTag };
  }
}

// ============================================================================
// Repository
// ============================================================================

export class SSHConnectionRepository {
  private pool: Pool;
  private encryption: CredentialEncryption;

  constructor(pool: Pool, encryptionKey: string) {
    this.pool = pool;
    this.encryption = new CredentialEncryption(encryptionKey);
  }

  // ========================================================================
  // CRUD Operations
  // ========================================================================

  async create(input: CreateSSHConnectionInput): Promise<SSHConnectionRecord> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const id = crypto.randomUUID();
      const now = new Date();

      // Encrypt credentials
      let encryptedPrivateKey: string | null = null;
      let encryptedPassword: string | null = null;

      if (input.authType === 'key' && input.privateKey) {
        encryptedPrivateKey = this.encryption.serializeEncrypted(
          this.encryption.encrypt(input.privateKey)
        );
      } else if (input.authType === 'password' && input.password) {
        encryptedPassword = this.encryption.serializeEncrypted(
          this.encryption.encrypt(input.password)
        );
      }

      const result = await client.query(
        `INSERT INTO ssh_connections (
          id, user_id, name, host, port, username, auth_type,
          encrypted_private_key, encrypted_password, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          id,
          input.userId,
          input.name,
          input.host,
          input.port,
          input.username,
          input.authType,
          encryptedPrivateKey,
          encryptedPassword,
          'disconnected',
          now,
          now,
        ]
      );

      await client.query('COMMIT');

      return this.mapRowToRecord(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string, userId: string): Promise<SSHConnectionRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM ssh_connections WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToRecord(result.rows[0]);
  }

  async findByUserId(userId: string): Promise<SSHConnectionRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM ssh_connections WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    return result.rows.map(row => this.mapRowToRecord(row));
  }

  async update(
    id: string,
    userId: string,
    input: UpdateSSHConnectionInput
  ): Promise<SSHConnectionRecord | null> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (input.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(input.name);
      }
      if (input.host !== undefined) {
        updates.push(`host = $${paramIndex++}`);
        values.push(input.host);
      }
      if (input.port !== undefined) {
        updates.push(`port = $${paramIndex++}`);
        values.push(input.port);
      }
      if (input.username !== undefined) {
        updates.push(`username = $${paramIndex++}`);
        values.push(input.username);
      }
      if (input.authType !== undefined) {
        updates.push(`auth_type = $${paramIndex++}`);
        values.push(input.authType);
      }
      if (input.status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(input.status);
      }
      if (input.os !== undefined) {
        updates.push(`os = $${paramIndex++}`);
        values.push(input.os);
      }
      if (input.architecture !== undefined) {
        updates.push(`architecture = $${paramIndex++}`);
        values.push(input.architecture);
      }
      if (input.dockerInstalled !== undefined) {
        updates.push(`docker_installed = $${paramIndex++}`);
        values.push(input.dockerInstalled);
      }
      if (input.a2rInstalled !== undefined) {
        updates.push(`allternit_installed = $${paramIndex++}`);
        values.push(input.a2rInstalled);
      }
      if (input.a2rVersion !== undefined) {
        updates.push(`allternit_version = $${paramIndex++}`);
        values.push(input.a2rVersion);
      }
      if (input.lastConnectedAt !== undefined) {
        updates.push(`last_connected_at = $${paramIndex++}`);
        values.push(input.lastConnectedAt);
      }

      // Handle credential updates
      if (input.privateKey !== undefined && input.authType === 'key') {
        const encrypted = this.encryption.encrypt(input.privateKey);
        updates.push(`encrypted_private_key = $${paramIndex++}`);
        values.push(this.encryption.serializeEncrypted(encrypted));
        updates.push(`encrypted_password = NULL`);
      } else if (input.password !== undefined && input.authType === 'password') {
        const encrypted = this.encryption.encrypt(input.password);
        updates.push(`encrypted_password = $${paramIndex++}`);
        values.push(this.encryption.serializeEncrypted(encrypted));
        updates.push(`encrypted_private_key = NULL`);
      }

      updates.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());

      // Add id and user_id for WHERE clause
      values.push(id);
      values.push(userId);

      const result = await client.query(
        `UPDATE ssh_connections 
         SET ${updates.join(', ')} 
         WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
         RETURNING *`,
        values
      );

      await client.query('COMMIT');

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToRecord(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM ssh_connections WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  // ========================================================================
  // Credential Decryption
  // ========================================================================

  async getDecryptedCredentials(
    id: string,
    userId: string
  ): Promise<{ privateKey?: string; password?: string } | null> {
    const result = await this.pool.query(
      'SELECT auth_type, encrypted_private_key, encrypted_password FROM ssh_connections WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const credentials: { privateKey?: string; password?: string } = {};

    if (row.auth_type === 'key' && row.encrypted_private_key) {
      const encrypted = this.encryption.deserializeEncrypted(row.encrypted_private_key);
      credentials.privateKey = this.encryption.decrypt(
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.authTag
      );
    } else if (row.auth_type === 'password' && row.encrypted_password) {
      const encrypted = this.encryption.deserializeEncrypted(row.encrypted_password);
      credentials.password = this.encryption.decrypt(
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.authTag
      );
    }

    return credentials;
  }

  // ========================================================================
  // Mapping
  // ========================================================================

  private mapRowToRecord(row: any): SSHConnectionRecord {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      host: row.host,
      port: row.port,
      username: row.username,
      authType: row.auth_type,
      encryptedPrivateKey: row.encrypted_private_key,
      encryptedPassword: row.encrypted_password,
      status: row.status,
      os: row.os,
      architecture: row.architecture,
      dockerInstalled: row.docker_installed,
      a2rInstalled: row.allternit_installed,
      a2rVersion: row.allternit_version,
      lastConnectedAt: row.last_connected_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ============================================================================
// SQL Schema
// ============================================================================

export const createSSHConnectionsTableSQL = `
CREATE TABLE IF NOT EXISTS ssh_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL DEFAULT 22,
  username VARCHAR(255) NOT NULL,
  auth_type VARCHAR(20) NOT NULL CHECK (auth_type IN ('key', 'password')),
  encrypted_private_key TEXT,
  encrypted_password TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connected', 'error')),
  os VARCHAR(255),
  architecture VARCHAR(50),
  docker_installed BOOLEAN,
  allternit_installed BOOLEAN,
  allternit_version VARCHAR(50),
  last_connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_auth CHECK (
    (auth_type = 'key' AND encrypted_private_key IS NOT NULL) OR
    (auth_type = 'password' AND encrypted_password IS NOT NULL)
  )
);

CREATE INDEX idx_ssh_connections_user_id ON ssh_connections(user_id);
CREATE INDEX idx_ssh_connections_status ON ssh_connections(status);
`;

export default SSHConnectionRepository;
