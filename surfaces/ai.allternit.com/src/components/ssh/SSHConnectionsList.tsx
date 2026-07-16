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
import { SAND, STATUS, TEXT } from '@/design/allternit.tokens';
import { useNav } from '@/nav/useNav';
import { cn } from '@/lib/utils';

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
        return <CheckCircle size={16} className="text-[var(--status-success)]" />;
      case 'disconnected':
        return <Power size={16} className="text-[var(--ui-text-secondary)]" />;
      case 'connecting':
        return <ArrowsClockwise className="size-4 animate-spin text-[var(--status-info)]" />;
      case 'error':
        return <XCircle size={16} className="text-[var(--status-error)]" />;
      default:
        return <Clock size={16} className="text-[var(--status-warning)]" />;
    }
  };

  const getStatusColorClass = (status: SSHConnection['status']) => {
    switch (status) {
      case 'connected':
        return "bg-[var(--status-success)]";
      case 'disconnected':
        return "bg-[var(--ui-text-muted)]";
      case 'connecting':
        return "bg-[var(--status-info)]";
      case 'error':
        return "bg-[var(--status-error)]";
      default:
        return "bg-[var(--status-warning)]";
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
        <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--surface-hover)]">
          <div className="size-3 rounded-full animate-pulse bg-[var(--accent-primary)]/30" />
          <div className="size-10 rounded-lg animate-pulse bg-[var(--surface-hover)]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded animate-pulse bg-[var(--surface-active)]" />
            <div className="h-3 w-48 rounded animate-pulse bg-[var(--surface-hover)]" />
          </div>
          <div className="h-6 w-20 rounded-full animate-pulse bg-[var(--surface-hover)]" />
        </div>
        {/* Skeleton Items */}
        {[1, 2].map((i) => (
          <div key={`vps-skeleton-${i}`} className="flex items-center gap-4 p-4 rounded-xl bg-[var(--surface-hover)]">
            <div className="size-3 rounded-full animate-pulse bg-[var(--surface-hover)]" />
            <div className="size-10 rounded-lg animate-pulse bg-[var(--surface-hover)]" />
            <div className="flex-1 space-y-2">
              <div className="size-40 rounded animate-pulse bg-[var(--surface-active)]" />
              <div className="h-3 w-56 rounded animate-pulse bg-[var(--surface-hover)]" />
            </div>
            <div className="h-6 w-24 rounded-full animate-pulse bg-[var(--surface-hover)]" />
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
          className={cn(
            "rounded-xl border border-solid transition-all duration-200",
            expandedId === connection.id ? "bg-[var(--surface-panel)] border-[var(--accent-primary)]/30" : "bg-[var(--surface-hover)] border-[var(--ui-border-muted)]"
          )}
        >
          {/* Main Row */}
          <div role="button" tabIndex={0}
            className="flex items-center gap-4 p-4 cursor-pointer outline-none"
            onClick={() => handleToggleExpand(connection.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleToggleExpand(connection.id); }}
          >
            {/* Status Indicator */}
            <div className="shrink-0">
              <div
                className={cn("size-3 rounded-full transition-colors", getStatusColorClass(connection.status))}
              />
            </div>

            {/* Icon */}
            <div className="shrink-0 size-10 rounded-lg flex items-center justify-center bg-[var(--surface-panel)]">
              <HardDrives size={20} className="text-[var(--ui-text-secondary)]" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-[var(--ui-text-primary)] truncate m-0">{connection.name}</h4>
                {getStatusIcon(connection.status)}
              </div>
              <p className="text-sm truncate m-0 text-[var(--ui-text-secondary)]">
                {connection.username}@{connection.host}:{connection.port}
              </p>
            </div>

            {/* Status Badge */}
            <div className="hidden sm:flex items-center gap-2">
              <span 
                className={cn(
                  "px-2 py-1 rounded-full text-xs font-medium",
                  connection.status === 'connected' ? "bg-[var(--status-success)]/20 text-[var(--status-success)]" : 
                  connection.status === 'disconnected' ? "bg-[var(--surface-hover)] text-[var(--ui-text-muted)]" :
                  connection.status === 'connecting' ? "bg-[var(--status-info)]/20 text-[var(--status-info)]" :
                  "bg-[var(--status-error-bg)] text-[var(--status-error)]"
                )}
              >
                {getStatusText(connection.status)}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {connection.status === 'connected' ? (
                <button type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDisconnect?.(connection.id);
                  }}
                  className="p-2 rounded-lg transition-colors border-none bg-transparent cursor-pointer text-[var(--status-error)] hover:bg-[var(--status-error-bg)]"
                  title="Disconnect"
                >
                  <Power size={16} />
                </button>
              ) : (
                <button type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onConnect?.(connection.id);
                  }}
                  className="p-2 rounded-lg transition-colors border-none bg-transparent cursor-pointer text-[var(--status-success)] hover:bg-[var(--status-success)]/20"
                  title="Connect"
                >
                  <CheckCircle size={16} />
                </button>
              )}

              {/* More Actions Menu */}
              <div className="relative">
                <button type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActionMenuId(actionMenuId === connection.id ? null : connection.id);
                  }}
                  className="p-2 rounded-lg transition-colors border-none bg-transparent cursor-pointer text-[var(--ui-text-secondary)] hover:bg-[var(--surface-panel)]"
                >
                  <DotsThreeVertical size={16} />
                </button>

                {actionMenuId === connection.id && (
                  <>
                    <div role="button" tabIndex={0}
                      className="fixed inset-0 z-10"
                      onClick={() => setActionMenuId(null)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActionMenuId(null); }}
                    />
                    <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-floating)] backdrop-blur-md shadow-lg z-20 overflow-hidden">
                      <button type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTest(connection);
                          setActionMenuId(null);
                        }}
                        disabled={testingId === connection.id}
                        className="w-full px-4 py-2 text-sm text-left transition-colors flex items-center gap-2 border-none bg-transparent cursor-pointer text-[var(--ui-text-primary)] hover:bg-[var(--surface-panel)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {testingId === connection.id ? (
                          <ArrowsClockwise className="size-4 animate-spin text-[var(--ui-text-secondary)]" />
                        ) : (
                          <ArrowsClockwise size={16} className="text-[var(--ui-text-secondary)]" />
                        )}
                        Test Connection
                      </button>
                      <button type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditConnection?.(connection);
                          setActionMenuId(null);
                        }}
                        className="w-full px-4 py-2 text-sm text-left transition-colors flex items-center gap-2 border-none bg-transparent cursor-pointer text-[var(--ui-text-primary)] hover:bg-[var(--surface-panel)]"
                      >
                        <PencilSimple size={16} className="text-[var(--ui-text-secondary)]" />
                        Edit
                      </button>
                      <div className="h-px bg-[var(--ui-border-muted)]" />
                      <button type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConnection?.(connection.id);
                          setActionMenuId(null);
                        }}
                        className="w-full px-4 py-2 text-sm text-left transition-colors flex items-center gap-2 border-none bg-transparent cursor-pointer text-[var(--status-error)] hover:bg-[var(--status-error-bg)]"
                      >
                        <Trash size={16} />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>

              <CaretRight
                className={cn("size-5 transition-transform text-[var(--ui-text-secondary)]", expandedId === connection.id ? "rotate-90" : "rotate-0")}
              />
            </div>
          </div>

          {/* Expanded Details */}
          {expandedId === connection.id && (
            <div className="px-4 pb-4 pt-0">
              <div className="border-l border-solid border-[var(--ui-border-muted)] ml-7 pl-4 space-y-3">
                {/* Connection Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--ui-text-secondary)]">Host:</span>
                    <span className="ml-2 font-mono text-[var(--ui-text-primary)]">{connection.host}</span>
                  </div>
                  <div>
                    <span className="text-[var(--ui-text-secondary)]">Port:</span>
                    <span className="ml-2 font-mono text-[var(--ui-text-primary)]">{connection.port}</span>
                  </div>
                  <div>
                    <span className="text-[var(--ui-text-secondary)]">Username:</span>
                    <span className="ml-2 font-mono text-[var(--ui-text-primary)]">{connection.username}</span>
                  </div>
                  {connection.lastConnected && (
                    <div>
                      <span className="text-[var(--ui-text-secondary)]">Last connected:</span>
                      <span className="ml-2 text-[var(--ui-text-primary)]">
                        {new Date(connection.lastConnected).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* System Info */}
                {(connection.os || connection.architecture) && (
                  <div className="pt-3 border-t border-solid border-[var(--ui-border-muted)]">
                    <h5 className="text-xs font-medium uppercase tracking-wide mb-2 text-[var(--ui-text-secondary)]">
                      System Information
                    </h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {connection.os && (
                        <div>
                          <span className="text-[var(--ui-text-secondary)]">OS:</span>
                          <span className="ml-2 text-[var(--ui-text-primary)]">{connection.os}</span>
                        </div>
                      )}
                      {connection.architecture && (
                        <div>
                          <span className="text-[var(--ui-text-secondary)]">Architecture:</span>
                          <span className="ml-2 text-[var(--ui-text-primary)]">{connection.architecture}</span>
                        </div>
                      )}
                      {connection.dockerInstalled !== undefined && (
                        <div>
                          <span className="text-[var(--ui-text-secondary)]">Docker:</span>
                          <span 
                            className={cn("ml-2", connection.dockerInstalled ? "text-[var(--status-success)]" : "text-[var(--status-warning)]")}
                          >
                            {connection.dockerInstalled ? 'Installed' : 'Not installed'}
                          </span>
                        </div>
                      )}
                      {connection.allternitInstalled !== undefined && (
                        <div>
                          <span className="text-[var(--ui-text-secondary)]">Allternit Agent:</span>
                          <span 
                            className={cn("ml-2", connection.allternitInstalled ? "text-[var(--status-success)]" : "text-[var(--status-warning)]")}
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
                  <div className="p-3 rounded-lg border border-solid bg-[var(--status-error-bg)] border-red-500/30">
                    <div className="flex items-start gap-2">
                      <Warning className="size-4 shrink-0 mt-0.5 text-[var(--status-error)]" />
                      <p className="text-sm m-0 text-[var(--status-error)]">{connection.errorMessage}</p>
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="flex gap-2 pt-2">
                  {connection.status === 'connected' && (
                    <button type="button"
                      onClick={() => {
                        useNav.getState().dispatch({ type: 'OPEN_VIEW', viewType: 'terminal' });
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border-none cursor-pointer transition-all bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/30"
                    >
                      <Terminal size={16} />
                      Open Terminal
                      <CaretRight size={12} />
                    </button>
                  )}
                  {connection.status === 'error' && (
                    <button type="button"
                      onClick={() => handleTest(connection)}
                      disabled={testingId === connection.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border-none cursor-pointer transition-all bg-[var(--surface-panel)] text-[var(--ui-text-primary)] hover:bg-[var(--surface-floating)]"
                    >
                      {testingId === connection.id ? (
                        <ArrowsClockwise className="size-4 animate-spin" />
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
      <button type="button"
        onClick={onAddConnection}
        className="w-full p-4 rounded-xl border border-dashed border-[var(--ui-border-muted)] bg-transparent text-[var(--ui-text-secondary)] transition-all flex items-center justify-center gap-2 cursor-pointer hover:border-[var(--accent-primary)]/50 hover:bg-[var(--surface-hover)] hover:text-[var(--ui-text-primary)]"
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
    <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-[var(--ui-border-default)] bg-gradient-to-b from-black/20 to-[var(--surface-hover)]">
      {/* Icon with glow */}
      <div className="size-20 rounded-2xl flex items-center justify-center mx-auto mb-6 relative bg-[var(--accent-primary)]/10 border border-solid border-[var(--accent-primary)]/20">
        <div className="absolute inset-0 rounded-2xl blur-xl opacity-30 bg-[var(--accent-primary)]/40" />
        <Terminal size={36} className="text-[var(--accent-primary)] relative" weight="duotone" />
      </div>
      
      <h3 className="text-xl font-semibold text-[var(--ui-text-primary)] mb-3">No VPS Connections</h3>
      <p className="text-sm mb-8 max-w-md mx-auto leading-relaxed text-[var(--ui-text-secondary)]">
        Connect to your remote servers to deploy Allternit agents on your own infrastructure. 
        Works with any VPS provider.
      </p>
      
      <button type="button"
        onClick={onAddConnection}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold border-none cursor-pointer transition-all bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] shadow-[0_4px_14px_rgba(212,176,140,0.3)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(212,176,140,0.4)]"
      >
        <Plus size={20} weight="bold" />
        Add Your First Connection
      </button>

      {/* Quick Start Card */}
      <div className="mt-10 p-5 rounded-xl text-left max-w-md mx-auto bg-[var(--surface-panel)] border border-solid border-[var(--ui-border-muted)]">
        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[var(--ui-text-primary)]">
          <div className="size-6 rounded-lg flex items-center justify-center bg-[var(--status-info-bg)]">
            <Warning size={14} className="text-[var(--status-info)]" weight="fill" />
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
            <div key={`step-${i}`} className="flex items-start gap-3">
              <span className="size-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                {i + 1}
              </span>
              <span className="text-sm text-[var(--ui-text-secondary)]">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SSHConnectionsList;
