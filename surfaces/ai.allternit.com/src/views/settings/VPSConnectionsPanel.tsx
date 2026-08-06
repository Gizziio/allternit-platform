// @ts-nocheck
/**
 * VPSConnectionsPanel - SSH Connection Management for Settings
 * 
 * Full implementation using real API calls to the backend SSH service.
 */

"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowClockwise, Warning } from '@phosphor-icons/react';
import { STATUS, TEXT } from '@/design/allternit.tokens';
import { SectionHeading } from '@/components/settings/SectionHeading';
import { QUIET_BUTTON_CLASS } from '@/components/settings/buttonStyles';
import { cn } from '@/lib/utils';
import { VPSConnectionModal } from '@/components/vps';
import { SSHConnectionsList, type SSHConnection } from '@/components/ssh';
import type { SSHConnectionFormData, SSHConnectionTestResult } from '@/components/ssh';
import { sshApi } from '@/api/infrastructure/ssh';
import { runtimeBackendApi } from '@/api/infrastructure/runtime-backend';

export function VPSConnectionsPanel() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connections, setConnections] = useState<SSHConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load connections from API
  const loadConnections = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await sshApi.getConnections();
      setConnections(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connections');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // Test connection before saving
  const handleTestConnection = useCallback(async (
    data: SSHConnectionFormData
  ): Promise<SSHConnectionTestResult> => {
    return sshApi.testConnection(data);
  }, []);

  // Handle new SSH connection
  const handleConnectExisting = useCallback(async (data: SSHConnectionFormData) => {
    try {
      // Create the connection in the backend
      const newConnection = await sshApi.createConnection({
        name: data.name,
        host: data.host,
        port: data.port,
        username: data.username,
        authType: data.authType,
        privateKey: data.privateKey,
        password: data.password,
      });

      // Add to local state
      setConnections(prev => [...prev, newConnection]);

      // Try to connect and install agent
      setConnections(prev => 
        prev.map(c => 
          c.id === newConnection.id 
            ? { ...c, status: 'connecting' as const }
            : c
        )
      );

      // Connect via SSH
      const connectResult = await sshApi.connect(newConnection.id);
      
      if (connectResult.success) {
        // Update with connection info
        setConnections(prev => 
          prev.map(c => 
            c.id === newConnection.id 
              ? { 
                  ...c, 
                  status: 'connected' as const,
                  os: connectResult.os,
                  architecture: connectResult.architecture,
                  dockerInstalled: connectResult.dockerInstalled,
                  allternitInstalled: connectResult.allternitInstalled,
                  lastConnected: new Date().toISOString(),
                }
              : c
          )
        );

        // Install backend if not present
        if (!connectResult.allternitInstalled) {
          const installResult = await sshApi.installAgent(newConnection.id);
          if (!installResult.success) {
            throw new Error(installResult.message || 'Failed to install remote backend');
          }
          await loadConnections();
        }

        try {
          await runtimeBackendApi.activateSSHConnection(newConnection.id);
        } catch (activationError) {
          setError(
            activationError instanceof Error
              ? activationError.message
              : 'Connected, but the remote backend is not reachable yet',
          );
        }
      } else {
        setConnections(prev => 
          prev.map(c => 
            c.id === newConnection.id 
              ? { 
                  ...c, 
                  status: 'error' as const,
                  errorMessage: connectResult.error || 'Connection failed'
                }
              : c
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add connection');
    }
  }, [loadConnections]);

  // Handle delete
  const handleDelete = useCallback(async (id: string) => {
    try {
      await sshApi.deleteConnection(id);
      setConnections(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete connection');
    }
  }, []);

  // Handle connect
  const handleConnect = useCallback(async (id: string) => {
    setConnections(prev => 
      prev.map(c => 
        c.id === id ? { ...c, status: 'connecting' as const } : c
      )
    );

    try {
      const result = await sshApi.connect(id);
      
      if (result.success) {
        setConnections(prev => 
          prev.map(c => 
            c.id === id ? { 
              ...c, 
              status: 'connected' as const,
              os: result.os,
              architecture: result.architecture,
              dockerInstalled: result.dockerInstalled,
              allternitInstalled: result.allternitInstalled,
              lastConnected: new Date().toISOString(),
            } : c
          )
        );

        if (!result.allternitInstalled) {
          const installResult = await sshApi.installAgent(id);
          if (!installResult.success) {
            throw new Error(installResult.message || 'Failed to install remote backend');
          }
          await loadConnections();
        }

        try {
          await runtimeBackendApi.activateSSHConnection(id);
        } catch (activationError) {
          setError(
            activationError instanceof Error
              ? activationError.message
              : 'Connected, but the remote backend is not reachable yet',
          );
        }
      } else {
        setConnections(prev => 
          prev.map(c => 
            c.id === id ? { 
              ...c, 
              status: 'error' as const,
              errorMessage: result.error || 'Connection failed'
            } : c
          )
        );
      }
    } catch (err) {
      setConnections(prev => 
        prev.map(c => 
          c.id === id ? { 
            ...c, 
            status: 'error' as const,
            errorMessage: err instanceof Error ? err.message : 'Connection failed'
          } : c
        )
      );
    }
  }, [loadConnections]);

  // Handle disconnect
  const handleDisconnect = useCallback(async (id: string) => {
    try {
      await sshApi.disconnect(id);
      const runtimeBackend = await runtimeBackendApi.get().catch(() => null);
      if (runtimeBackend?.active_backend?.ssh_connection_id === id) {
        await runtimeBackendApi.activateLocal();
      }
      setConnections(prev => 
        prev.map(c => 
          c.id === id ? { ...c, status: 'disconnected' as const } : c
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }, []);

  // Handle test connection
  const handleTest = useCallback(async (id: string) => {
    const connection = connections.find(c => c.id === id);
    if (!connection) return;

    try {
      const result = await sshApi.testConnection({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        authType: 'key', // Will be determined by backend
      });

      if (result.success) {
        setConnections(prev => 
          prev.map(c => 
            c.id === id ? { 
              ...c, 
              os: result.details?.os,
              architecture: result.details?.architecture,
              dockerInstalled: result.details?.dockerInstalled,
              allternitInstalled: result.details?.allternitInstalled,
            } : c
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed');
    }
  }, [connections]);

  // Handle provider selection - navigate to cloud deploy wizard
  const handleSelectProvider = useCallback((providerId: string) => {
    navigate(`/cloud-deploy?provider=${providerId}`);
  }, [navigate]);

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header Card */}
      <div 
        style={{ 
          marginBottom: '24px',
          padding: '24px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%)',
          border: '1px solid var(--ui-border-muted)',
        }}
      >
        <SectionHeading className="mb-2">VPS connections</SectionHeading>
        <p style={{ 
          fontSize: '14px', 
          color: TEXT.secondary, 
          margin: 0,
          lineHeight: '1.5',
        }}>
          Manage your VPS and SSH connections. Connect existing servers or deploy new ones 
          through our integrated cloud providers.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div 
          style={{
            marginBottom: '20px',
            padding: '14px 18px',
            borderRadius: '10px',
            background: 'var(--status-error-bg)',
            border: '1px solid rgba(239,68,68,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: STATUS.error,
            fontSize: '13px',
          }}
        >
          <Warning size={18} weight="fill" />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className={QUIET_BUTTON_CLASS}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Action Bar */}
      <div 
        style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px',
          padding: '16px 20px',
          borderRadius: '10px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--ui-border-muted)',
        }}
      >
        <button type="button"
          onClick={() => setIsModalOpen(true)}
          className={QUIET_BUTTON_CLASS}
        >
          <Plus size={18} weight="bold" />
          Add Connection
        </button>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={loadConnections}
          disabled={isLoading}
          className={QUIET_BUTTON_CLASS}
        >
          <ArrowClockwise size={16} className={cn(isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Connections List - Only shows real connections from API */}
      <SSHConnectionsList
        connections={connections}
        onAddConnection={() => setIsModalOpen(true)}
        onDeleteConnection={handleDelete}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onTestConnection={handleTest}
        isLoading={isLoading}
      />

      {/* VPS Connection Modal */}
      <VPSConnectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConnectExisting={handleConnectExisting}
        onTestConnection={handleTestConnection}
        onSelectProvider={handleSelectProvider}
      />
    </div>
  );
}

export default VPSConnectionsPanel;
