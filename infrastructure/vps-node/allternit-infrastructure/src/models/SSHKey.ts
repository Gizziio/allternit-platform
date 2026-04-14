export type SSHKeyType = 'rsa' | 'ed25519' | 'ecdsa';

export interface SSHKey {
  id: string;
  name: string;
  public_key: string;
  private_key_encrypted: string;
  fingerprint: string;
  key_type: SSHKeyType;
  key_size?: number;
  passphrase_encrypted?: string;
  tags?: string[];
  created_at: Date;
  updated_at: Date;
}

export interface SSHKeyCreate {
  name: string;
  key_type?: SSHKeyType;
  key_size?: number;
  passphrase?: string;
  tags?: string[];
}

export interface SSHKeyImport {
  name: string;
  public_key: string;
  private_key: string;
  passphrase?: string;
  tags?: string[];
}

export interface SSHKeyUpdate {
  name?: string;
  tags?: string[];
}

export interface SSHKeyDistribution {
  id: string;
  ssh_key_id: string;
  vps_id: string;
  is_distributed: boolean;
  distributed_at?: Date;
  last_verified_at?: Date;
  authorized_key_entry?: string;
  created_at: Date;
  updated_at: Date;
}

export interface SSHKeyDistributionResult {
  success: boolean;
  message: string;
  vps_id: string;
  verified: boolean;
}

export interface GeneratedSSHKey {
  publicKey: string;
  privateKey: string;
  fingerprint: string;
  keyType: SSHKeyType;
  keySize: number;
}
