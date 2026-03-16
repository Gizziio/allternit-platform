export type EnvironmentStatus = 
  | 'pending' 
  | 'provisioning' 
  | 'running' 
  | 'stopped' 
  | 'error' 
  | 'destroying' 
  | 'destroyed';
export type EnvironmentHealthStatus = 'healthy' | 'unhealthy' | 'starting' | 'unknown';

export interface EnvironmentTemplate {
  id: string;
  name: string;
  description?: string;
  docker_compose: string;
  environment_variables?: Record<string, string>;
  required_ports?: number[];
  volume_mappings?: Array<{
    host: string;
    container: string;
    mode?: string;
  }>;
  resource_limits?: {
    cpu?: string;
    memory?: string;
  };
  tags?: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Environment {
  id: string;
  name: string;
  template_id: string;
  target_vps_id: string;
  status: EnvironmentStatus;
  container_id?: string;
  container_name?: string;
  ports?: Array<{
    host: number;
    container: number;
    protocol: string;
  }>;
  volumes?: Array<{
    name: string;
    mountpoint: string;
  }>;
  environment_variables?: Record<string, string>;
  logs?: string;
  health_status: EnvironmentHealthStatus;
  last_health_check?: Date;
  started_at?: Date;
  stopped_at?: Date;
  destroyed_at?: Date;
  error_message?: string;
  tags?: string[];
  created_at: Date;
  updated_at: Date;
}

export interface EnvironmentCreate {
  name: string;
  template_id: string;
  target_vps_id: string;
  environment_variables?: Record<string, string>;
  port_mappings?: Array<{
    host: number;
    container: number;
    protocol?: string;
  }>;
  volume_mappings?: Array<{
    host: string;
    container: string;
    mode?: string;
  }>;
  tags?: string[];
}

export interface EnvironmentUpdate {
  name?: string;
  environment_variables?: Record<string, string>;
  tags?: string[];
}

export interface EnvironmentEvent {
  id: string;
  environment_id: string;
  event_type: string;
  message: string;
  data?: Record<string, any>;
  created_at: Date;
}

export interface EnvironmentEventCreate {
  environment_id: string;
  event_type: string;
  message: string;
  data?: Record<string, any>;
}

export interface EnvironmentLogEntry {
  timestamp: Date;
  source: 'stdout' | 'stderr' | 'system';
  message: string;
}

export interface EnvironmentLogs {
  environment_id: string;
  entries: EnvironmentLogEntry[];
  total_count: number;
}

export interface EnvironmentHealth {
  status: EnvironmentHealthStatus;
  last_check: Date;
  details?: Record<string, any>;
}

export interface ProvisioningProgress {
  step: string;
  progress: number;
  message: string;
  timestamp: Date;
}
