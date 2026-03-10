/**
 * SSH Keys API - Types and API client for SSH key management
 */

export interface SSHKey {
  id: string;
  name: string;
  fingerprint: string;
  public_key: string;
  added_at: string;
  last_used?: string;
  provider_ids?: string[];
}

export interface SSHKeyCreateRequest {
  name: string;
  public_key: string;
}

export interface SSHKeyImportRequest {
  name: string;
  private_key: string;
  passphrase?: string;
}

export interface SSHKeyGenerateRequest {
  name: string;
  type?: 'rsa' | 'ed25519' | 'ecdsa';
  bits?: number;
}

export interface SSHKeyGenerateResult {
  id: string;
  name: string;
  public_key: string;
  private_key: string;
  fingerprint: string;
}

// Stub API implementation
export const sshKeyApi = {
  async list(): Promise<SSHKey[]> {
    // TODO: Implement actual API call
    return [];
  },

  async get(id: string): Promise<SSHKey> {
    // TODO: Implement actual API call
    throw new Error('Not implemented');
  },

  async create(data: SSHKeyCreateRequest): Promise<SSHKey> {
    // TODO: Implement actual API call
    return {
      id: `key-${Date.now()}`,
      name: data.name,
      fingerprint: '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00',
      public_key: data.public_key,
      added_at: new Date().toISOString(),
    };
  },

  async import(data: SSHKeyImportRequest): Promise<SSHKey> {
    // TODO: Implement actual API call
    throw new Error('Not implemented');
  },

  async generate(data: SSHKeyGenerateRequest): Promise<SSHKeyGenerateResult> {
    // TODO: Implement actual API call
    throw new Error('Not implemented');
  },

  async delete(id: string): Promise<void> {
    // TODO: Implement actual API call
    console.log('Deleting SSH key:', id);
  },

  async update(id: string, data: Partial<SSHKeyCreateRequest>): Promise<SSHKey> {
    // TODO: Implement actual API call
    throw new Error('Not implemented');
  },
};
