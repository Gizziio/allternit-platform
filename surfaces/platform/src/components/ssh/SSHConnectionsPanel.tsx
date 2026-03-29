/**
 * SSHConnectionsPanel - Demo/Test Panel
 * 
 * A simple test component to verify the SSH connection flow works
 * without requiring the full backend implementation.
 */

"use client";

import React, { useState, useCallback } from 'react';
import { VPSConnectionModal } from '@/components/vps';
import { SSHConnectionsList, type SSHConnection } from './SSHConnectionsList';
import type { SSHConnectionFormData, SSHConnectionTestResult } from './AddSSHConnectionForm';

export function SSHConnectionsPanel() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connections, setConnections] = useState<SSHConnection[]>([]);

  // Mock test connection
  const handleTestConnection = useCallback(async (
    data: SSHConnectionFormData
  ): Promise<SSHConnectionTestResult> => {
    console.log('Testing connection to:', data.host);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock success
    return {
      success: true,
      message: 'Connection successful (MOCK)',
      details: {
        os: 'Ubuntu 22.04 LTS',
        architecture: 'x86_64',
        dockerInstalled: true,
        a2rInstalled: false,
      },
    };
  }, []);

  // Handle new connection
  const handleConnectExisting = useCallback(async (data: SSHConnectionFormData) => {
    console.log('Adding connection:', data);
    
    const newConnection: SSHConnection = {
      id: `ssh_${Date.now()}`,
      name: data.name,
      host: data.host.includes('@') ? data.host.split('@')[1] : data.host,
      port: data.port,
      username: data.host.includes('@') ? data.host.split('@')[0] : data.username,
      status: 'connected',
      lastConnected: new Date().toISOString(),
      os: 'Ubuntu 22.04 LTS',
      architecture: 'x86_64',
      dockerInstalled: true,
      a2rInstalled: true,
    };
    
    setConnections(prev => [...prev, newConnection]);
  }, []);

  // Handle delete
  const handleDelete = useCallback((id: string) => {
    setConnections(prev => prev.filter(c => c.id !== id));
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">SSH Connections Test Panel</h1>
      
      <button
        onClick={() => setIsModalOpen(true)}
        className="mb-6 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        + Add Environment
      </button>

      <SSHConnectionsList
        connections={connections}
        onAddConnection={() => setIsModalOpen(true)}
        onDeleteConnection={handleDelete}
      />

      <VPSConnectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConnectExisting={handleConnectExisting}
        onTestConnection={handleTestConnection}
        onSelectProvider={(providerId) => {
          console.log('Selected provider:', providerId);
          alert(`Would open wizard for ${providerId}`);
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}

export default SSHConnectionsPanel;
