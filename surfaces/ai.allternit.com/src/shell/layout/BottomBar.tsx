"use client";

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  WifiHigh,
  WifiSlash,
  CircleNotch,
  CheckCircle,
  Warning,
  CloudSlash,
  ArrowsClockwise,
  TreeStructure as GitBranch,
  GlobeHemisphereWest,
  ShieldCheck,
} from '@phosphor-icons/react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';

// =============================================================================
// Types
// =============================================================================

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

export interface BottomBarAction {
  id: string;
  icon: PhosphorIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
}

export interface BottomBarProps {
  // Status indicators
  connectionStatus?: ConnectionStatus;
  syncStatus?: SyncStatus;
  
  // Context info
  currentContext?: string;
  selectedItems?: number;
  
  // Actions
  actions?: BottomBarAction[];
  
  // Right section
  right?: React.ReactNode;
  showVersion?: boolean;
  version?: string;
  
  // Styling
  className?: string;
  height?: number;
}

// =============================================================================
// BottomBar Component
// =============================================================================

export function BottomBar({
  connectionStatus = 'connected',
  syncStatus = 'synced',
  currentContext,
  selectedItems,
  actions = [],
  right,
  showVersion = true,
  version = '2.1.0',
  className,
  height = 32,
}: BottomBarProps): JSX.Element {
  return (
    <footer
      className={cn(
        'bottombar shrink-0 flex items-center px-3 gap-4',
        'border-t border-white/10',
        'bg-background/80 backdrop-blur-md',
        'text-xs text-muted-foreground',
        className
      )}
      style={{ height }}
    >
      {/* Left: Status indicators */}
      <div className="flex items-center gap-4">
        <ConnectionStatusIndicator status={connectionStatus} />
        <SyncStatusIndicator status={syncStatus} />
        
        {currentContext && (
          <ContextDisplay context={currentContext} />
        )}
        
        {selectedItems !== undefined && selectedItems > 0 && (
          <SelectedItemsCount count={selectedItems} />
        )}
      </div>

      {/* Center: Actions */}
      {actions.length > 0 && (
        <div className="flex-1 flex items-center justify-center gap-1">
          {actions.map(action => (
            <BottomBarActionButton key={action.id} action={action} />
          ))}
        </div>
      )}

      {/* Spacer if no actions */}
      {actions.length === 0 && <div className="flex-1" />}

      {/* Right: Version and custom content */}
      <div className="flex items-center gap-3">
        {right}
        <TunnelStatusBadge />
        <PermissionStatusBadge />
        {showVersion && <VersionDisplay version={version} />}
      </div>
    </footer>
  );
}

// =============================================================================
// ConnectionStatusIndicator Component
// =============================================================================

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus;
}

function ConnectionStatusIndicator({ status }: ConnectionStatusIndicatorProps): JSX.Element {
  const config = {
    connected: {
      icon: WifiHigh,
      label: 'Connected',
      className: 'text-green-500',
    },
    connecting: {
      icon: CircleNotch,
      label: 'Connecting...',
      className: 'text-amber-500 animate-spin',
    },
    disconnected: {
      icon: WifiSlash,
      label: 'Disconnected',
      className: 'text-red-500',
    },
  };

  const { icon: Icon, label, className } = config[status];

  return (
    <div 
      className="flex items-center gap-1.5"
      title={`Connection: ${label}`}
    >
      <Icon className={cn('w-3.5 h-3.5', className)} />
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

// =============================================================================
// SyncStatusIndicator Component
// =============================================================================

interface SyncStatusIndicatorProps {
  status: SyncStatus;
}

function SyncStatusIndicator({ status }: SyncStatusIndicatorProps): JSX.Element {
  const config = {
    synced: {
      icon: CheckCircle,
      label: 'Synced',
      className: 'text-green-500',
    },
    syncing: {
      icon: ArrowsClockwise,
      label: 'Syncing...',
      className: 'text-blue-500 animate-spin',
    },
    offline: {
      icon: CloudSlash,
      label: 'Offline',
      className: 'text-muted-foreground',
    },
    error: {
      icon: Warning,
      label: 'Sync Error',
      className: 'text-red-500',
    },
  };

  const { icon: Icon, label, className } = config[status];

  return (
    <div 
      className="flex items-center gap-1.5"
      title={`Sync: ${label}`}
    >
      <Icon className={cn('w-3.5 h-3.5', className)} />
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

// =============================================================================
// ContextDisplay Component
// =============================================================================

interface ContextDisplayProps {
  context: string;
}

function ContextDisplay({ context }: ContextDisplayProps): JSX.Element {
  return (
    <div 
      className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/50"
      title="Current context"
    >
      <span className="text-muted-foreground">Context:</span>
      <span className="font-medium text-foreground truncate max-w-[150px]">
        {context}
      </span>
    </div>
  );
}

// =============================================================================
// SelectedItemsCount Component
// =============================================================================

interface SelectedItemsCountProps {
  count: number;
}

function SelectedItemsCount({ count }: SelectedItemsCountProps): JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-medium text-foreground">{count}</span>
      <span>selected</span>
    </div>
  );
}

// =============================================================================
// BottomBarActionButton Component
// =============================================================================

interface BottomBarActionButtonProps {
  action: BottomBarAction;
}

function BottomBarActionButton({ action }: BottomBarActionButtonProps): JSX.Element {
  const Icon = action.icon;

  return (
    <button
      onClick={action.onClick}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded',
        'hover:bg-accent transition-colors',
        action.active && 'bg-accent text-foreground'
      )}
      title={action.label}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden md:inline">{action.label}</span>
    </button>
  );
}

// =============================================================================
// VersionDisplay Component
// =============================================================================

interface VersionDisplayProps {
  version: string;
}

function VersionDisplay({ version }: VersionDisplayProps): JSX.Element {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <GitBranch size={12} />
      <span>v{version}</span>
    </div>
  );
}

// =============================================================================
// TunnelStatusBadge — shows Cloudflare tunnel state in the status bar.
// Only renders in the Electron desktop (where window.allternit.tunnel exists).
// On web, shows "Desktop Connected" when routed through a tunnel, else nothing.
// =============================================================================

type TunnelStatus = 'stopped' | 'starting' | 'running' | 'error';
type TunnelState = { status: TunnelStatus; url?: string };

function TunnelStatusBadge(): JSX.Element | null {
  const [tunnelState, setTunnelState] = useState<TunnelState | null>(null);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    const electronTunnel = window.allternit?.tunnel;
    if (electronTunnel) {
      setIsElectron(true);
      electronTunnel.getState().then(setTunnelState).catch(() => {});
      const unsub = electronTunnel.onStateChange(setTunnelState);
      return unsub;
    }
  }, []);

  if (!isElectron || !tunnelState || tunnelState.status === 'stopped') return null;

  const config: Record<TunnelStatus, { dot: string; label: string; className: string }> = {
    stopped:  { dot: 'bg-slate-500',  label: '',          className: '' },
    starting: { dot: 'bg-yellow-500 animate-pulse', label: 'Tunnel starting…', className: 'text-yellow-500' },
    running:  { dot: 'bg-green-500',  label: 'Web On',    className: 'text-green-500' },
    error:    { dot: 'bg-red-500',    label: 'Tunnel error', className: 'text-red-500' },
  };

  const { dot, label, className } = config[tunnelState.status];

  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      title={tunnelState.status === 'running' && tunnelState.url
        ? `Tunnel: https://${tunnelState.url}`
        : label}
    >
      <GlobeHemisphereWest size={12} />
      <div className={cn('w-1.5 h-1.5 rounded-full', dot)} />
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}


// =============================================================================
// PermissionStatusBadge — shows macOS Accessibility / Screen Recording status.
// Only renders in the Electron desktop on macOS.
// =============================================================================

function PermissionStatusBadge(): JSX.Element | null {
  const [permStatus, setPermStatus] = useState<AppPermissionStatus | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const platform = navigator.platform.toLowerCase();
    const isDesktopPlatform = platform.includes('mac') || platform.includes('win') || platform.includes('linux');
    const api = window.allternit?.permissionGuide;
    if (isDesktopPlatform && api) {
      setIsDesktop(true);
      api.check().then((status) => setPermStatus(status)).catch(() => {});
      const unsub = api.onStatusChanged((status) => setPermStatus(status));
      return unsub;
    }
  }, []);

  if (!isDesktop || !permStatus) return null;

  const allGranted = permStatus.accessibility === 'granted' && permStatus.screenRecording === 'granted';
  const anyDenied = permStatus.accessibility === 'denied' || permStatus.screenRecording === 'denied';

  if (allGranted) {
    return (
      <div
        className="flex items-center gap-1.5 text-green-500"
        title="Accessibility & Screen Recording granted"
      >
        <ShieldCheck size={12} />
        <span className="hidden sm:inline">Permissions OK</span>
      </div>
    );
  }

  if (anyDenied) {
    return (
      <div
        className="flex items-center gap-1.5 text-amber-500 cursor-pointer"
        title="Click to open permission settings"
        onClick={() => {
          const api = window.allternit?.permissionGuide;
          if (permStatus.accessibility === 'denied') {
            api?.present?.('accessibility');
          } else if (permStatus.screenRecording === 'denied') {
            api?.present?.('screen-recording');
          }
        }}
      >
        <Warning size={12} />
        <span className="hidden sm:inline">Permissions Needed</span>
      </div>
    );
  }

  return null;
}
