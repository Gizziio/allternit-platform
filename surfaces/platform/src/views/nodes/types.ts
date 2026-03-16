/**
 * Node Management Types
 */

export interface NodeCapabilities {
  docker: boolean;
  gpu: boolean;
  total_cpu: number;
  total_memory_gb: number;
  total_disk_gb: number;
  container_runtimes: string[];
  os: string;
  arch: string;
}

export interface NodeRecord {
  id: string;
  user_id: string;
  hostname: string;
  version: string;
  docker_available: boolean;
  gpu_available: boolean;
  cpu_cores: number;
  memory_gb: number;
  disk_gb: number;
  os: string;
  arch: string;
  labels: string[];
  status: 'online' | 'offline' | 'busy' | 'maintenance' | 'error';
  created_at: string;
  updated_at: string;
  last_seen_at?: string;
}

export interface NodeConnection {
  id: string;
  status: string;
}

export interface NodesResponse {
  connected: string[];
  connected_details: NodeConnection[];
  all_nodes: NodeRecord[];
  count: number;
  total_nodes: number;
}

export interface NodeTokenResponse {
  node_id: string;
  token: string;
  install_command: string;
}

export type NodeStatus = 'online' | 'offline' | 'busy' | 'maintenance' | 'error';

export const statusColors: Record<NodeStatus, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  busy: 'bg-yellow-500',
  maintenance: 'bg-blue-500',
  error: 'bg-red-500',
};

export const statusLabels: Record<NodeStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  busy: 'Busy',
  maintenance: 'Maintenance',
  error: 'Error',
};
