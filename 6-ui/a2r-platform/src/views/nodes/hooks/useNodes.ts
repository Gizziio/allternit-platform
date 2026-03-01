"use client";

import { useState, useEffect, useCallback } from 'react';
import { GATEWAY_BASE_URL } from '@/integration/api-client';
import type { NodesResponse, NodeRecord, NodeTokenResponse } from '../types';

const API_BASE = `${GATEWAY_BASE_URL}/api/v1`;

export function useNodes() {
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [connected, setConnected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNodes();
    
    // Poll every 5 seconds for live updates
    const interval = setInterval(fetchNodes, 5000);
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
      
      // Refresh the list
      await fetchNodes();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchNodes]);

  return {
    nodes,
    connected,
    loading,
    error,
    refresh: fetchNodes,
    deleteNode,
  };
}

export function useNodeToken() {
  const [tokenData, setTokenData] = useState<NodeTokenResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

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

export function isNodeConnected(nodeId: string, connected: string[]): boolean {
  return connected.includes(nodeId);
}
