/**
 * StarRating Component
 * 
 * A reusable star rating component that supports both display and interactive modes.
 * Supports half-star ratings, hover effects, and custom sizing.
 * Uses Allternit dark theme colors.
 */

import React, { useState, useCallback } from 'react';

// ============================================================================
// Theme (matching PluginManager)
// ============================================================================

const THEME = {
  accent: '#d4b08c',
  textTertiary: '#78716c',
  textSecondary: '#a8a29e',
  accentMuted: 'rgba(212, 176, 140, 0.15)',
};

// ============================================================================
// Types
// ============================================================================

export interface StarRatingProps {
  /** Current rating value (0-5, supports decimals like 3.5) */
  rating: number;
  /** Maximum number of stars (default: 5) */
  maxStars?: number;
  /** Whether the rating is interactive (clickable) */
  interactive?: boolean;
  /** Callback when rating changes (only called in interactive mode) */
  onChange?: (rating: number) => void;
  /** Size of stars in pixels (default: 20) */
  size?: number;
  /** Additional CSS class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Show rating number next to stars */
  showValue?: boolean;
  /** Number of users who rated (shown with value) */
  reviewCount?: number;
}

// ============================================================================
// Star Icon Component
// ============================================================================

interface StarIconProps {
  filled: number; // 0 = empty, 0.5 = half, 1 = full
  size: number;
  color: string;
  emptyColor: string;
  isHovered: boolean;
}

function StarIcon({ filled, size, color, emptyColor, isHovered }: StarIconProps) {
  // Generate unique ID for gradient
  const gradientId = `star-gradient-${Math.random().toString(36).substring(2, 9)}`;
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{
        flexShrink: 0,
        transition: 'transform 0.15s ease',
        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
      }}
    >
      <defs>
        <linearGradient id={gradientId}>
          <stop offset="0%" stopColor={color} />
          <stop offset={`${filled * 100}%`} stopColor={color} />
          <stop offset={`${filled * 100}%`} stopColor={emptyColor} />
          <stop offset="100%" stopColor={emptyColor} />
        </linearGradient>
      </defs>
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={`url(#${gradientId})`}
        stroke={filled > 0 ? color : emptyColor}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StarRating({
  rating,
  maxStars = 5,
  interactive = false,
  onChange,
  size = 20,
  className,
  style,
  showValue = false,
  reviewCount,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  
  // Clamp rating between 0 and maxStars
  const clampedRating = Math.max(0, Math.min(maxStars, rating));
  
  // Determine which rating to display (hover or actual)
  const displayRating = hoverRating !== null ? hoverRating : clampedRating;
  
  // Calculate filled amount for each star
  const getStarFilled = useCallback((starIndex: number): number => {
    const starValue = starIndex + 1;
    const value = displayRating;
    
    if (value >= starValue) return 1;
    if (value >= starValue - 0.5) return 0.5;
    return 0;
  }, [displayRating]);
  
  // Handle mouse enter on a star
  const handleMouseEnter = useCallback((starIndex: number) => {
    if (!interactive) return;
    setHoverRating(starIndex + 1);
  }, [interactive]);
  
  // Handle mouse leave the container
  const handleMouseLeave = useCallback(() => {
    if (!interactive) return;
    setHoverRating(null);
  }, [interactive]);
  
  // Handle click on a star
  const handleClick = useCallback((starIndex: number) => {
    if (!interactive || !onChange) return;
    onChange(starIndex + 1);
  }, [interactive, onChange]);
  
  // Format rating display
  const formatRating = (value: number): string => {
    if (value === Math.floor(value)) return value.toString();
    return value.toFixed(1);
  };
  
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        ...style,
      }}
      onMouseLeave={handleMouseLeave}
    >
      <div
        style={{
          display: 'flex',
          gap: 2,
          cursor: interactive ? 'pointer' : 'default',
        }}
      >
        {Array.from({ length: maxStars }, (_, index) => {
          const filled = getStarFilled(index);
          const isHovered = hoverRating !== null && index < hoverRating;
          
          return (
            <button
              key={index}
              type="button"
              onClick={() => handleClick(index)}
              onMouseEnter={() => handleMouseEnter(index)}
              disabled={!interactive}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                margin: 0,
                cursor: interactive ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label={interactive ? `Rate ${index + 1} stars` : undefined}
            >
              <StarIcon
                filled={filled}
                size={size}
                color={THEME.accent}
                emptyColor={THEME.textTertiary}
                isHovered={isHovered}
              />
            </button>
          );
        })}
      </div>
      
      {showValue && (
        <span
          style={{
            marginLeft: 8,
            fontSize: size * 0.7,
            color: THEME.textSecondary,
            fontWeight: 500,
          }}
        >
          {formatRating(clampedRating)}
          {reviewCount !== undefined && reviewCount > 0 && (
            <span style={{ color: THEME.textTertiary, marginLeft: 4 }}>
              ({reviewCount.toLocaleString()})
            </span>
          )}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Compact Star Rating (for list views)
// ============================================================================

export interface CompactStarRatingProps {
  rating: number;
  size?: number;
  style?: React.CSSProperties;
}

export function CompactStarRating({ rating, size = 14, style }: CompactStarRatingProps) {
  const filled = Math.round(rating);
  
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        ...style,
      }}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <svg
          key={index}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={index < filled ? THEME.accent : 'transparent'}
          style={{ flexShrink: 0 }}
        >
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            stroke={THEME.accent}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </div>
  );
}

// ============================================================================
// Rating Breakdown Bar
// ============================================================================

export interface RatingBarProps {
  starCount: number;
  count: number;
  total: number;
  size?: 'sm' | 'md';
}

export function RatingBar({ starCount, count, total, size = 'md' }: RatingBarProps) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  const height = size === 'sm' ? 4 : 6;
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
      }}
    >
      <span
        style={{
          fontSize: size === 'sm' ? 11 : 12,
          color: THEME.textSecondary,
          minWidth: 24,
          textAlign: 'right',
        }}
      >
        {starCount}★
      </span>
      <div
        style={{
          flex: 1,
          height,
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: height / 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            backgroundColor: THEME.accent,
            borderRadius: height / 2,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <span
        style={{
          fontSize: size === 'sm' ? 10 : 11,
          color: THEME.textTertiary,
          minWidth: 28,
        }}
      >
        {count}
      </span>
    </div>
  );
}

export default StarRating;
