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
import { BACKGROUND, SAND, STATUS, TEXT } from '@/design/allternit.tokens';
import { useNav } from '@/nav/useNav';

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
  allternitInstalled?: boolean;
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
        return 'var(--ui-text-muted)';
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
        <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'var(--surface-hover)' }}>
          <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'color-mix(in srgb, var(--accent-primary) 30%, transparent)' }} />
          <div className="w-10 h-10 rounded-lg animate-pulse" style={{ background: 'var(--surface-hover)' }} />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded animate-pulse" style={{ background: 'var(--surface-active)' }} />
            <div className="h-3 w-48 rounded animate-pulse" style={{ background: 'var(--surface-hover)' }} />
          </div>
          <div className="h-6 w-20 rounded-full animate-pulse" style={{ background: 'var(--surface-hover)' }} />
        </div>
        {/* Skeleton Items */}
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'var(--surface-hover)' }}>
            <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'var(--surface-hover)' }} />
            <div className="w-10 h-10 rounded-lg animate-pulse" style={{ background: 'var(--surface-hover)' }} />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded animate-pulse" style={{ background: 'var(--surface-active)' }} />
              <div className="h-3 w-56 rounded animate-pulse" style={{ background: 'var(--surface-hover)' }} />
            </div>
            <div className="h-6 w-24 rounded-full animate-pulse" style={{ background: 'var(--surface-hover)' }} />
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
            background: expandedId === connection.id ? 'var(--surface-panel)' : 'var(--surface-hover)',
            borderColor: expandedId === connection.id ? `${SAND[500]}4c` : 'var(--ui-border-muted)',
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
              style={{ background: 'var(--surface-panel)' }}
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
                                  connection.status === 'disconnected' ? 'var(--surface-hover)' :
                                  connection.status === 'connecting' ? `${STATUS.info}33` :
                                  'var(--status-error-bg)',
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
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--status-error-bg)'}
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
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-panel)'}
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
                        background: 'var(--surface-floating)',
                        borderColor: 'var(--ui-border-muted)',
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
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-panel)'}
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
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-panel)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <PencilSimple size={16} style={{ color: TEXT.secondary }} />
                        Edit
                      </button>
                      <div style={{ borderTop: '1px solid var(--ui-border-muted)' }} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConnection?.(connection.id);
                          setActionMenuId(null);
                        }}
                        className="w-full px-4 py-2 text-sm text-left transition-colors flex items-center gap-2"
                        style={{ color: STATUS.error }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--status-error-bg)'}
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
              <div className="border-l pl-4 space-y-3" style={{ borderColor: 'var(--ui-border-muted)', marginLeft: '28px' }}>
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
                  <div className="pt-3 border-t" style={{ borderColor: 'var(--ui-border-muted)' }}>
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
                      {connection.allternitInstalled !== undefined && (
                        <div>
                          <span style={{ color: TEXT.secondary }}>Allternit Agent:</span>
                          <span 
                            className="ml-2"
                            style={{ color: connection.allternitInstalled ? STATUS.success : STATUS.warning }}
                          >
                            {connection.allternitInstalled ? 'Installed' : 'Not installed'}
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
                    style={{ background: 'var(--status-error-bg)', borderColor: 'color-mix(in srgb, var(--status-error) 30%, transparent)' }}
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
                        useNav.getState().dispatch({ type: 'OPEN_VIEW', viewType: 'terminal' });
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
                        background: 'var(--surface-panel)', 
                        color: TEXT.primary,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-floating)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface-panel)'}
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
          borderColor: 'var(--ui-border-muted)',
          color: TEXT.secondary,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = `${SAND[500]}80`;
          e.currentTarget.style.background = 'var(--surface-hover)';
          e.currentTarget.style.color = 'var(--ui-text-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--ui-border-muted)';
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--ui-text-muted)';
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
        background: 'linear-gradient(180deg, rgba(37,37,37,0.4) 0%, var(--surface-hover) 100%)',
        border: '1px dashed var(--ui-border-default)',
      }}
    >
      {/* Icon with glow */}
      <div 
        className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 relative"
        style={{ 
          background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)',
        }}
      >
        <div 
          className="absolute inset-0 rounded-2xl blur-xl opacity-30"
          style={{ background: 'color-mix(in srgb, var(--accent-primary) 40%, transparent)' }}
        />
        <Terminal size={36} style={{ color: SAND[500], position: 'relative' }} weight="duotone" />
      </div>
      
      <h3 className="text-xl font-semibold text-white mb-3">No VPS Connections</h3>
      <p className="text-sm mb-8 max-w-md mx-auto leading-relaxed" style={{ color: TEXT.secondary }}>
        Connect to your remote servers to deploy Allternit agents on your own infrastructure. 
        Works with any VPS provider.
      </p>
      
      <button
        onClick={onAddConnection}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all"
        style={{ 
          background: SAND[500], 
          color: 'var(--ui-text-inverse)',
          boxShadow: '0 4px 14px color-mix(in srgb, var(--accent-primary) 30%, transparent)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--accent-primary)';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 20px color-mix(in srgb, var(--accent-primary) 40%, transparent)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = SAND[500];
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 14px color-mix(in srgb, var(--accent-primary) 30%, transparent)';
        }}
      >
        <Plus size={20} weight="bold" />
        Add Your First Connection
      </button>

      {/* Quick Start Card */}
      <div 
        className="mt-10 p-5 rounded-xl text-left max-w-md mx-auto"
        style={{ 
          background: 'var(--surface-panel)', 
          border: '1px solid var(--ui-border-muted)',
        }}
      >
        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2 text-white">
          <div 
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--status-info-bg)' }}
          >
            <Warning size={14} style={{ color: 'var(--status-info)' }} weight="fill" />
          </div>
          Quick Start Guide
        </h4>
        <div className="space-y-3">
          {[
            'Have a VPS ready (Hetzner, DigitalOcean, AWS, etc.)',
            'Ensure SSH key or password access is enabled',
            'Add your connection details below',
            'Allternit automatically installs the remote agent',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span 
                className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5"
                style={{ 
                  background: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)',
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
