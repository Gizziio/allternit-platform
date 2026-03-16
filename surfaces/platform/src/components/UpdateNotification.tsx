/**
 * UpdateNotification Component
 *
 * Toast/notification banner for displaying available plugin updates.
 * Supports stacked notifications for multiple updates.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Download, Clock, Package, ChevronRight } from 'lucide-react';
import type { UpdateInfo } from '../plugins/updateChecker';

// ============================================================================
// Theme
// ============================================================================

const THEME = {
  bg: '#0c0a09',
  bgElevated: '#1c1917',
  accent: '#d4b08c',
  accentMuted: 'rgba(212, 176, 140, 0.15)',
  textPrimary: '#e7e5e4',
  textSecondary: '#a8a29e',
  textTertiary: '#78716c',
  border: 'rgba(212, 176, 140, 0.1)',
  borderStrong: 'rgba(212, 176, 140, 0.2)',
  success: '#22c55e',
  warning: '#f59e0b',
};

// ============================================================================
// Types
// ============================================================================

export interface UpdateNotificationProps {
  updates: UpdateInfo[];
  onUpdate: (update: UpdateInfo) => void;
  onDismiss: (update: UpdateInfo) => void;
  onLater: (update: UpdateInfo) => void;
  onShowAll?: () => void;
  maxVisible?: number;
}

interface SingleNotificationProps {
  update: UpdateInfo;
  index: number;
  total: number;
  onUpdate: () => void;
  onDismiss: () => void;
  onLater: () => void;
}

// ============================================================================
// Single Notification Component
// ============================================================================

function SingleNotification({
  update,
  index,
  total,
  onUpdate,
  onDismiss,
  onLater,
}: SingleNotificationProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  const handleLater = useCallback(() => {
    setIsExiting(true);
    setTimeout(onLater, 300);
  }, [onLater]);

  const handleUpdate = useCallback(() => {
    setIsExiting(true);
    setTimeout(onUpdate, 300);
  }, [onUpdate]);

  // Truncate release notes for preview
  const releaseNotesPreview = update.releaseNotes
    ? update.releaseNotes.slice(0, 120) + (update.releaseNotes.length > 120 ? '...' : '')
    : null;

  return (
    <div
      style={{
        position: 'relative',
        transform: isExiting 
          ? 'translateX(100%) scale(0.95)' 
          : `translateY(${index * -8}px) scale(${1 - index * 0.02})`,
        opacity: isExiting ? 0 : 1 - index * 0.15,
        zIndex: total - index,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        marginBottom: index === 0 ? 0 : -60,
      }}
    >
      <div
        style={{
          width: 380,
          backgroundColor: THEME.bgElevated,
          border: `1px solid ${THEME.borderStrong}`,
          borderRadius: 12,
          padding: 16,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: THEME.accentMuted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Package size={20} color={THEME.accent} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: THEME.textPrimary,
                marginBottom: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {update.pluginName}
            </div>
            <div
              style={{
                fontSize: 12,
                color: THEME.textSecondary,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>
                v{update.currentVersion}
              </span>
              <ChevronRight size={12} color={THEME.textTertiary} />
              <span style={{ color: THEME.success, fontWeight: 500 }}>
                v{update.latestVersion}
              </span>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: THEME.textTertiary,
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s',
            }}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>

        {/* Release Notes Preview */}
        {releaseNotesPreview && (
          <div
            style={{
              marginBottom: 12,
              padding: 10,
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 8,
              fontSize: 12,
              color: THEME.textSecondary,
              lineHeight: 1.5,
              maxHeight: isExpanded ? 200 : 60,
              overflow: 'hidden',
              cursor: releaseNotesPreview.length >= 120 ? 'pointer' : 'default',
              transition: 'max-height 0.2s ease-out',
            }}
            onClick={() => releaseNotesPreview.length >= 120 && setIsExpanded(!isExpanded)}
          >
            {releaseNotesPreview}
            {releaseNotesPreview.length >= 120 && !isExpanded && (
              <span style={{ color: THEME.accent }}> Show more</span>
            )}
          </div>
        )}

        {/* Required badge */}
        {update.isRequired && (
          <div
            style={{
              marginBottom: 12,
              padding: '6px 10px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 6,
              fontSize: 11,
              color: '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontWeight: 600 }}>Required Update</span>
            <span style={{ opacity: 0.7 }}>— This update contains security fixes</span>
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: 8,
          }}
        >
          <button
            onClick={handleUpdate}
            style={{
              flex: 1,
              padding: '10px 14px',
              backgroundColor: THEME.accent,
              border: 'none',
              borderRadius: 8,
              color: THEME.bg,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'opacity 0.15s',
            }}
          >
            <Download size={14} />
            Update Now
          </button>

          <button
            onClick={handleLater}
            style={{
              padding: '10px 14px',
              backgroundColor: 'transparent',
              border: `1px solid ${THEME.border}`,
              borderRadius: 8,
              color: THEME.textSecondary,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s',
            }}
          >
            <Clock size={14} />
            Later
          </button>
        </div>

        {/* Source indicator */}
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${THEME.border}`,
            fontSize: 11,
            color: THEME.textTertiary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Source: {update.source}</span>
          <span>{new Date(update.checkedAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Stacked Notifications Container
// ============================================================================

export function UpdateNotification({
  updates,
  onUpdate,
  onDismiss,
  onLater,
  onShowAll,
  maxVisible = 3,
}: UpdateNotificationProps) {
  const [visibleUpdates, setVisibleUpdates] = useState<UpdateInfo[]>([]);
  const [hiddenCount, setHiddenCount] = useState(0);

  useEffect(() => {
    // Sort by required first, then by date
    const sorted = [...updates].sort((a, b) => {
      if (a.isRequired && !b.isRequired) return -1;
      if (!a.isRequired && b.isRequired) return 1;
      return new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime();
    });

    setVisibleUpdates(sorted.slice(0, maxVisible));
    setHiddenCount(Math.max(0, sorted.length - maxVisible));
  }, [updates, maxVisible]);

  const handleDismiss = useCallback(
    (update: UpdateInfo) => {
      onDismiss(update);
    },
    [onDismiss]
  );

  const handleLater = useCallback(
    (update: UpdateInfo) => {
      onLater(update);
    },
    [onLater]
  );

  const handleUpdate = useCallback(
    (update: UpdateInfo) => {
      onUpdate(update);
    },
    [onUpdate]
  );

  if (visibleUpdates.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 12,
        pointerEvents: 'none',
      }}
    >
      {visibleUpdates.map((update, index) => (
        <div key={update.pluginId} style={{ pointerEvents: 'auto' }}>
          <SingleNotification
            update={update}
            index={index}
            total={visibleUpdates.length}
            onUpdate={() => handleUpdate(update)}
            onDismiss={() => handleDismiss(update)}
            onLater={() => handleLater(update)}
          />
        </div>
      ))}

      {/* Show "more updates" indicator */}
      {hiddenCount > 0 && onShowAll && (
        <button
          onClick={onShowAll}
          style={{
            pointerEvents: 'auto',
            padding: '8px 16px',
            backgroundColor: THEME.bgElevated,
            border: `1px solid ${THEME.borderStrong}`,
            borderRadius: 20,
            color: THEME.accent,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.15s',
          }}
        >
          <Package size={14} />
          +{hiddenCount} more update{hiddenCount > 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Compact Notification (for minimal display)
// ============================================================================

export interface CompactUpdateNotificationProps {
  count: number;
  onClick: () => void;
}

export function CompactUpdateNotification({ count, onClick }: CompactUpdateNotificationProps) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 1000,
        padding: '12px 16px',
        backgroundColor: THEME.bgElevated,
        border: `1px solid ${THEME.borderStrong}`,
        borderRadius: 10,
        color: THEME.textPrimary,
        fontSize: 13,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        animation: 'slideInRight 0.3s ease-out',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: THEME.accentMuted,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Package size={16} color={THEME.accent} />
      </div>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontWeight: 600 }}>{count} update{count > 1 ? 's' : ''} available</div>
        <div style={{ fontSize: 12, color: THEME.textSecondary }}>Click to view</div>
      </div>
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </button>
  );
}

export default UpdateNotification;
