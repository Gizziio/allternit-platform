"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { VPSConnectionModal } from '@/components/vps';
import { SSHConnectionsList, type SSHConnection } from './SSHConnectionsList';
import type { SSHConnectionFormData, SSHConnectionTestResult } from './AddSSHConnectionForm';
import { sshConnectionsApi, SSHConnectionsAPI } from '@/api/infrastructure/ssh';

export function SSHConnectionsPanel() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connections, setConnections] = useState<SSHConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sshConnectionsApi.listConnections();
      setConnections(data.map(SSHConnectionsAPI.responseToConnection));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleTestConnection = useCallback(async (
    data: SSHConnectionFormData
  ): Promise<SSHConnectionTestResult> => {
    const req = SSHConnectionsAPI.formDataToRequest(data);
    const result = await sshConnectionsApi.testConnection(req);
    return SSHConnectionsAPI.responseToTestResult(result);
  }, []);

  const handleConnectExisting = useCallback(async (data: SSHConnectionFormData) => {
    const req = SSHConnectionsAPI.formDataToRequest(data);
    const created = await sshConnectionsApi.createConnection(req);
    // Attempt to connect immediately after creation
    try {
      const connected = await sshConnectionsApi.connect(created.id);
      setConnections(prev => [...prev, SSHConnectionsAPI.responseToConnection(connected)]);
    } catch {
      setConnections(prev => [...prev, SSHConnectionsAPI.responseToConnection(created)]);
    }
    setIsModalOpen(false);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await sshConnectionsApi.deleteConnection(id);
      setConnections(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete connection');
    }
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">SSH Connections</h1>
        {error && (
          <span className="text-sm text-red-400 bg-red-400/10 px-3 py-1 rounded-lg">
            {error}
          </span>
        )}
      </div>

      <button
        onClick={() => setIsModalOpen(true)}
        className="mb-6 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        + Add Environment
      </button>

      {loading ? (
        <div className="text-white/40 text-sm">Loading connections…</div>
      ) : (
        <SSHConnectionsList
          connections={connections}
          onAddConnection={() => setIsModalOpen(true)}
          onDeleteConnection={handleDelete}
        />
      )}

      <VPSConnectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConnectExisting={handleConnectExisting}
        onTestConnection={handleTestConnection}
        onSelectProvider={(providerId) => {
          console.log('Selected provider:', providerId);
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}

export default SSHConnectionsPanel;
