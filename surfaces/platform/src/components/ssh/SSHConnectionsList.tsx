/**
 * SSHConnectionsList - Manage SSH connections
 */

"use client";

import React, { useState } from 'react';
import {
  Terminal,
  HardDrives,
  CheckCircle,
  XCircle,
  Clock,
  Trash,
  PencilSimple,
  ArrowsClockwise,
  Plus,
  CaretRight,
  Warning,
  DotsThreeVertical,
  Power,
} from '@phosphor-icons/react';
import { BACKGROUND, SAND, STATUS, TEXT } from '@/design/a2r.tokens';

export interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastConnected?: string;
  os?: string;
  architecture?: string;
  dockerInstalled?: boolean;
  a2rInstalled?: boolean;
  errorMessage?: string;
}

export interface SSHConnectionsListProps {
  connections: SSHConnection[];
  onAddConnection: () => void;
  onEditConnection?: (connection: SSHConnection) => void;
  onDeleteConnection?: (id: string) => void;
  onTestConnection?: (id: string) => Promise<void>;
  onConnect?: (id: string) => Promise<void>;
  onDisconnect?: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export function SSHConnectionsList({
  connections,
  onAddConnection,
  onEditConnection,
  onDeleteConnection,
  onTestConnection,
  onConnect,
  onDisconnect,
  isLoading = false,
}: SSHConnectionsListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const handleTest = async (connection: SSHConnection) => {
    if (!onTestConnection) return;
    setTestingId(connection.id);
    try {
      await onTestConnection(connection.id);
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
    setActionMenuId(null);
  };

  const getStatusIcon = (status: SSHConnection['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle size={16} style={{ color: STATUS.success }} />;
      case 'disconnected':
        return <Power size={16} style={{ color: TEXT.secondary }} />;
      case 'connecting':
        return <ArrowsClockwise className="w-4 h-4 animate-spin" style={{ color: STATUS.info }} />;
      case 'error':
        return <XCircle size={16} style={{ color: STATUS.error }} />;
      default:
        return <Clock size={16} style={{ color: STATUS.warning }} />;
    }
  };

  const getStatusColor = (status: SSHConnection['status']) => {
    switch (status) {
      case 'connected':
        return STATUS.success;
      case 'disconnected':
        return '#888';
      case 'connecting':
        return STATUS.info;
      case 'error':
        return STATUS.error;
      default:
        return STATUS.warning;
    }
  };

  const getStatusText = (status: SSHConnection['status']) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {/* Skeleton Header */}
        <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(37,37,37,0.3)' }}>
          <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'rgba(196,154,122,0.3)' }} />
          <div className="w-10 h-10 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="h-3 w-48 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
          </div>
          <div className="h-6 w-20 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
        </div>
        {/* Skeleton Items */}
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(37,37,37,0.2)' }}>
            <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'rgba(136,136,136,0.2)' }} />
            <div className="w-10 h-10 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <div className="h-3 w-56 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
            </div>
            <div className="h-6 w-24 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
          </div>
        ))}
      </div>
    );
  }

  if (connections.length === 0) {
    return <EmptyState onAddConnection={onAddConnection} />;
  }

  return (
    <div className="space-y-3">
      {connections.map((connection) => (
        <div
          key={connection.id}
          className="rounded-xl border transition-all duration-200"
          style={{
            background: expandedId === connection.id ? 'rgba(37,37,37,0.5)' : 'rgba(37,37,37,0.2)',
            borderColor: expandedId === connection.id ? `${SAND[500]}4c` : '#333',
          }}
        >
          {/* Main Row */}
          <div
            className="flex items-center gap-4 p-4 cursor-pointer"
            onClick={() => handleToggleExpand(connection.id)}
          >
            {/* Status Indicator */}
            <div className="flex-shrink-0">
              <div
                className="w-3 h-3 rounded-full transition-colors"
                style={{ backgroundColor: getStatusColor(connection.status) }}
              />
            </div>

            {/* Icon */}
            <div 
              className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(37,37,37,0.5)' }}
            >
              <HardDrives size={20} style={{ color: TEXT.secondary }} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-white truncate">{connection.name}</h4>
                {getStatusIcon(connection.status)}
              </div>
              <p className="text-sm truncate" style={{ color: TEXT.secondary }}>
                {connection.username}@{connection.host}:{connection.port}
              </p>
            </div>

            {/* Status Badge */}
            <div className="hidden sm:flex items-center gap-2">
              <span 
                className="px-2 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: connection.status === 'connected' ? `${STATUS.success}33` : 
                                  connection.status === 'disconnected' ? 'rgba(136,136,136,0.2)' :
                                  connection.status === 'connecting' ? `${STATUS.info}33` :
                                  '#ef444433',
                  color: getStatusColor(connection.status),
                }}
              >
                {getStatusText(connection.status)}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {connection.status === 'connected' ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDisconnect?.(connection.id);
                  }}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: STATUS.error }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#ef444433'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title="Disconnect"
                >
                  <Power size={16} />
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onConnect?.(connection.id);
                  }}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: STATUS.success }}
                  onMouseEnter={(e) => e.currentTarget.style.background = `${STATUS.success}33`}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title="Connect"
                >
                  <CheckCircle size={16} />
                </button>
              )}

              {/* More Actions Menu */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActionMenuId(actionMenuId === connection.id ? null : connection.id);
                  }}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: TEXT.secondary }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(37,37,37,0.5)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <DotsThreeVertical size={16} />
                </button>

                {actionMenuId === connection.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setActionMenuId(null)}
                    />
                    <div
                      className="absolute right-0 top-full mt-1 w-48 rounded-lg border shadow-lg z-20 overflow-hidden"
                      style={{
                        background: 'rgba(30,30,30,0.95)',
                        borderColor: '#333',
                        backdropFilter: 'blur(10px)',
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTest(connection);
                          setActionMenuId(null);
                        }}
                        disabled={testingId === connection.id}
                        className="w-full px-4 py-2 text-sm text-left transition-colors flex items-center gap-2"
                        style={{ color: TEXT.primary }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(37,37,37,0.5)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {testingId === connection.id ? (
                          <ArrowsClockwise className="w-4 h-4 animate-spin" style={{ color: TEXT.secondary }} />
                        ) : (
                          <ArrowsClockwise size={16} style={{ color: TEXT.secondary }} />
                        )}
                        Test Connection
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditConnection?.(connection);
                          setActionMenuId(null);
                        }}
                        className="w-full px-4 py-2 text-sm text-left transition-colors flex items-center gap-2"
                        style={{ color: TEXT.primary }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(37,37,37,0.5)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <PencilSimple size={16} style={{ color: TEXT.secondary }} />
                        Edit
                      </button>
                      <div style={{ borderTop: '1px solid #333' }} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConnection?.(connection.id);
                          setActionMenuId(null);
                        }}
                        className="w-full px-4 py-2 text-sm text-left transition-colors flex items-center gap-2"
                        style={{ color: STATUS.error }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#ef444433'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <Trash size={16} />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>

              <CaretRight
                className="w-5 h-5 transition-transform"
                style={{ 
                  color: TEXT.secondary,
                  transform: expandedId === connection.id ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              />
            </div>
          </div>

          {/* Expanded Details */}
          {expandedId === connection.id && (
            <div className="px-4 pb-4 pt-0">
              <div className="border-l pl-4 space-y-3" style={{ borderColor: '#333', marginLeft: '28px' }}>
                {/* Connection Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span style={{ color: TEXT.secondary }}>Host:</span>
                    <span className="ml-2 font-mono text-white">{connection.host}</span>
                  </div>
                  <div>
                    <span style={{ color: TEXT.secondary }}>Port:</span>
                    <span className="ml-2 font-mono text-white">{connection.port}</span>
                  </div>
                  <div>
                    <span style={{ color: TEXT.secondary }}>Username:</span>
                    <span className="ml-2 font-mono text-white">{connection.username}</span>
                  </div>
                  {connection.lastConnected && (
                    <div>
                      <span style={{ color: TEXT.secondary }}>Last connected:</span>
                      <span className="ml-2 text-white">
                        {new Date(connection.lastConnected).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* System Info */}
                {(connection.os || connection.architecture) && (
                  <div className="pt-3 border-t" style={{ borderColor: '#333' }}>
                    <h5 className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: TEXT.secondary }}>
                      System Information
                    </h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {connection.os && (
                        <div>
                          <span style={{ color: TEXT.secondary }}>OS:</span>
                          <span className="ml-2 text-white">{connection.os}</span>
                        </div>
                      )}
                      {connection.architecture && (
                        <div>
                          <span style={{ color: TEXT.secondary }}>Architecture:</span>
                          <span className="ml-2 text-white">{connection.architecture}</span>
                        </div>
                      )}
                      {connection.dockerInstalled !== undefined && (
                        <div>
                          <span style={{ color: TEXT.secondary }}>Docker:</span>
                          <span 
                            className="ml-2"
                            style={{ color: connection.dockerInstalled ? STATUS.success : STATUS.warning }}
                          >
                            {connection.dockerInstalled ? 'Installed' : 'Not installed'}
                          </span>
                        </div>
                      )}
                      {connection.a2rInstalled !== undefined && (
                        <div>
                          <span style={{ color: TEXT.secondary }}>A2R Agent:</span>
                          <span 
                            className="ml-2"
                            style={{ color: connection.a2rInstalled ? STATUS.success : STATUS.warning }}
                          >
                            {connection.a2rInstalled ? 'Installed' : 'Not installed'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {connection.errorMessage && (
                  <div 
                    className="p-3 rounded-lg border"
                    style={{ background: '#ef44441a', borderColor: '#ef44444c' }}
                  >
                    <div className="flex items-start gap-2">
                      <Warning className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: STATUS.error }} />
                      <p className="text-sm" style={{ color: STATUS.error }}>{connection.errorMessage}</p>
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="flex gap-2 pt-2">
                  {connection.status === 'connected' && (
                    <button
                      onClick={() => {
                        window.open(`/terminal?host=${connection.host}`, '_blank');
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
                      style={{ 
                        background: `${SAND[500]}33`, 
                        color: SAND[500],
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = `${SAND[500]}4c`}
                      onMouseLeave={(e) => e.currentTarget.style.background = `${SAND[500]}33`}
                    >
                      <Terminal size={16} />
                      Open Terminal
                      <CaretRight size={12} />
                    </button>
                  )}
                  {connection.status === 'error' && (
                    <button
                      onClick={() => handleTest(connection)}
                      disabled={testingId === connection.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
                      style={{ 
                        background: 'rgba(37,37,37,0.5)', 
                        color: TEXT.primary,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(37,37,37,0.7)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(37,37,37,0.5)'}
                    >
                      {testingId === connection.id ? (
                        <ArrowsClockwise className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowsClockwise size={16} />
                      )}
                      Retry Connection
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add Connection Button */}
      <button
        onClick={onAddConnection}
        className="w-full p-4 rounded-xl border border-dashed transition-all flex items-center justify-center gap-2"
        style={{ 
          borderColor: '#333',
          color: TEXT.secondary,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = `${SAND[500]}80`;
          e.currentTarget.style.background = 'rgba(37,37,37,0.2)';
          e.currentTarget.style.color = '#fff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#333';
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#888';
        }}
      >
        <Plus size={20} />
        <span className="font-medium">Add SSH Connection</span>
      </button>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ onAddConnection }: { onAddConnection: () => void }) {
  return (
    <div 
      className="text-center py-16 px-6 rounded-2xl"
      style={{ 
        background: 'linear-gradient(180deg, rgba(37,37,37,0.4) 0%, rgba(37,37,37,0.2) 100%)',
        border: '1px dashed rgba(255,255,255,0.1)',
      }}
    >
      {/* Icon with glow */}
      <div 
        className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 relative"
        style={{ 
          background: 'rgba(196,154,122,0.1)',
          border: '1px solid rgba(196,154,122,0.2)',
        }}
      >
        <div 
          className="absolute inset-0 rounded-2xl blur-xl opacity-30"
          style={{ background: 'rgba(196,154,122,0.4)' }}
        />
        <Terminal size={36} style={{ color: SAND[500], position: 'relative' }} weight="duotone" />
      </div>
      
      <h3 className="text-xl font-semibold text-white mb-3">No VPS Connections</h3>
      <p className="text-sm mb-8 max-w-md mx-auto leading-relaxed" style={{ color: TEXT.secondary }}>
        Connect to your remote servers to deploy A2R agents on your own infrastructure. 
        Works with any VPS provider.
      </p>
      
      <button
        onClick={onAddConnection}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all"
        style={{ 
          background: SAND[500], 
          color: '#1a1a1a',
          boxShadow: '0 4px 14px rgba(196,154,122,0.3)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#c49a7a';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(196,154,122,0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = SAND[500];
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 14px rgba(196,154,122,0.3)';
        }}
      >
        <Plus size={20} weight="bold" />
        Add Your First Connection
      </button>

      {/* Quick Start Card */}
      <div 
        className="mt-10 p-5 rounded-xl text-left max-w-md mx-auto"
        style={{ 
          background: 'rgba(37,37,37,0.5)', 
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2 text-white">
          <div 
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(59,130,246,0.15)' }}
          >
            <Warning size={14} style={{ color: '#60a5fa' }} weight="fill" />
          </div>
          Quick Start Guide
        </h4>
        <div className="space-y-3">
          {[
            'Have a VPS ready (Hetzner, DigitalOcean, AWS, etc.)',
            'Ensure SSH key or password access is enabled',
            'Add your connection details below',
            'A2R automatically installs the remote agent',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span 
                className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5"
                style={{ 
                  background: 'rgba(196,154,122,0.15)',
                  color: SAND[500],
                }}
              >
                {i + 1}
              </span>
              <span className="text-sm" style={{ color: TEXT.secondary }}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SSHConnectionsList;
