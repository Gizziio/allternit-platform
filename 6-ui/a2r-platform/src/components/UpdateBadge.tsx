/**
 * UpdateBadge Component
 *
 * Small badge showing update count with pulse animation when new updates are available.
 */

import React, { useState, useEffect } from 'react';
import { Package } from 'lucide-react';

// ============================================================================
// Theme
// ============================================================================

const THEME = {
  accent: '#d4b08c',
  accentMuted: 'rgba(212, 176, 140, 0.15)',
  accentGlow: 'rgba(212, 176, 140, 0.4)',
  textPrimary: '#e7e5e4',
  danger: '#ef4444',
  dangerMuted: 'rgba(239, 68, 68, 0.15)',
  success: '#22c55e',
};

// ============================================================================
// Types
// ============================================================================

export interface UpdateBadgeProps {
  count: number;
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  variant?: 'default' | 'subtle' | 'dot';
}

// ============================================================================
// Size Configurations
// ============================================================================

const SIZE_CONFIG = {
  sm: {
    badge: 18,
    fontSize: 10,
    icon: 12,
    button: 28,
  },
  md: {
    badge: 20,
    fontSize: 11,
    icon: 14,
    button: 32,
  },
  lg: {
    badge: 24,
    fontSize: 12,
    icon: 16,
    button: 38,
  },
};

// ============================================================================
// Main Component
// ============================================================================

export function UpdateBadge({
  count,
  onClick,
  size = 'md',
  pulse = true,
  variant = 'default',
}: UpdateBadgeProps) {
  const [isPulsing, setIsPulsing] = useState(false);
  const [prevCount, setPrevCount] = useState(count);

  // Trigger pulse animation when count increases
  useEffect(() => {
    if (count > prevCount && pulse) {
      setIsPulsing(true);
      const timeout = setTimeout(() => setIsPulsing(false), 2000);
      return () => clearTimeout(timeout);
    }
    setPrevCount(count);
  }, [count, prevCount, pulse]);

  if (count === 0 && variant !== 'dot') return null;

  const config = SIZE_CONFIG[size];

  // Dot variant - just a small indicator dot
  if (variant === 'dot') {
    return (
      <button
        onClick={onClick}
        style={{
          position: 'relative',
          width: config.button,
          height: config.button,
          borderRadius: 8,
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label={`${count} updates available`}
      >
        <Package size={config.icon} color={THEME.textPrimary} />
        {count > 0 && (
          <>
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: THEME.accent,
                border: '2px solid #0c0a09',
              }}
            />
            {isPulsing && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: THEME.accent,
                  opacity: 0,
                  animation: 'badgePulse 2s ease-out',
                }}
              />
            )}
          </>
        )}
        <style>{`
          @keyframes badgePulse {
            0% {
              transform: scale(1);
              opacity: 0.6;
            }
            50% {
              transform: scale(2);
              opacity: 0.3;
            }
            100% {
              transform: scale(3);
              opacity: 0;
            }
          }
        `}</style>
      </button>
    );
  }

  // Subtle variant - minimal badge
  if (variant === 'subtle') {
    return (
      <button
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          backgroundColor: THEME.accentMuted,
          border: 'none',
          borderRadius: 12,
          cursor: 'pointer',
          transition: 'background-color 0.15s',
        }}
        aria-label={`${count} updates available`}
      >
        <Package size={config.icon} color={THEME.accent} />
        <span
          style={{
            fontSize: config.fontSize,
            fontWeight: 600,
            color: THEME.accent,
          }}
        >
          {count}
        </span>
      </button>
    );
  }

  // Default variant - full badge with animation
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        backgroundColor: isPulsing ? THEME.accentMuted : 'rgba(255, 255, 255, 0.05)',
        border: `1px solid ${isPulsing ? THEME.accent : 'rgba(212, 176, 140, 0.1)'}`,
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'all 0.15s ease-out',
        animation: isPulsing ? 'badgeAttention 0.5s ease-out' : 'none',
      }}
      aria-label={`${count} plugin update${count > 1 ? 's' : ''} available`}
    >
      {/* Icon */}
      <Package size={config.icon} color={THEME.accent} />

      {/* Count badge */}
      <span
        style={{
          fontSize: config.fontSize,
          fontWeight: 600,
          color: THEME.textPrimary,
        }}
      >
        {count}
      </span>

      {/* Label */}
      <span
        style={{
          fontSize: config.fontSize,
          color: THEME.textPrimary,
        }}
      >
        update{count > 1 ? 's' : ''}
      </span>

      {/* Pulse ring animation */}
      {isPulsing && (
        <span
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: 10,
            border: `2px solid ${THEME.accent}`,
            opacity: 0,
            animation: 'badgeRing 2s ease-out',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Glow effect */}
      {isPulsing && (
        <span
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: 12,
            background: `radial-gradient(circle, ${THEME.accentGlow} 0%, transparent 70%)`,
            opacity: 0,
            animation: 'badgeGlow 1s ease-out',
            pointerEvents: 'none',
          }}
        />
      )}

      <style>{`
        @keyframes badgeRing {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(1.2);
            opacity: 0;
          }
        }

        @keyframes badgeGlow {
          0%, 100% {
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes badgeAttention {
          0%, 100% {
            transform: scale(1);
          }
          25% {
            transform: scale(1.05);
          }
          50% {
            transform: scale(0.98);
          }
          75% {
            transform: scale(1.02);
          }
        }
      `}</style>
    </button>
  );
}

// ============================================================================
// Inline Badge (for use in text/buttons)
// ============================================================================

export interface InlineUpdateBadgeProps {
  count: number;
}

export function InlineUpdateBadge({ count }: InlineUpdateBadgeProps) {
  if (count === 0) return null;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        backgroundColor: THEME.accent,
        borderRadius: 9,
        fontSize: 11,
        fontWeight: 700,
        color: '#0c0a09',
        marginLeft: 6,
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ============================================================================
// Notification Dot (for minimal indication)
// ============================================================================

export interface NotificationDotProps {
  hasUpdate: boolean;
  color?: 'accent' | 'danger' | 'success';
}

export function NotificationDot({ 
  hasUpdate, 
  color = 'accent' 
}: NotificationDotProps) {
  if (!hasUpdate) return null;

  const colorMap = {
    accent: THEME.accent,
    danger: THEME.danger,
    success: THEME.success,
  };

  const selectedColor = colorMap[color];

  return (
    <span
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: selectedColor,
        border: '2px solid #0c0a09',
        boxShadow: `0 0 8px ${selectedColor}`,
        animation: 'dotPulse 2s ease-in-out infinite',
      }}
    >
      <style>{`
        @keyframes dotPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.8;
          }
        }
      `}</style>
    </span>
  );
}

export default UpdateBadge;
