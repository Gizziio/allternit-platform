/**
 * UpdateModal Component
 *
 * Full modal showing all available plugin updates with:
 * - List with checkboxes to select which to update
 * - "Update All" button
 * - Individual "Update" and "Skip" buttons per plugin
 * - Progress indicator during update
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Package,
  Download,
  SkipForward,
  Check,
  Loader2,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { UpdateInfo } from '../plugins/updateChecker';

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
};

// ============================================================================
// Types
// ============================================================================

export interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updates: UpdateInfo[];
  onUpdate: (update: UpdateInfo) => Promise<void>;
  onUpdateAll: (updates: UpdateInfo[]) => Promise<void>;
  onSkip: (update: UpdateInfo) => void;
  onCheckForUpdates: () => Promise<void>;
  isChecking?: boolean;
}

type UpdateStatus = 'pending' | 'updating' | 'completed' | 'error';

interface UpdateItemState {
  status: UpdateStatus;
  error?: string;
}

// ============================================================================
// Checkbox Component
// ============================================================================

function Checkbox({
  checked,
  onChange,
  indeterminate = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  indeterminate?: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        border: `1.5px solid ${checked || indeterminate ? THEME.accent : THEME.borderStrong}`,
        backgroundColor: checked || indeterminate ? THEME.accent : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {checked && (
        <Check size={12} color="#0c0a09" strokeWidth={3} />
      )}
      {indeterminate && (
        <div
          style={{
            width: 8,
            height: 2,
            backgroundColor: '#0c0a09',
            borderRadius: 1,
          }}
        />
      )}
    </button>
  );
}

// ============================================================================
// Update Item Component
// ============================================================================

function UpdateItem({
  update,
  isSelected,
  onSelect,
  onUpdate,
  onSkip,
  state,
}: {
  update: UpdateInfo;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onUpdate: () => void;
  onSkip: () => void;
  state: UpdateItemState;
}) {
  const isUpdating = state.status === 'updating';
  const isCompleted = state.status === 'completed';
  const hasError = state.status === 'error';

  return (
    <div
      style={{
        padding: 14,
        backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
        borderBottom: `1px solid ${THEME.border}`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        opacity: isCompleted ? 0.6 : 1,
        transition: 'background-color 0.15s',
      }}
    >
      {/* Checkbox */}
      {!isUpdating && !isCompleted && (
        <div style={{ paddingTop: 2 }}>
          <Checkbox checked={isSelected} onChange={onSelect} />
        </div>
      )}

      {/* Icon */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: hasError
            ? 'rgba(239, 68, 68, 0.1)'
            : isCompleted
            ? 'rgba(34, 197, 94, 0.1)'
            : THEME.accentMuted,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isUpdating ? (
          <Loader2 size={16} color={THEME.accent} style={{ animation: 'spin 1s linear infinite' }} />
        ) : isCompleted ? (
          <Check size={16} color={THEME.success} />
        ) : hasError ? (
          <AlertCircle size={16} color={THEME.danger} />
        ) : (
          <Package size={16} color={THEME.accent} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: THEME.textPrimary,
            }}
          >
            {update.pluginName}
          </span>
          {update.isRequired && (
            <span
              style={{
                padding: '2px 6px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                color: THEME.danger,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              Required
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: THEME.textSecondary,
            marginBottom: hasError ? 6 : 0,
          }}
        >
          <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>
            v{update.currentVersion}
          </span>
          <ChevronRight size={12} color={THEME.textTertiary} />
          <span style={{ color: THEME.success, fontWeight: 500 }}>
            v{update.latestVersion}
          </span>
          <span style={{ marginLeft: 8, color: THEME.textTertiary }}>
            via {update.source}
          </span>
        </div>

        {hasError && state.error && (
          <div
            style={{
              fontSize: 12,
              color: THEME.danger,
              marginTop: 4,
            }}
          >
            {state.error}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6 }}>
        {!isUpdating && !isCompleted && (
          <>
            <button
              onClick={onUpdate}
              style={{
                padding: '6px 12px',
                backgroundColor: THEME.accent,
                border: 'none',
                borderRadius: 6,
                color: THEME.bg,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'opacity 0.15s',
              }}
            >
              <Download size={12} />
              Update
            </button>
            <button
              onClick={onSkip}
              style={{
                padding: '6px',
                backgroundColor: 'transparent',
                border: `1px solid ${THEME.border}`,
                borderRadius: 6,
                color: THEME.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              title="Skip this update"
            >
              <SkipForward size={12} />
            </button>
          </>
        )}
        {isCompleted && (
          <span
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              color: THEME.success,
            }}
          >
            Updated
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Modal Component
// ============================================================================

export function UpdateModal({
  isOpen,
  onClose,
  updates,
  onUpdate,
  onUpdateAll,
  onSkip,
  onCheckForUpdates,
  isChecking = false,
}: UpdateModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [itemStates, setItemStates] = useState<Record<string, UpdateItemState>>({});
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);

  // Initialize all as selected
  React.useEffect(() => {
    if (isOpen && updates.length > 0) {
      setSelectedIds(new Set(updates.map((u) => u.pluginId)));
    }
  }, [isOpen, updates]);

  const allSelected = selectedIds.size === updates.length && updates.length > 0;
  const someSelected = selectedIds.size > 0 && selectedIds.size < updates.length;
  const hasSelection = selectedIds.size > 0;

  const completedCount = useMemo(
    () => Object.values(itemStates).filter((s) => s.status === 'completed').length,
    [itemStates]
  );

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(updates.map((u) => u.pluginId)));
    }
  };

  const handleToggleItem = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleUpdate = async (update: UpdateInfo) => {
    setItemStates((prev) => ({
      ...prev,
      [update.pluginId]: { status: 'updating' },
    }));

    try {
      await onUpdate(update);
      setItemStates((prev) => ({
        ...prev,
        [update.pluginId]: { status: 'completed' },
      }));
    } catch (error) {
      setItemStates((prev) => ({
        ...prev,
        [update.pluginId]: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Update failed',
        },
      }));
    }
  };

  const handleUpdateAll = async () => {
    const selectedUpdates = updates.filter((u) => selectedIds.has(u.pluginId));
    if (selectedUpdates.length === 0) return;

    setIsUpdatingAll(true);

    // Mark all as updating
    const updatingStates: Record<string, UpdateItemState> = {};
    selectedUpdates.forEach((u) => {
      updatingStates[u.pluginId] = { status: 'updating' };
    });
    setItemStates((prev) => ({ ...prev, ...updatingStates }));

    try {
      await onUpdateAll(selectedUpdates);

      // Mark all as completed
      const completedStates: Record<string, UpdateItemState> = {};
      selectedUpdates.forEach((u) => {
        completedStates[u.pluginId] = { status: 'completed' };
      });
      setItemStates((prev) => ({ ...prev, ...completedStates }));
    } catch (error) {
      // Mark all as error
      const errorStates: Record<string, UpdateItemState> = {};
      selectedUpdates.forEach((u) => {
        errorStates[u.pluginId] = {
          status: 'error',
          error: error instanceof Error ? error.message : 'Update failed',
        };
      });
      setItemStates((prev) => ({ ...prev, ...errorStates }));
    } finally {
      setIsUpdatingAll(false);
    }
  };

  const handleSkip = (update: UpdateInfo) => {
    onSkip(update);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(update.pluginId);
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 640,
          maxHeight: '90vh',
          backgroundColor: THEME.bgGlass,
          border: `1px solid ${THEME.borderStrong}`,
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 32px 64px rgba(0, 0, 0, 0.5)',
          animation: 'modalSlideIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${THEME.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: THEME.textPrimary,
                margin: '0 0 4px 0',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Package size={20} color={THEME.accent} />
              Plugin Updates
              {updates.length > 0 && (
                <span
                  style={{
                    padding: '2px 10px',
                    backgroundColor: THEME.accentMuted,
                    borderRadius: 12,
                    fontSize: 13,
                    color: THEME.accent,
                  }}
                >
                  {updates.length}
                </span>
              )}
            </h2>
            <p
              style={{
                fontSize: 13,
                color: THEME.textSecondary,
                margin: 0,
              }}
            >
              {completedCount > 0
                ? `${completedCount} of ${updates.length} updates completed`
                : 'Updates are available for your installed plugins'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => void onCheckForUpdates()}
              disabled={isChecking}
              style={{
                padding: '8px 12px',
                backgroundColor: 'transparent',
                border: `1px solid ${THEME.border}`,
                borderRadius: 8,
                color: THEME.textSecondary,
                fontSize: 12,
                cursor: isChecking ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: isChecking ? 0.6 : 1,
              }}
            >
              <RefreshCw
                size={14}
                style={{
                  animation: isChecking ? 'spin 1s linear infinite' : 'none',
                }}
              />
              Check
            </button>
            <button
              onClick={onClose}
              style={{
                padding: 8,
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 8,
                color: THEME.textTertiary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            minHeight: 200,
          }}
        >
          {updates.length === 0 ? (
            <div
              style={{
                padding: 48,
                textAlign: 'center',
                color: THEME.textSecondary,
              }}
            >
              <Package
                size={48}
                color={THEME.textTertiary}
                style={{ marginBottom: 16, opacity: 0.5 }}
              />
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
                All plugins are up to date
              </div>
              <div style={{ fontSize: 13, color: THEME.textTertiary }}>
                Check back later for new updates
              </div>
            </div>
          ) : (
            <>
              {/* Select All Header */}
              <div
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderBottom: `1px solid ${THEME.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Checkbox
                  checked={allSelected}
                  onChange={handleToggleAll}
                  indeterminate={someSelected}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: THEME.textSecondary,
                  }}
                >
                  {allSelected
                    ? 'Deselect all'
                    : someSelected
                    ? `${selectedIds.size} selected`
                    : 'Select all'}
                </span>
              </div>

              {/* Update List */}
              {updates.map((update) => (
                <UpdateItem
                  key={update.pluginId}
                  update={update}
                  isSelected={selectedIds.has(update.pluginId)}
                  onSelect={(selected) => handleToggleItem(update.pluginId, selected)}
                  onUpdate={() => void handleUpdate(update)}
                  onSkip={() => handleSkip(update)}
                  state={itemStates[update.pluginId] || { status: 'pending' }}
                />
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        {updates.length > 0 && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: `1px solid ${THEME.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: THEME.textSecondary,
              }}
            >
              {selectedIds.size > 0 ? (
                <>
                  <span style={{ fontWeight: 600, color: THEME.textPrimary }}>
                    {selectedIds.size}
                  </span>{' '}
                  update{selectedIds.size > 1 ? 's' : ''} selected
                </>
              ) : (
                'Select updates to install'
              )}
            </div>

            <button
              onClick={() => void handleUpdateAll()}
              disabled={!hasSelection || isUpdatingAll}
              style={{
                padding: '10px 20px',
                backgroundColor: hasSelection ? THEME.accent : THEME.border,
                border: 'none',
                borderRadius: 8,
                color: hasSelection ? THEME.bg : THEME.textTertiary,
                fontSize: 13,
                fontWeight: 600,
                cursor: hasSelection && !isUpdatingAll ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: isUpdatingAll ? 0.7 : 1,
              }}
            >
              {isUpdatingAll ? (
                <>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  Updating...
                </>
              ) : (
                <>
                  <Download size={14} />
                  Update {selectedIds.size > 0 ? `(${selectedIds.size})` : 'All'}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes modalSlideIn {
          from {
            transform: translateY(-20px) scale(0.98);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default UpdateModal;
