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
  DownloadSimple,
  SkipForward,
  Check,
  CircleNotch,
  CaretRight,
  ArrowsClockwise,
  Warning,
} from '@phosphor-icons/react';
import type { UpdateInfo } from '../plugins/updateChecker';

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
    <button type="button"
      onClick={() => onChange(!checked)}
      className={`
        w-[18px] h-[18px] rounded-[4px] border-[1.5px] border-solid
        flex items-center justify-center cursor-pointer transition-all duration-150
        ${checked || indeterminate ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]' : 'bg-transparent border-[rgba(212,176,140,0.2)]'}
      `}
    >
      {checked && (
        <Check size={12} color="#0c0a09" strokeWidth={3} />
      )}
      {indeterminate && (
        <div
          className="w-2 h-[2px] bg-[var(--surface-canvas)] rounded-[1px]"
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
      className={`
        p-[14px] border-b border-solid border-[rgba(212,176,140,0.1)] flex items-start gap-3 transition-colors duration-150
        ${isSelected ? 'bg-[rgba(255,255,255,0.03)]' : 'bg-transparent'}
        ${isCompleted ? 'opacity-60' : 'opacity-100'}
      `}
    >
      {/* Checkbox */}
      {!isUpdating && !isCompleted && (
        <div className="pt-[2px]">
          <Checkbox checked={isSelected} onChange={onSelect} />
        </div>
      )}

      {/* Icon */}
      <div
        className={`
          w-9 h-9 rounded-[8px] flex items-center justify-center flex-shrink-0
          ${hasError ? 'bg-[rgba(239,68,68,0.1)]' : isCompleted ? 'bg-[rgba(34,197,94,0.1)]' : 'bg-[rgba(212,176,140,0.15)]'}
        `}
      >
        {isUpdating ? (
          <CircleNotch size={16} className="text-[var(--accent-primary)] animate-spin" />
        ) : isCompleted ? (
          <Check size={16} className="text-[var(--status-success)]" />
        ) : hasError ? (
          <Warning size={16} className="text-[var(--status-error)]" />
        ) : (
          <Package size={16} className="text-[var(--accent-primary)]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[14px] font-semibold text-[var(--ui-text-primary)]">
            {update.pluginName}
          </span>
          {update.isRequired && (
            <span className="px-1.5 py-0.5 bg-[rgba(239,68,68,0.15)] rounded-[4px] text-[12px] font-semibold text-[var(--status-error)] uppercase tracking-wider">
              Required
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[12px] text-[var(--ui-text-secondary)] mb-0">
          <span className="line-through opacity-60">
            v{update.currentVersion}
          </span>
          <CaretRight size={12} className="text-[var(--ui-text-muted)]" />
          <span className="text-[var(--status-success)] font-medium">
            v{update.latestVersion}
          </span>
          <span className="ml-2 text-[var(--ui-text-muted)]">
            via {update.source}
          </span>
        </div>

        {hasError && state.error && (
          <div className="text-[12px] text-[var(--status-error)] mt-1">
            {state.error}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        {!isUpdating && !isCompleted && (
          <>
            <button type="button"
              onClick={onUpdate}
              className="px-3 py-1.5 bg-[var(--accent-primary)] border-none rounded-[6px] text-[var(--surface-canvas)] text-[12px] font-semibold cursor-pointer flex items-center gap-1 transition-opacity duration-150 hover:opacity-90"
            >
              <DownloadSimple size={12} />
              Update
            </button>
            <button type="button"
              onClick={onSkip}
              className="p-1.5 bg-transparent border border-solid border-[rgba(212,176,140,0.1)] rounded-[6px] text-[var(--ui-text-secondary)] cursor-pointer flex items-center justify-center transition-all duration-150 hover:bg-[rgba(212,176,140,0.05)]"
              title="Skip this update"
            >
              <SkipForward size={12} />
            </button>
          </>
        )}
        {isCompleted && (
          <span className="px-3 py-1.5 text-[12px] font-medium text-[var(--status-success)]">
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

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    setSelectedIds(new Set(updates.map((u) => u.pluginId)));
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

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
    <div role="button" tabIndex={0}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div role="button" tabIndex={0}
        className="w-full max-w-[640px] max-h-[90vh] bg-[rgba(28,25,23,0.95)] border border-solid border-[rgba(212,176,140,0.2)] rounded-[16px] flex flex-col shadow-[0_32px_64px_rgba(0,0,0,0.5)] animate-[modalSlideIn_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-solid border-[rgba(212,176,140,0.1)] flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--ui-text-primary)] m-0 mb-1 flex items-center gap-[10px]">
              <Package size={20} color="var(--accent-primary)" />
              Plugin Updates
              {updates.length > 0 && (
                <span className="px-2.5 py-0.5 bg-[rgba(212,176,140,0.15)] rounded-[12px] text-[13px] text-[var(--accent-primary)]">
                  {updates.length}
                </span>
              )}
            </h2>
            <p className="text-[13px] text-[var(--ui-text-secondary)] m-0">
              {completedCount > 0
                ? `${completedCount} of ${updates.length} updates completed`
                : 'Updates are available for your installed plugins'}
            </p>
          </div>

          <div className="flex gap-2">
            <button type="button"
              onClick={() => void onCheckForUpdates()}
              disabled={isChecking}
              className={`
                px-3 py-2 bg-transparent border border-solid border-[rgba(212,176,140,0.1)] rounded-[8px]
                text-[var(--ui-text-secondary)] text-[12px] flex items-center gap-1.5
                ${isChecking ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
              `}
            >
              <ArrowsClockwise
                size={14}
                className={isChecking ? 'animate-spin' : ''}
              />
              Check
            </button>
            <button type="button"
              onClick={onClose}
              className="p-2 bg-transparent border-none rounded-[8px] text-[var(--ui-text-muted)] cursor-pointer flex items-center justify-center transition-colors duration-150 hover:text-[var(--ui-text-primary)]"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto min-h-[200px]">
          {updates.length === 0 ? (
            <div className="p-12 text-center text-[var(--ui-text-secondary)]">
              <Package
                size={48}
                className="mx-auto mb-4 opacity-50 text-[var(--ui-text-muted)]"
              />
              <div className="text-[16px] font-medium mb-2">
                All plugins are up to date
              </div>
              <div className="text-[13px] text-[var(--ui-text-muted)]">
                Check back later for new updates
              </div>
            </div>
          ) : (
            <>
              {/* Select All Header */}
              <div className="px-6 py-3 bg-[rgba(255,255,255,0.02)] border-b border-solid border-[rgba(212,176,140,0.1)] flex items-center gap-3">
                <Checkbox
                  checked={allSelected}
                  onChange={handleToggleAll}
                  indeterminate={someSelected}
                />
                <span className="text-[13px] font-medium text-[var(--ui-text-secondary)]">
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
          <div className="px-6 py-4 border-t border-solid border-[rgba(212,176,140,0.1)] flex items-center justify-between">
            <div className="text-[13px] text-[var(--ui-text-secondary)]">
              {selectedIds.size > 0 ? (
                <>
                  <span className="font-semibold text-[var(--ui-text-primary)]">
                    {selectedIds.size}
                  </span>{' '}
                  update{selectedIds.size > 1 ? 's' : ''} selected
                </>
              ) : (
                'Select updates to install'
              )}
            </div>

            <button type="button"
              onClick={() => void handleUpdateAll()}
              disabled={!hasSelection || isUpdatingAll}
              className={`
                px-5 py-2.5 rounded-[8px] text-[13px] font-semibold flex items-center gap-2 transition-opacity duration-150
                ${hasSelection ? 'bg-[var(--accent-primary)] text-[var(--surface-canvas)] cursor-pointer' : 'bg-[rgba(212,176,140,0.1)] text-[var(--ui-text-muted)] cursor-not-allowed'}
                ${isUpdatingAll ? 'opacity-70' : 'opacity-100'}
              `}
            >
              {isUpdatingAll ? (
                <>
                  <CircleNotch size={14} className="animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <DownloadSimple size={14} />
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
