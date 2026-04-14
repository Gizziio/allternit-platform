export type VPSAuthType = 'password' | 'private_key' | 'ssh_agent';
export type VPSStatus = 'pending' | 'connected' | 'disconnected' | 'error';

export interface VPSConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  auth_type: VPSAuthType;
  username: string;
  credentials_encrypted?: string;
  ssh_key_id?: string;
  status: VPSStatus;
  last_connected?: Date;
  last_error?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface VPSConnectionCreate {
  name: string;
  host: string;
  port?: number;
  auth_type: VPSAuthType;
  username: string;
  password?: string;
  private_key?: string;
  passphrase?: string;
  ssh_key_id?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface VPSConnectionUpdate {
  name?: string;
  host?: string;
  port?: number;
  auth_type?: VPSAuthType;
  username?: string;
  password?: string;
  private_key?: string;
  passphrase?: string;
  ssh_key_id?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface VPSConnectionTestResult {
  success: boolean;
  message: string;
  latency?: number;
}

export interface VPSCommandResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  executed_at: Date;
}

export interface VPSConnectionAttempt {
  id: string;
  vps_id: string;
  attempt_type: string;
  success: boolean;
  error_message?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}
