export type CloudProvider = 'hetzner' | 'digitalocean' | 'aws' | 'azure' | 'gcp';
export type DeploymentStatus = 
  | 'pending' 
  | 'provisioning' 
  | 'running' 
  | 'stopping' 
  | 'stopped' 
  | 'terminating' 
  | 'terminated' 
  | 'error';
export type DeploymentEventType = 'info' | 'progress' | 'success' | 'warning' | 'error';

export interface CloudDeployment {
  id: string;
  name: string;
  provider: CloudProvider;
  region: string;
  instance_type: string;
  status: DeploymentStatus;
  instance_id?: string;
  instance_ip?: string;
  instance_ipv6?: string;
  root_password_encrypted?: string;
  progress: number;
  config: Record<string, any>;
  ssh_key_id?: string;
  vps_connection_id?: string;
  estimated_cost_per_hour?: number;
  started_at?: Date;
  completed_at?: Date;
  terminated_at?: Date;
  error_message?: string;
  tags?: string[];
  created_at: Date;
  updated_at: Date;
}

export interface CloudDeploymentCreate {
  name: string;
  provider: CloudProvider;
  region: string;
  instance_type: string;
  config?: Record<string, any>;
  ssh_key_id?: string;
  tags?: string[];
  // Provider-specific options
  image?: string;
  ssh_keys?: string[];
  user_data?: string;
  volumes?: Array<{
    size: number;
    name?: string;
    format?: string;
  }>;
  networks?: string[];
  labels?: Record<string, string>;
}

export interface CloudDeploymentUpdate {
  name?: string;
  status?: DeploymentStatus;
  tags?: string[];
}

export interface DeploymentEvent {
  id: string;
  deployment_id: string;
  event_type: DeploymentEventType;
  message: string;
  data?: Record<string, any>;
  created_at: Date;
}

export interface DeploymentEventCreate {
  deployment_id: string;
  event_type: DeploymentEventType;
  message: string;
  data?: Record<string, any>;
}

export interface DeploymentStatusUpdate {
  status: DeploymentStatus;
  progress?: number;
  instance_id?: string;
  instance_ip?: string;
  instance_ipv6?: string;
  error_message?: string;
}

export interface CloudProviderInfo {
  id: CloudProvider;
  name: string;
  enabled: boolean;
  regions: Array<{
    id: string;
    name: string;
    available: boolean;
  }>;
  instance_types: Array<{
    id: string;
    name: string;
    cpu: number;
    memory_gb: number;
    disk_gb: number;
    price_hourly: number;
    available: boolean;
  }>;
  images: Array<{
    id: string;
    name: string;
    distribution: string;
    version: string;
  }>;
}

export interface DeploymentEstimate {
  provider: CloudProvider;
  region: string;
  instance_type: string;
  hourly_cost: number;
  monthly_estimate: number;
  currency: string;
}
