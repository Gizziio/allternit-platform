"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { 
  Wifi, 
  WifiOff, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  CloudOff,
  RefreshCw,
  GitBranch,
  type LucideIcon,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

export interface BottomBarAction {
  id: string;
  icon: LucideIcon;
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
}: BottomBarProps) {
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

function ConnectionStatusIndicator({ status }: ConnectionStatusIndicatorProps) {
  const config = {
    connected: {
      icon: Wifi,
      label: 'Connected',
      className: 'text-green-500',
    },
    connecting: {
      icon: Loader2,
      label: 'Connecting...',
      className: 'text-amber-500 animate-spin',
    },
    disconnected: {
      icon: WifiOff,
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

function SyncStatusIndicator({ status }: SyncStatusIndicatorProps) {
  const config = {
    synced: {
      icon: CheckCircle2,
      label: 'Synced',
      className: 'text-green-500',
    },
    syncing: {
      icon: RefreshCw,
      label: 'Syncing...',
      className: 'text-blue-500 animate-spin',
    },
    offline: {
      icon: CloudOff,
      label: 'Offline',
      className: 'text-muted-foreground',
    },
    error: {
      icon: AlertCircle,
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

function ContextDisplay({ context }: ContextDisplayProps) {
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

function SelectedItemsCount({ count }: SelectedItemsCountProps) {
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

function BottomBarActionButton({ action }: BottomBarActionButtonProps) {
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

function VersionDisplay({ version }: VersionDisplayProps) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <GitBranch className="w-3 h-3" />
      <span>v{version}</span>
    </div>
  );
}
