/**
 * Node Management Panel
 * 
 * Full production implementation for managing compute nodes in A2R.
 * Features:
 * - List all compute nodes with real-time status
 * - Add new nodes (BYOC via token or Cloud deploy)
 * - Node health monitoring with CPU, memory, disk stats
 * - Start/Stop/Restart nodes
 * - View node details and running agents
 * - View node logs
 * - Terminate/Remove nodes
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Server,
  Plus,
  RefreshCw,
  Loader2,
  AlertCircle,
  Activity,
  CheckCircle2,
  XCircle,
  Cloud,
  Cpu,
  HardDrive,
  MemoryStick,
  Terminal,
  MoreVertical,
  Trash2,
  Power,
  RotateCw,
  Play,
  Square,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Gauge,
  Container,
  Sparkles,
  AlertTriangle,
  FileText,
  Search,
  Filter,
  Download,
} from 'lucide-react';
import { GATEWAY_BASE_URL } from '@/integration/api-client';
import { useToast } from '@/hooks/use-toast';

// =============================================================================
// TYPES
// =============================================================================

export type NodeStatus = 'online' | 'offline' | 'busy' | 'maintenance' | 'error';

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
  status: NodeStatus;
  created_at: string;
  updated_at: string;
  last_seen_at?: string;
  // Runtime metrics (optional, from monitoring)
  metrics?: {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
    network_rx_bytes: number;
    network_tx_bytes: number;
  };
  // Running agents on this node
  running_agents?: Array<{
    id: string;
    name: string;
    status: string;
    started_at: string;
  }>;
}

export interface NodesResponse {
  connected: string[];
  connected_details: Array<{ id: string; status: string }>;
  all_nodes: NodeRecord[];
  count: number;
  total_nodes: number;
}

export interface NodeTokenResponse {
  node_id: string;
  token: string;
  install_command: string;
}

export interface NodeLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  source: string;
}

// =============================================================================
// STATUS HELPERS
// =============================================================================

const statusConfig: Record<NodeStatus, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  online: {
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.1)',
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: 'Online',
  },
  offline: {
    color: '#6b7280',
    bg: 'rgba(107, 114, 128, 0.1)',
    icon: <XCircle className="h-4 w-4" />,
    label: 'Offline',
  },
  busy: {
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.1)',
    icon: <Activity className="h-4 w-4" />,
    label: 'Busy',
  },
  maintenance: {
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.1)',
    icon: <Clock className="h-4 w-4" />,
    label: 'Maintenance',
  },
  error: {
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.1)',
    icon: <AlertCircle className="h-4 w-4" />,
    label: 'Error',
  },
};

// =============================================================================
// API HOOKS
// =============================================================================

const API_BASE = `${GATEWAY_BASE_URL}/api/v1`;

function useNodes() {
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [connected, setConnected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const fetchNodes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/nodes`);

      if (!response.ok) {
        throw new Error(`Failed to fetch nodes: ${response.statusText}`);
      }

      const data: NodesResponse = await response.json();
      setNodes(data.all_nodes);
      setConnected(data.connected);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNodes();
    const interval = setInterval(fetchNodes, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [fetchNodes]);

  const deleteNode = useCallback(async (nodeId: string) => {
    try {
      const response = await fetch(`${API_BASE}/nodes/${nodeId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete node: ${response.statusText}`);
      }

      await fetchNodes();
      addToast({ title: 'Node removed', description: 'The node has been successfully removed.', type: 'success' });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addToast({ title: 'Error', description: message, type: 'error' });
      return false;
    }
  }, [fetchNodes, addToast]);

  const restartNode = useCallback(async (nodeId: string) => {
    try {
      const response = await fetch(`${API_BASE}/nodes/${nodeId}/restart`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to restart node: ${response.statusText}`);
      }

      addToast({ title: 'Restart initiated', description: 'The node is being restarted.', type: 'success' });
      await fetchNodes();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addToast({ title: 'Error', description: message, type: 'error' });
      return false;
    }
  }, [fetchNodes, addToast]);

  const stopNode = useCallback(async (nodeId: string) => {
    try {
      const response = await fetch(`${API_BASE}/nodes/${nodeId}/stop`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to stop node: ${response.statusText}`);
      }

      addToast({ title: 'Stop initiated', description: 'The node is being stopped.', type: 'success' });
      await fetchNodes();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addToast({ title: 'Error', description: message, type: 'error' });
      return false;
    }
  }, [fetchNodes, addToast]);

  const startNode = useCallback(async (nodeId: string) => {
    try {
      const response = await fetch(`${API_BASE}/nodes/${nodeId}/start`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to start node: ${response.statusText}`);
      }

      addToast({ title: 'Start initiated', description: 'The node is being started.', type: 'success' });
      await fetchNodes();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addToast({ title: 'Error', description: message, type: 'error' });
      return false;
    }
  }, [fetchNodes, addToast]);

  const getNodeLogs = useCallback(async (nodeId: string, limit = 100): Promise<NodeLogEntry[]> => {
    try {
      const response = await fetch(`${API_BASE}/nodes/${nodeId}/logs?limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      return await response.json();
    } catch (err) {
      return [];
    }
  }, []);

  return {
    nodes,
    connected,
    loading,
    error,
    refresh: fetchNodes,
    deleteNode,
    restartNode,
    stopNode,
    startNode,
    getNodeLogs,
  };
}

function useNodeToken() {
  const [tokenData, setTokenData] = useState<NodeTokenResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const generateToken = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/nodes/token`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to generate token: ${response.statusText}`);
      }

      const data: NodeTokenResponse = await response.json();
      setTokenData(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      addToast({ title: 'Error', description: message, type: 'error' });
      return null;
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const clearToken = useCallback(() => {
    setTokenData(null);
  }, []);

  return {
    tokenData,
    loading,
    error,
    generateToken,
    clearToken,
  };
}

function isNodeConnected(nodeId: string, connected: string[]): boolean {
  return connected.includes(nodeId);
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface ProgressBarProps {
  value: number;
  color?: string;
  size?: 'sm' | 'md';
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, color = '#d4b08c', size = 'md' }) => (
  <div
    style={{
      width: '100%',
      height: size === 'sm' ? '4px' : '8px',
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderRadius: size === 'sm' ? '2px' : '4px',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        width: `${Math.min(100, Math.max(0, value))}%`,
        height: '100%',
        backgroundColor: value > 80 ? '#ef4444' : value > 60 ? '#f59e0b' : color,
        borderRadius: 'inherit',
        transition: 'width 0.3s ease',
      }}
    />
  </div>
);

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, subtext }) => (
  <div
    style={{
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '8px',
      padding: '12px 16px',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}
  >
    <div style={{ color: '#888' }}>{icon}</div>
    <div>
      <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: '16px', fontWeight: '600', color: '#fff' }}>{value}</div>
      {subtext && <div style={{ fontSize: '11px', color: '#888' }}>{subtext}</div>}
    </div>
  </div>
);

interface NodeDetailModalProps {
  node: NodeRecord;
  isConnected: boolean;
  onClose: () => void;
  onRestart: () => void;
  onStop: () => void;
  onStart: () => void;
  onDelete: () => void;
  logs: NodeLogEntry[];
}

const NodeDetailModal: React.FC<NodeDetailModalProps> = ({
  node,
  isConnected,
  onClose,
  onRestart,
  onStop,
  onStart,
  onDelete,
  logs,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'logs'>('overview');
  const status = statusConfig[node.status];

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb < 1) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${gb.toFixed(2)} GB`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1a1a1a',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '800px',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '10px',
                background: status.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: status.color,
              }}
            >
              <Server size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', margin: 0 }}>{node.hostname}</h2>
              <p style={{ fontSize: '13px', color: '#888', margin: '4px 0 0 0' }}>{node.id}</p>
            </div>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: '6px',
                background: status.bg,
                color: status.color,
                fontSize: '12px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {status.icon}
              {status.label}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: '#888',
              cursor: 'pointer',
            }}
          >
            <XCircle size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: '4px',
            background: 'rgba(255,255,255,0.02)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {[
            { id: 'overview', label: 'Overview', icon: Gauge },
            { id: 'agents', label: 'Running Agents', icon: Activity },
            { id: 'logs', label: 'Logs', icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === tab.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#888',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Resource Usage */}
              {node.metrics && (
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>
                    Resource Usage
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <Cpu size={16} color="#888" />
                        <span style={{ fontSize: '13px', color: '#888' }}>CPU</span>
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '600', color: '#fff', marginBottom: '8px' }}>
                        {node.metrics.cpu_percent.toFixed(1)}%
                      </div>
                      <ProgressBar value={node.metrics.cpu_percent} />
                    </div>

                    <div
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <MemoryStick size={16} color="#888" />
                        <span style={{ fontSize: '13px', color: '#888' }}>Memory</span>
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '600', color: '#fff', marginBottom: '8px' }}>
                        {node.metrics.memory_percent.toFixed(1)}%
                      </div>
                      <ProgressBar value={node.metrics.memory_percent} />
                    </div>

                    <div
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <HardDrive size={16} color="#888" />
                        <span style={{ fontSize: '13px', color: '#888' }}>Disk</span>
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '600', color: '#fff', marginBottom: '8px' }}>
                        {node.metrics.disk_percent.toFixed(1)}%
                      </div>
                      <ProgressBar value={node.metrics.disk_percent} />
                    </div>
                  </div>
                </div>
              )}

              {/* Specifications */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>
                  Specifications
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '12px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '8px',
                    padding: '16px',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: '#888' }}>OS</span>
                    <span style={{ fontSize: '13px', color: '#fff' }}>
                      {node.os} ({node.arch})
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: '#888' }}>CPU Cores</span>
                    <span style={{ fontSize: '13px', color: '#fff' }}>{node.cpu_cores}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: '#888' }}>Memory</span>
                    <span style={{ fontSize: '13px', color: '#fff' }}>{node.memory_gb} GB</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: '#888' }}>Disk</span>
                    <span style={{ fontSize: '13px', color: '#fff' }}>{node.disk_gb} GB</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: '#888' }}>Docker</span>
                    <span style={{ fontSize: '13px', color: node.docker_available ? '#22c55e' : '#ef4444' }}>
                      {node.docker_available ? 'Available' : 'Not Available'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: '#888' }}>GPU</span>
                    <span style={{ fontSize: '13px', color: node.gpu_available ? '#a855f7' : '#6b7280' }}>
                      {node.gpu_available ? 'Available' : 'Not Available'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: '#888' }}>Version</span>
                    <span style={{ fontSize: '13px', color: '#fff' }}>{node.version}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: '#888' }}>Last Seen</span>
                    <span style={{ fontSize: '13px', color: '#fff' }}>
                      {node.last_seen_at ? new Date(node.last_seen_at).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>
                  Actions
                </h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {isConnected && node.status !== 'maintenance' && (
                    <>
                      <button
                        onClick={onRestart}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.05)',
                          color: '#fff',
                          fontSize: '13px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <RotateCw size={16} />
                        Restart
                      </button>
                      {node.status === 'online' ? (
                        <button
                          onClick={onStop}
                          style={{
                            padding: '10px 16px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)',
                            color: '#fff',
                            fontSize: '13px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <Square size={16} />
                          Stop
                        </button>
                      ) : (
                        <button
                          onClick={onStart}
                          style={{
                            padding: '10px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#22c55e',
                            color: '#0a0a0a',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <Play size={16} />
                          Start
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={onDelete}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: '1px solid rgba(239,68,68,0.3)',
                      background: 'rgba(239,68,68,0.1)',
                      color: '#ef4444',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Trash2 size={16} />
                    Remove Node
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'agents' && (
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>
                Running Agents
              </h3>
              {!node.running_agents || node.running_agents.length === 0 ? (
                <div
                  style={{
                    padding: '48px',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '8px',
                    border: '1px dashed rgba(255,255,255,0.1)',
                  }}
                >
                  <Activity size={32} color="#666" style={{ marginBottom: '12px' }} />
                  <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>No agents currently running on this node</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {node.running_agents.map((agent) => (
                    <div
                      key={agent.id}
                      style={{
                        padding: '16px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: 'rgba(212,176,140,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#d4b08c',
                          }}
                        >
                          <Sparkles size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: '#fff' }}>{agent.name}</div>
                          <div style={{ fontSize: '12px', color: '#888' }}>{agent.id}</div>
                        </div>
                      </div>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: 'rgba(34,197,94,0.1)',
                          color: '#22c55e',
                          fontSize: '12px',
                          fontWeight: '500',
                        }}
                      >
                        {agent.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>
                Recent Logs
              </h3>
              {logs.length === 0 ? (
                <div
                  style={{
                    padding: '48px',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '8px',
                    border: '1px dashed rgba(255,255,255,0.1)',
                  }}
                >
                  <FileText size={32} color="#666" style={{ marginBottom: '12px' }} />
                  <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>No logs available</p>
                </div>
              ) : (
                <div
                  style={{
                    background: '#0a0a0a',
                    borderRadius: '8px',
                    padding: '16px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    maxHeight: '400px',
                    overflow: 'auto',
                  }}
                >
                  {logs.map((log, idx) => (
                    <div key={idx} style={{ marginBottom: '8px', display: 'flex', gap: '12px' }}>
                      <span style={{ color: '#666', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        style={{
                          color:
                            log.level === 'error' ? '#ef4444' : log.level === 'warn' ? '#f59e0b' : '#22c55e',
                          textTransform: 'uppercase',
                          fontSize: '10px',
                          minWidth: '40px',
                        }}
                      >
                        {log.level}
                      </span>
                      <span style={{ color: '#e5e5e5' }}>{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface AddNodeModalProps {
  onClose: () => void;
  onDeployCloud: () => void;
}

const AddNodeModal: React.FC<AddNodeModalProps> = ({ onClose, onDeployCloud }) => {
  const [activeTab, setActiveTab] = useState<'byoc' | 'cloud'>('byoc');
  const { tokenData, loading, generateToken, clearToken } = useNodeToken();
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const handleClose = () => {
    clearToken();
    onClose();
  };

  const copyCommand = () => {
    if (tokenData?.install_command) {
      navigator.clipboard.writeText(tokenData.install_command);
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    }
  };

  const copyToken = () => {
    if (tokenData?.token) {
      navigator.clipboard.writeText(tokenData.token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: '#1a1a1a',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', margin: 0 }}>Add New Node</h2>
          <button
            onClick={handleClose}
            style={{
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: '#888',
              cursor: 'pointer',
            }}
          >
            <XCircle size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: '4px',
            background: 'rgba(255,255,255,0.02)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <button
            onClick={() => setActiveTab('byoc')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'byoc' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: activeTab === 'byoc' ? '#fff' : '#888',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <Server size={16} />
            Bring Your Own
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'cloud' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: activeTab === 'cloud' ? '#fff' : '#888',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <Cloud size={16} />
            Deploy to Cloud
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {activeTab === 'byoc' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {!tokenData ? (
                <>
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: '8px',
                      padding: '16px',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '12px' }}>
                      Requirements
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#888' }}>
                        <CheckCircle2 size={14} color="#22c55e" />
                        Linux, macOS, or Windows machine
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#888' }}>
                        <CheckCircle2 size={14} color="#22c55e" />
                        Docker installed (recommended)
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#888' }}>
                        <CheckCircle2 size={14} color="#22c55e" />
                        Outbound internet access (port 443)
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={generateToken}
                    disabled={loading}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#d4b08c',
                      color: '#0a0a0a',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        Generate Install Token
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: '8px',
                      padding: '16px',
                      border: '1px solid rgba(255,255,255,0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: '#888' }}>Node ID</span>
                      <code
                        style={{
                          fontSize: '12px',
                          background: 'rgba(255,255,255,0.05)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          color: '#fff',
                        }}
                      >
                        {tokenData.node_id}
                      </code>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: '#888' }}>Auth Token</span>
                        <button
                          onClick={copyToken}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: 'none',
                            background: 'transparent',
                            color: '#d4b08c',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {copiedToken ? <Check size={12} /> : <Copy size={12} />}
                          {copiedToken ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <code
                        style={{
                          fontSize: '11px',
                          background: 'rgba(255,255,255,0.05)',
                          padding: '8px',
                          borderRadius: '4px',
                          color: '#fff',
                          wordBreak: 'break-all',
                        }}
                      >
                        {tokenData.token}
                      </code>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#888' }}>Installation Command</span>
                    <div style={{ position: 'relative' }}>
                      <pre
                        style={{
                          fontSize: '11px',
                          background: '#0a0a0a',
                          padding: '16px',
                          borderRadius: '8px',
                          color: '#e5e5e5',
                          overflow: 'auto',
                          margin: 0,
                        }}
                      >
                        {tokenData.install_command}
                      </pre>
                      <button
                        onClick={copyCommand}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: 'none',
                          background: 'rgba(255,255,255,0.1)',
                          color: '#fff',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {copiedCommand ? <Check size={14} /> : <Copy size={14} />}
                        {copiedCommand ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'rgba(59,130,246,0.1)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      border: '1px solid rgba(59,130,246,0.2)',
                    }}
                  >
                    <p style={{ fontSize: '13px', color: '#93bbfc', margin: 0 }}>
                      <strong>Next steps:</strong> Run the installation command on your target machine. The node will
                      automatically connect and appear in your dashboard.
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <Cloud size={48} color="#666" style={{ marginBottom: '16px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', marginBottom: '8px' }}>
                Deploy to Cloud
              </h3>
              <p style={{ fontSize: '13px', color: '#888', marginBottom: '24px', maxWidth: '400px' }}>
                Provision a new VPS on Hetzner, DigitalOcean, AWS, or other cloud providers. The instance will be
                automatically configured and connected.
              </p>
              <button
                onClick={() => {
                  handleClose();
                  onDeployCloud();
                }}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#d4b08c',
                  color: '#0a0a0a',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Cloud size={18} />
                Open Cloud Deploy
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const NodeManagementPanel: React.FC = () => {
  const {
    nodes,
    connected,
    loading,
    error,
    refresh,
    deleteNode,
    restartNode,
    stopNode,
    startNode,
    getNodeLogs,
  } = useNodes();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<NodeStatus | 'all'>('all');
  const [selectedNode, setSelectedNode] = useState<NodeRecord | null>(null);
  const [nodeLogs, setNodeLogs] = useState<NodeLogEntry[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Filter nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      const matchesSearch =
        node.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || node.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [nodes, searchQuery, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: nodes.length,
      online: nodes.filter((n) => n.status === 'online').length,
      offline: nodes.filter((n) => n.status === 'offline').length,
      busy: nodes.filter((n) => n.status === 'busy').length,
      error: nodes.filter((n) => n.status === 'error').length,
      connected: connected.length,
    };
  }, [nodes, connected]);

  const handleViewDetails = async (node: NodeRecord) => {
    setSelectedNode(node);
    const logs = await getNodeLogs(node.id, 50);
    setNodeLogs(logs);
  };

  const toggleExpanded = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const formatLastSeen = (date?: string) => {
    if (!date) return 'Never';
    const lastSeen = new Date(date);
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSeen.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '600', margin: '0 0 8px 0', color: '#fff' }}>
            Node Management
          </h2>
          <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>
            Manage your compute infrastructure and monitor node health
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: '#888',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: '#d4b08c',
              color: '#0a0a0a',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Plus size={18} />
            Add Node
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        <MetricCard icon={<Server size={20} />} label="Total Nodes" value={stats.total.toString()} />
        <MetricCard
          icon={<CheckCircle2 size={20} />}
          label="Online"
          value={stats.online.toString()}
          subtext={`${stats.connected} connected`}
        />
        <MetricCard icon={<XCircle size={20} />} label="Offline" value={stats.offline.toString()} />
        <MetricCard icon={<Activity size={20} />} label="Busy" value={stats.busy.toString()} />
        <MetricCard icon={<AlertCircle size={20} />} label="Error" value={stats.error.toString()} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }}
          />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.02)',
              color: '#fff',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as NodeStatus | 'all')}
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.02)',
            color: '#fff',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          <option value="all">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="busy">Busy</option>
          <option value="maintenance">Maintenance</option>
          <option value="error">Error</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(239,68,68,0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(239,68,68,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#ef4444',
          }}
        >
          <AlertCircle size={18} />
          <span style={{ fontSize: '13px' }}>{error}</span>
          <button
            onClick={refresh}
            style={{
              marginLeft: 'auto',
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: 'rgba(239,68,68,0.2)',
              color: '#ef4444',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Node List */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && nodes.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
            <Loader2 size={32} color="#666" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : filteredNodes.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '64px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '12px',
              border: '1px dashed rgba(255,255,255,0.1)',
            }}
          >
            <Server size={48} color="#444" style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', marginBottom: '8px' }}>
              {nodes.length === 0 ? 'No nodes configured' : 'No matching nodes'}
            </h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px', textAlign: 'center' }}>
              {nodes.length === 0
                ? 'Add your first compute node to start running agents and workloads.'
                : 'Try adjusting your search or filter criteria.'}
            </p>
            {nodes.length === 0 && (
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#d4b08c',
                  color: '#0a0a0a',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Plus size={18} />
                Add First Node
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredNodes.map((node) => {
              const isConnected = isNodeConnected(node.id, connected);
              const status = statusConfig[node.status];
              const isExpanded = expandedNodes.has(node.id);

              return (
                <div
                  key={node.id}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Main Row */}
                  <div
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleExpanded(node.id)}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: status.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: status.color,
                      }}
                    >
                      <Server size={20} />
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '600', color: '#fff' }}>{node.hostname}</span>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: status.bg,
                            color: status.color,
                            fontSize: '11px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {status.icon}
                          {status.label}
                        </span>
                        {isConnected && (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: 'rgba(34,197,94,0.1)',
                              color: '#22c55e',
                              fontSize: '11px',
                              fontWeight: '500',
                            }}
                          >
                            Connected
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {node.id} • {node.os} • Last seen {formatLastSeen(node.last_seen_at)}
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div style={{ display: 'flex', gap: '16px', marginRight: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888' }}>
                        <Cpu size={14} />
                        {node.cpu_cores} cores
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888' }}>
                        <MemoryStick size={14} />
                        {node.memory_gb} GB
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888' }}>
                        <HardDrive size={14} />
                        {node.disk_gb} GB
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(node);
                        }}
                        style={{
                          padding: '8px',
                          borderRadius: '6px',
                          border: 'none',
                          background: 'rgba(255,255,255,0.05)',
                          color: '#888',
                          cursor: 'pointer',
                        }}
                        title="View Details"
                      >
                        <Gauge size={18} />
                      </button>
                      {isExpanded ? <ChevronUp size={18} color="#666" /> : <ChevronDown size={18} color="#666" />}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: '0 20px 16px',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(255,255,255,0.01)',
                      }}
                    >
                      {/* Metrics */}
                      {node.metrics && (
                        <div style={{ padding: '16px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontSize: '12px', color: '#888' }}>CPU Usage</span>
                              <span style={{ fontSize: '12px', color: '#fff' }}>{node.metrics.cpu_percent.toFixed(1)}%</span>
                            </div>
                            <ProgressBar value={node.metrics.cpu_percent} size="sm" />
                          </div>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontSize: '12px', color: '#888' }}>Memory Usage</span>
                              <span style={{ fontSize: '12px', color: '#fff' }}>{node.metrics.memory_percent.toFixed(1)}%</span>
                            </div>
                            <ProgressBar value={node.metrics.memory_percent} size="sm" />
                          </div>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontSize: '12px', color: '#888' }}>Disk Usage</span>
                              <span style={{ fontSize: '12px', color: '#fff' }}>{node.metrics.disk_percent.toFixed(1)}%</span>
                            </div>
                            <ProgressBar value={node.metrics.disk_percent} size="sm" />
                          </div>
                        </div>
                      )}

                      {/* Actions Row */}
                      <div style={{ display: 'flex', gap: '8px', paddingTop: '12px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(node);
                          }}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '6px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'transparent',
                            color: '#fff',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Terminal size={14} />
                          Terminal
                        </button>
                        {isConnected && node.status !== 'maintenance' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                restartNode(node.id);
                              }}
                              style={{
                                padding: '8px 14px',
                                borderRadius: '6px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'transparent',
                                color: '#fff',
                                fontSize: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <RotateCw size={14} />
                              Restart
                            </button>
                            {node.status === 'online' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  stopNode(node.id);
                                }}
                                style={{
                                  padding: '8px 14px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  background: 'transparent',
                                  color: '#fff',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <Square size={14} />
                                Stop
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startNode(node.id);
                                }}
                                style={{
                                  padding: '8px 14px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: '#22c55e',
                                  color: '#0a0a0a',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <Play size={14} />
                                Start
                              </button>
                            )}
                          </>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setNodeToDelete(node.id);
                          }}
                          style={{
                            marginLeft: 'auto',
                            padding: '8px 14px',
                            borderRadius: '6px',
                            border: '1px solid rgba(239,68,68,0.3)',
                            background: 'rgba(239,68,68,0.1)',
                            color: '#ef4444',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedNode && (
        <NodeDetailModal
          node={selectedNode}
          isConnected={isNodeConnected(selectedNode.id, connected)}
          onClose={() => {
            setSelectedNode(null);
            setNodeLogs([]);
          }}
          onRestart={() => restartNode(selectedNode.id)}
          onStop={() => stopNode(selectedNode.id)}
          onStart={() => startNode(selectedNode.id)}
          onDelete={() => {
            setNodeToDelete(selectedNode.id);
            setSelectedNode(null);
          }}
          logs={nodeLogs}
        />
      )}

      {/* Add Node Modal */}
      {showAddModal && (
        <AddNodeModal
          onClose={() => setShowAddModal(false)}
          onDeployCloud={() => {
            window.dispatchEvent(new CustomEvent('a2r:navigate-settings', { detail: { section: 'infrastructure', tab: 'providers' } }));
          }}
        />
      )}

      {/* Delete Confirmation */}
      {nodeToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '24px',
          }}
          onClick={() => setNodeToDelete(null)}
        >
          <div
            style={{
              background: '#1a1a1a',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '400px',
              padding: '24px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(239,68,68,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0 }}>Remove Node</h3>
                <p style={{ fontSize: '13px', color: '#888', margin: '4px 0 0 0' }}>
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: '#aaa', marginBottom: '24px', lineHeight: '1.5' }}>
              Are you sure you want to remove this node? This will disconnect it from the control plane. The node
              agent will need to be reconfigured to reconnect.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setNodeToDelete(null)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent',
                  color: '#fff',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await deleteNode(nodeToDelete);
                  setNodeToDelete(null);
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeManagementPanel;
