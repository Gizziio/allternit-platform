import { query, withTransaction } from '../config/database';
import {
  SSHKey,
  SSHKeyCreate,
  SSHKeyImport,
  SSHKeyUpdate,
  SSHKeyDistribution,
  SSHKeyDistributionResult,
  GeneratedSSHKey,
  SSHKeyType,
} from '../models/SSHKey';
import { NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import config from '../config';
import { connectSSH, disconnectSSH, addAuthorizedKey, testSSHConnection } from '../utils/ssh';

// Use tweetnacl for Ed25519 key generation
try {
  require('tweetnacl');
} catch (e) {
  // tweetnacl is optional
}

// Simple encryption for private keys
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

/**
 * Generate SSH key fingerprint
 */
function generateFingerprint(publicKey: string): string {
  const base64Key = publicKey.split(' ')[1];
  if (!base64Key) return '';
  const buffer = Buffer.from(base64Key, 'base64');
  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  return hash.match(/.{2}/g)?.join(':') || hash;
}

export class SSHKeyService {
  /**
   * Get all SSH keys
   */
  async getAllKeys(): Promise<SSHKey[]> {
    const result = await query<SSHKey>(
      `SELECT id, name, public_key, fingerprint, key_type, key_size, tags, created_at, updated_at 
       FROM ssh_keys 
       ORDER BY created_at DESC`
    );
    return result.rows;
  }

  /**
   * Get SSH key by ID
   */
  async getKeyById(id: string): Promise<SSHKey | null> {
    const result = await query<SSHKey>(
      `SELECT id, name, public_key, fingerprint, key_type, key_size, tags, created_at, updated_at 
       FROM ssh_keys 
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get full SSH key with private key
   */
  async getFullKeyById(id: string): Promise<SSHKey | null> {
    const result = await query<SSHKey>(
      `SELECT * FROM ssh_keys WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Generate a new SSH key pair
   */
  async generateKey(data: SSHKeyCreate): Promise<SSHKey> {
    const keyType = data.key_type || 'ed25519';
    const keySize = data.key_size || (keyType === 'rsa' ? 4096 : undefined);

    let generatedKey: GeneratedSSHKey;

    if (keyType === 'ed25519') {
      generatedKey = await this.generateEd25519Key(data.passphrase);
    } else if (keyType === 'rsa') {
      generatedKey = await this.generateRSAKey(keySize || 4096, data.passphrase);
    } else {
      throw new ValidationError(`Unsupported key type: ${keyType}`);
    }

    const id = uuidv4();
    const encryptedPrivateKey = encrypt(JSON.stringify({
      private_key: generatedKey.privateKey,
      passphrase: data.passphrase,
    }));

    const result = await query<SSHKey>(
      `INSERT INTO ssh_keys 
       (id, name, public_key, private_key_encrypted, fingerprint, key_type, key_size, 
        passphrase_encrypted, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING id, name, public_key, fingerprint, key_type, key_size, tags, created_at, updated_at`,
      [
        id,
        data.name,
        generatedKey.publicKey,
        encryptedPrivateKey,
        generatedKey.fingerprint,
        generatedKey.keyType,
        generatedKey.keySize,
        data.passphrase ? encrypt(data.passphrase) : null,
        data.tags || [],
      ]
    );

    logger.info('SSH key generated', { id, name: data.name, type: keyType });
    return result.rows[0];
  }

  /**
   * Import an existing SSH key
   */
  async importKey(data: SSHKeyImport): Promise<SSHKey> {
    // Validate key format
    if (!data.publicKey.startsWith('ssh-') && !data.publicKey.startsWith('ecdsa-')) {
      throw new ValidationError('Invalid public key format');
    }

    const fingerprint = generateFingerprint(data.publicKey);
    const keyType = this.detectKeyType(data.publicKey);

    // Check if key already exists
    const existing = await query('SELECT id FROM ssh_keys WHERE fingerprint = $1', [fingerprint]);
    if (existing.rows.length > 0) {
      throw new ValidationError('SSH key with this fingerprint already exists');
    }

    const id = uuidv4();
    const encryptedPrivateKey = encrypt(JSON.stringify({
      private_key: data.private_key,
      passphrase: data.passphrase,
    }));

    const result = await query<SSHKey>(
      `INSERT INTO ssh_keys 
       (id, name, public_key, private_key_encrypted, fingerprint, key_type, 
        passphrase_encrypted, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id, name, public_key, fingerprint, key_type, tags, created_at, updated_at`,
      [
        id,
        data.name,
        data.publicKey,
        encryptedPrivateKey,
        fingerprint,
        keyType,
        data.passphrase ? encrypt(data.passphrase) : null,
        data.tags || [],
      ]
    );

    logger.info('SSH key imported', { id, name: data.name });
    return result.rows[0];
  }

  /**
   * Update SSH key
   */
  async updateKey(id: string, data: SSHKeyUpdate): Promise<SSHKey> {
    const existing = await this.getKeyById(id);
    if (!existing) {
      throw new NotFoundError('SSH key not found');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(data.tags);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query<SSHKey>(
      `UPDATE ssh_keys SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, name, public_key, fingerprint, key_type, key_size, tags, created_at, updated_at`,
      values
    );

    logger.info('SSH key updated', { id });
    return result.rows[0];
  }

  /**
   * Delete SSH key
   */
  async deleteKey(id: string): Promise<void> {
    const existing = await this.getKeyById(id);
    if (!existing) {
      throw new NotFoundError('SSH key not found');
    }

    await withTransaction(async (client) => {
      await client.query('DELETE FROM ssh_key_distributions WHERE ssh_key_id = $1', [id]);
      await client.query('DELETE FROM ssh_keys WHERE id = $1', [id]);
    });

    logger.info('SSH key deleted', { id });
  }

  /**
   * Distribute SSH key to VPS
   */
  async distributeToVPS(keyId: string, vpsId: string): Promise<SSHKeyDistributionResult> {
    const key = await this.getKeyById(keyId);
    if (!key) {
      throw new NotFoundError('SSH key not found');
    }

    // Get VPS connection details
    const vps = await query(
      `SELECT host, port, username, auth_type, credentials_encrypted, ssh_key_id 
       FROM vps_connections WHERE id = $1`,
      [vpsId]
    );

    if (vps.rows.length === 0) {
      throw new NotFoundError('VPS not found');
    }

    const vpsData = vps.rows[0];

    // Get VPS credentials
    let credentials: { password?: string; privateKey?: string; passphrase?: string } = {};
    
    if (vpsData.credentials_encrypted) {
      const decrypted = decrypt(vpsData.credentials_encrypted);
      const creds = JSON.parse(decrypted);
      credentials = {
        password: creds.password,
        privateKey: creds.private_key,
        passphrase: creds.passphrase,
      };
    }

    // Test connection and add key
    const testResult = await testSSHConnection({
      host: vpsData.host,
      port: vpsData.port,
      username: vpsData.username,
      ...credentials,
    });

    if (!testResult.success) {
      throw new Error(`Failed to connect to VPS: ${testResult.message}`);
    }

    // Add key to VPS
    const sshConnection = await connectSSH({
      host: vpsData.host,
      port: vpsData.port,
      username: vpsData.username,
      ...credentials,
    });

    try {
      await addAuthorizedKey(sshConnection.client, key.public_key);

      // Record distribution
      const distributionId = uuidv4();
      await query(
        `INSERT INTO ssh_key_distributions 
         (id, ssh_key_id, vps_id, is_distributed, distributed_at, authorized_key_entry, created_at, updated_at)
         VALUES ($1, $2, $3, true, NOW(), $4, NOW(), NOW())
         ON CONFLICT (ssh_key_id, vps_id) 
         DO UPDATE SET is_distributed = true, distributed_at = NOW(), updated_at = NOW()`,
        [distributionId, keyId, vpsId, key.public_key]
      );

      logger.info('SSH key distributed to VPS', { keyId, vpsId });

      return {
        success: true,
        message: 'SSH key distributed successfully',
        vps_id: vpsId,
        verified: true,
      };
    } finally {
      disconnectSSH(sshConnection.client);
    }
  }

  /**
   * Get key distributions
   */
  async getKeyDistributions(keyId: string): Promise<SSHKeyDistribution[]> {
    const result = await query<SSHKeyDistribution>(
      `SELECT * FROM ssh_key_distributions WHERE ssh_key_id = $1 ORDER BY created_at DESC`,
      [keyId]
    );
    return result.rows;
  }

  /**
   * Get VPS distributions
   */
  async getVPSDistributions(vpsId: string): Promise<SSHKeyDistribution[]> {
    const result = await query<SSHKeyDistribution>(
      `SELECT * FROM ssh_key_distributions WHERE vps_id = $1 ORDER BY created_at DESC`,
      [vpsId]
    );
    return result.rows;
  }

  /**
   * Generate Ed25519 SSH key
   */
  private async generateEd25519Key(passphrase?: string): Promise<GeneratedSSHKey> {
    try {
      const nacl = require('tweetnacl');
      const naclUtil = require('tweetnacl-util');
      
      const keyPair = nacl.sign.keyPair();
      const publicKey = `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA${naclUtil.encodeBase64(keyPair.publicKey)} allternit-generated`;
      
      // Create OpenSSH format private key
      const privateKeyBase64 = naclUtil.encodeBase64(keyPair.secretKey);
      const privateKey = `-----BEGIN OPENSSH PRIVATE KEY-----
${this.wrapBase64(privateKeyBase64)}
-----END OPENSSH PRIVATE KEY-----`;

      return {
        publicKey,
        privateKey,
        fingerprint: generateFingerprint(publicKey),
        keyType: 'ed25519',
        keySize: 256,
      };
    } catch (e) {
      // Fallback to RSA if tweetnacl not available
      logger.warn('tweetnacl not available, falling back to RSA');
      return this.generateRSAKey(4096, passphrase);
    }
  }

  /**
   * Generate RSA SSH key using Node.js crypto
   */
  private async generateRSAKey(keySize: number, passphrase?: string): Promise<GeneratedSSHKey> {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: {
        type: 'pkcs1',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs1',
        format: 'pem',
        cipher: passphrase ? 'aes-256-cbc' : undefined,
        passphrase: passphrase || undefined,
      },
    });

    // Convert to OpenSSH format (simplified)
    const sshPublicKey = this.convertRSAPublicKeyToOpenSSH(publicKey as string);

    return {
      publicKey: sshPublicKey,
      privateKey: privateKey as string,
      fingerprint: generateFingerprint(sshPublicKey),
      keyType: 'rsa',
      keySize,
    };
  }

  /**
   * Convert RSA public key to OpenSSH format
   */
  private convertRSAPublicKeyToOpenSSH(pemPublicKey: string): string {
    // This is a simplified conversion
    // In production, you'd want more robust conversion
    const keyData = Buffer.from(pemPublicKey.replace(/-----BEGIN RSA PUBLIC KEY-----/, '')
      .replace(/-----END RSA PUBLIC KEY-----/, '')
      .replace(/\s/g, ''), 'base64');
    
    const sshPrefix = Buffer.from('ssh-rsa');
    const combined = Buffer.concat([sshPrefix, keyData]);
    
    return `ssh-rsa ${combined.toString('base64')} allternit-generated`;
  }

  /**
   * Wrap base64 string to 70 characters per line
   */
  private wrapBase64(str: string): string {
    return str.match(/.{1,70}/g)?.join('\n') || str;
  }

  /**
   * Detect key type from public key
   */
  private detectKeyType(publicKey: string): SSHKeyType {
    if (publicKey.startsWith('ssh-ed25519')) return 'ed25519';
    if (publicKey.startsWith('ssh-rsa')) return 'rsa';
    if (publicKey.startsWith('ecdsa-')) return 'ecdsa';
    return 'rsa';
  }
}

export default new SSHKeyService();
