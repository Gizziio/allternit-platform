/**
 * DependencyModal Component
 * 
 * Modal shown when installing a plugin with dependencies.
 * Lists all required dependencies with install options.
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  X,
  Download,
  CheckCircle2,
  AlertCircle,
  Package,
  Loader2,
  ChevronRight,
  Info,
  ListTree,
} from 'lucide-react';
import type { DependencyResolutionResult, DependencyTreeNode } from '../plugins/dependencies';

// ============================================================================
// Theme
// ============================================================================

const THEME = {
  bg: '#0c0a09',
  bgElevated: '#1c1917',
  bgGlass: 'rgba(28, 25, 23, 0.95)',
  accent: '#d4b08c',
  accentMuted: 'rgba(212, 176, 140, 0.15)',
  accentGlow: 'rgba(212, 176, 140, 0.3)',
  textPrimary: '#e7e5e4',
  textSecondary: '#a8a29e',
  textTertiary: '#78716c',
  border: 'rgba(212, 176, 140, 0.1)',
  borderStrong: 'rgba(212, 176, 140, 0.2)',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

// ============================================================================
// Types
// ============================================================================

export interface DependencyModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Plugin being installed */
  plugin: {
    id: string;
    name: string;
    version: string;
    description?: string;
    icon?: string;
  };
  /** Dependency resolution result */
  resolution: DependencyResolutionResult;
  /** Called when user confirms installation */
  onConfirm: (options: { installOptional: boolean; selectedDeps: string[] }) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Called when user wants to view dependency tree */
  onViewTree?: () => void;
  /** Currently installing state */
  isInstalling?: boolean;
  /** Installation progress (0-100) */
  progress?: number;
  /** Currently installing plugin name */
  installingPluginName?: string;
}

interface DependencyItemProps {
  node: DependencyTreeNode;
  depth: number;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusColor(status: DependencyTreeNode['status']): string {
  switch (status) {
    case 'installed':
      return THEME.success;
    case 'missing':
      return THEME.danger;
    case 'conflict':
      return THEME.warning;
    case 'optional':
      return THEME.info;
    default:
      return THEME.textTertiary;
  }
}

function formatVersionRange(range: string): string {
  if (range === '*') return 'any version';
  if (range.startsWith('^')) return `^${range.slice(1)}`;
  if (range.startsWith('~')) return `~${range.slice(1)}`;
  return range;
}

function collectAllDeps(node: DependencyTreeNode | null, result: DependencyTreeNode[] = []) {
  if (!node) return result;
  
  for (const child of node.children) {
    result.push(child);
    collectAllDeps(child, result);
  }
  
  return result;
}

// ============================================================================
// Dependency Item Component
// ============================================================================

function DependencyItem({
  node,
  depth,
  isSelected,
  onToggle,
  disabled,
}: DependencyItemProps) {
  const indent = depth * 20;
  const statusColor = getStatusColor(node.status);
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: `10px 16px 10px ${16 + indent}px`,
        borderBottom: `1px solid ${THEME.border}`,
        backgroundColor: isSelected ? 'rgba(212, 176, 140, 0.08)' : 'transparent',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {/* Checkbox */}
      <button
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: `2px solid ${isSelected ? THEME.accent : THEME.borderStrong}`,
          backgroundColor: isSelected ? THEME.accentMuted : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          flexShrink: 0,
        }}
      >
        {isSelected && <CheckCircle2 size={12} color={THEME.accent} />}
      </button>
      
      {/* Status Icon */}
      <div style={{ flexShrink: 0 }}>
        {node.status === 'installed' ? (
          <CheckCircle2 size={16} color={THEME.success} />
        ) : node.status === 'missing' ? (
          <AlertCircle size={16} color={THEME.danger} />
        ) : node.status === 'conflict' ? (
          <AlertCircle size={16} color={THEME.warning} />
        ) : (
          <Package size={16} color={THEME.info} />
        )}
      </div>
      
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: THEME.textPrimary,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {node.pluginId}
          {node.optional && (
            <span
              style={{
                fontSize: 10,
                padding: '1px 6px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: THEME.info,
                borderRadius: 4,
                fontWeight: 400,
              }}
            >
              optional
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: THEME.textTertiary, marginTop: 2 }}>
          {node.status === 'installed' ? (
            <span style={{ color: THEME.success }}>
              Installed (v{node.version})
            </span>
          ) : node.status === 'missing' ? (
            <span style={{ color: THEME.danger }}>
              Required {formatVersionRange(node.versionRange)}
            </span>
          ) : node.status === 'conflict' ? (
            <span style={{ color: THEME.warning }}>
              Conflict: installed v{node.version}, required {formatVersionRange(node.versionRange)}
            </span>
          ) : (
            <span style={{ color: THEME.info }}>
              Optional {formatVersionRange(node.versionRange)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DependencyModal({
  isOpen,
  plugin,
  resolution,
  onConfirm,
  onCancel,
  onViewTree,
  isInstalling = false,
  progress = 0,
  installingPluginName,
}: DependencyModalProps) {
  const [installOptional, setInstallOptional] = useState(false);
  const [expanded, setExpanded] = useState(true);
  
  // Collect all dependencies
  const allDeps = useMemo(() => {
    return collectAllDeps(resolution.tree);
  }, [resolution.tree]);
  
  // Filter dependencies to show
  const depsToShow = useMemo(() => {
    return allDeps.filter(d => !d.optional || installOptional);
  }, [allDeps, installOptional]);
  
  // Calculate which dependencies need to be installed
  const depsToInstall = useMemo(() => {
    return depsToShow.filter(d => d.status === 'missing');
  }, [depsToShow]);
  
  const installedCount = useMemo(() => {
    return depsToShow.filter(d => d.status === 'installed').length;
  }, [depsToShow]);
  
  const missingCount = depsToInstall.length;
  const conflictCount = useMemo(() => {
    return depsToShow.filter(d => d.status === 'conflict').length;
  }, [depsToShow]);
  
  // Track selected dependencies (default to all required)
  const [selectedDeps, setSelectedDeps] = useState<Set<string>>(() => {
    const required = allDeps.filter(d => !d.optional && d.status === 'missing');
    return new Set(required.map(d => d.pluginId));
  });
  
  const handleToggleDep = useCallback((pluginId: string) => {
    setSelectedDeps((prev) => {
      const next = new Set(prev);
      if (next.has(pluginId)) {
        next.delete(pluginId);
      } else {
        next.add(pluginId);
      }
      return next;
    });
  }, []);
  
  const handleConfirm = useCallback(() => {
    onConfirm({
      installOptional,
      selectedDeps: Array.from(selectedDeps),
    });
  }, [installOptional, selectedDeps, onConfirm]);
  
  const handleInstallAll = useCallback(() => {
    setSelectedDeps(new Set(depsToInstall.map(d => d.pluginId)));
    onConfirm({
      installOptional: true,
      selectedDeps: depsToInstall.map(d => d.pluginId),
    });
  }, [depsToInstall, onConfirm]);
  
  if (!isOpen) return null;
  
  const canInstall = selectedDeps.size > 0 || missingCount === 0;
  const allRequiredSelected = allDeps
    .filter(d => !d.optional && d.status === 'missing')
    .every(d => selectedDeps.has(d.pluginId));
  
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dependency-modal-title"
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          backgroundColor: THEME.bgGlass,
          border: `1px solid ${THEME.borderStrong}`,
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${THEME.border}`,
            backgroundColor: THEME.bgElevated,
          }}
        >
          <div>
            <h2
              id="dependency-modal-title"
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: THEME.textPrimary,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Download size={18} color={THEME.accent} />
              Install Dependencies
            </h2>
            <p style={{ fontSize: 12, color: THEME.textSecondary, margin: '4px 0 0' }}>
              {plugin.name} v{plugin.version} requires the following:
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={isInstalling}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: 'none',
              backgroundColor: 'transparent',
              color: THEME.textSecondary,
              cursor: isInstalling ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isInstalling ? 0.5 : 1,
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        
        {/* Summary Stats */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: '12px 20px',
            backgroundColor: 'rgba(212, 176, 140, 0.05)',
            borderBottom: `1px solid ${THEME.border}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={14} color={THEME.success} />
            <span style={{ fontSize: 12, color: THEME.textSecondary }}>
              {installedCount} installed
            </span>
          </div>
          {missingCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={14} color={THEME.danger} />
              <span style={{ fontSize: 12, color: THEME.textSecondary }}>
                {missingCount} to install
              </span>
            </div>
          )}
          {conflictCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={14} color={THEME.warning} />
              <span style={{ fontSize: 12, color: THEME.textSecondary }}>
                {conflictCount} conflicts
              </span>
            </div>
          )}
        </div>
        
        {/* Dependency List */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            maxHeight: 360,
          }}
        >
          {depsToShow.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: THEME.textSecondary,
              }}
            >
              <CheckCircle2 size={48} color={THEME.success} style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 14, margin: 0 }}>All dependencies are already installed!</p>
            </div>
          ) : (
            <div>
              {depsToShow.map((dep) => (
                <DependencyItem
                  key={dep.pluginId}
                  node={dep}
                  depth={0}
                  isSelected={selectedDeps.has(dep.pluginId) || dep.status === 'installed'}
                  onToggle={() => handleToggleDep(dep.pluginId)}
                  disabled={dep.status === 'installed' || isInstalling}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Optional Toggle */}
        {allDeps.some(d => d.optional) && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: `1px solid ${THEME.border}`,
              backgroundColor: THEME.bgElevated,
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: isInstalling ? 'not-allowed' : 'pointer',
                opacity: isInstalling ? 0.5 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={installOptional}
                onChange={(e) => setInstallOptional(e.target.checked)}
                disabled={isInstalling}
                style={{
                  width: 16,
                  height: 16,
                  accentColor: THEME.accent,
                }}
              />
              <span style={{ fontSize: 13, color: THEME.textSecondary }}>
                Also install optional dependencies
              </span>
            </label>
          </div>
        )}
        
        {/* Installation Progress */}
        {isInstalling && (
          <div
            style={{
              padding: '16px 20px',
              borderTop: `1px solid ${THEME.border}`,
              backgroundColor: THEME.bgElevated,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Loader2 size={16} color={THEME.accent} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13, color: THEME.textSecondary }}>
                Installing{installingPluginName ? ` ${installingPluginName}` : '...'}
              </span>
            </div>
            <div
              style={{
                height: 4,
                backgroundColor: THEME.border,
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  backgroundColor: THEME.accent,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderTop: `1px solid ${THEME.border}`,
            backgroundColor: THEME.bgElevated,
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            {onViewTree && (
              <button
                onClick={onViewTree}
                disabled={isInstalling}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: `1px solid ${THEME.border}`,
                  backgroundColor: 'transparent',
                  color: THEME.textSecondary,
                  fontSize: 13,
                  cursor: isInstalling ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: isInstalling ? 0.5 : 1,
                }}
              >
                <ListTree size={14} />
                View Tree
              </button>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onCancel}
              disabled={isInstalling}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: `1px solid ${THEME.border}`,
                backgroundColor: 'transparent',
                color: THEME.textSecondary,
                fontSize: 13,
                cursor: isInstalling ? 'not-allowed' : 'pointer',
                opacity: isInstalling ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            
            {missingCount > 0 ? (
              <button
                onClick={handleInstallAll}
                disabled={!canInstall || isInstalling}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: THEME.accent,
                  color: '#0c0a09',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: !canInstall || isInstalling ? 'not-allowed' : 'pointer',
                  opacity: !canInstall || isInstalling ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Download size={14} />
                Install All ({missingCount})
              </button>
            ) : (
              <button
                onClick={handleConfirm}
                disabled={isInstalling}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: THEME.success,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isInstalling ? 'not-allowed' : 'pointer',
                  opacity: isInstalling ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <CheckCircle2 size={14} />
                Continue
              </button>
            )}
          </div>
        </div>
        
        {/* Info Note */}
        {conflictCount > 0 && (
          <div
            style={{
              padding: '10px 20px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              borderTop: `1px solid rgba(245, 158, 11, 0.2)`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Info size={14} color={THEME.warning} />
            <span style={{ fontSize: 12, color: THEME.warning }}>
              Some dependencies have version conflicts. You may need to resolve these manually.
            </span>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default DependencyModal;
