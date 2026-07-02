"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { VPSConnectionModal } from '@/components/vps';
import { SSHConnectionsList, type SSHConnection } from './SSHConnectionsList';
import type { SSHConnectionFormData, SSHConnectionTestResult } from './AddSSHConnectionForm';
import { sshConnectionsApi, SSHConnectionsAPI } from '@/api/infrastructure/ssh';
import { cn } from '@/lib/utils';
import { Plus, WarningCircle, ArrowsClockwise } from '@phosphor-icons/react';

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
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold text-[var(--ui-text-primary)] m-0">SSH Connections</h1>
        {error && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--status-error-bg)] border border-solid border-red-500/20 rounded-lg text-[var(--status-error)] text-[13px] font-medium">
            <WarningCircle size={16} />
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-primary)] rounded-lg border-none font-bold text-[14px] cursor-pointer flex items-center gap-2 transition-all hover:opacity-90"
        >
          <Plus size={18} weight="bold" />
          Add Connection
        </button>
        <button type="button"
          onClick={loadConnections}
          disabled={loading}
          className="p-2 bg-[var(--surface-hover)] text-[var(--ui-text-secondary)] rounded-lg border border-solid border-[var(--ui-border-muted)] cursor-pointer transition-all hover:text-[var(--ui-text-primary)] disabled:opacity-50"
          title="Refresh connections"
        >
          <ArrowsClockwise size={18} className={cn(loading && "animate-spin")} />
        </button>
      </div>

      <div className="flex-1">
        {loading && connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--ui-text-muted)] gap-3">
            <ArrowsClockwise size={32} className="animate-spin" />
            <p className="m-0 text-[14px] font-medium">Loading connections…</p>
          </div>
        ) : (
          <SSHConnectionsList
            connections={connections}
            onAddConnection={() => setIsModalOpen(true)}
            onDeleteConnection={handleDelete}
            isLoading={loading}
          />
        )}
      </div>

      <VPSConnectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConnectExisting={handleConnectExisting}
        onTestConnection={handleTestConnection}
        onSelectProvider={() => {
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}

export default SSHConnectionsPanel;
