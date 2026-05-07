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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || '';
const SSH_KEYS_BASE = `${API_BASE_URL}/api/v1/ssh-keys`;

type SshKeyRecord = {
  id: string;
  name: string;
  fingerprint: string;
  publicKey: string;
  lastUsedAt?: string | null;
  createdAt: string;
};

function mapKey(record: SshKeyRecord): SSHKey {
  return {
    id: record.id,
    name: record.name,
    fingerprint: record.fingerprint,
    public_key: record.publicKey,
    added_at: record.createdAt,
    last_used: record.lastUsedAt ?? undefined,
  };
}

async function parseErrorResponse(response: Response, fallbackMessage: string): Promise<Error> {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const error = await response.json();
      return new Error(error?.error || error?.message || fallbackMessage);
    }

    const text = await response.text();
    return new Error(text || fallbackMessage);
  } catch {
    return new Error(fallbackMessage);
  }
}

async function request<T>(path: string, init: RequestInit, fallbackMessage: string): Promise<T> {
  const response = await fetch(`${SSH_KEYS_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw await parseErrorResponse(response, fallbackMessage);
  }

  return response.json() as Promise<T>;
}

export const sshKeyApi = {
  async list(): Promise<SSHKey[]> {
    const keys = await request<SshKeyRecord[]>('', { method: 'GET' }, 'Failed to list SSH keys');
    return keys.map(mapKey);
  },

  async get(id: string): Promise<SSHKey> {
    const key = await request<SshKeyRecord>(`/${id}`, { method: 'GET' }, 'Failed to load SSH key');
    return mapKey(key);
  },

  async create(data: SSHKeyCreateRequest): Promise<SSHKey> {
    const key = await request<SshKeyRecord>(
      '',
      {
        method: 'POST',
        body: JSON.stringify({ name: data.name, publicKey: data.public_key }),
      },
      'Failed to create SSH key',
    );
    return mapKey(key);
  },

  async import(data: SSHKeyImportRequest): Promise<SSHKey> {
    const key = await request<SshKeyRecord>(
      '/import',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      'Failed to import SSH key',
    );
    return mapKey(key);
  },

  async generate(data: SSHKeyGenerateRequest): Promise<SSHKeyGenerateResult> {
    return request<SSHKeyGenerateResult>(
      '/generate',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      'Failed to generate SSH key',
    );
  },

  async delete(id: string): Promise<void> {
    await request<{ success: true }>(`/${id}`, { method: 'DELETE' }, 'Failed to delete SSH key');
  },

  async update(id: string, data: Partial<SSHKeyCreateRequest>): Promise<SSHKey> {
    const key = await request<SshKeyRecord>(
      `/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          name: data.name,
          publicKey: data.public_key,
        }),
      },
      'Failed to update SSH key',
    );
    return mapKey(key);
  },
};
