/**
 * @fileoverview Progress Bar Component
 * 
 * Reusable progress bar component with various sizes and colors.
 * Used throughout the onboarding wizard for showing progress.
 * 
 * @module components/onboarding/components/ProgressBar
 */

import React from 'react';
import { motion } from 'framer-motion';

/**
 * Progress bar size types
 */
export type ProgressBarSize = 'sm' | 'md' | 'lg';

/**
 * Progress bar color types
 */
export type ProgressBarColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple';

/**
 * Props for the ProgressBar component
 */
export interface ProgressBarProps {
  /** Current value (0 to max) */
  value: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Size of the progress bar */
  size?: ProgressBarSize;
  /** Color of the progress bar */
  color?: ProgressBarColor;
  /** Whether to show a striped animation */
  animated?: boolean;
  /** Whether to show percentage label */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Progress bar component
 * 
 * Displays progress with smooth animations and customizable
 * appearance. Used for showing download progress, setup progress,
 * and overall wizard progress.
 * 
 * @example
 * ```tsx
 * <ProgressBar value={50} max={100} size="lg" color="blue" />
 * ```
 */
export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  color = 'blue',
  animated = false,
  showLabel = false,
  className = '',
}: ProgressBarProps): JSX.Element {
  // Calculate percentage
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  // Size styles
  const sizeStyles: Record<ProgressBarSize, string> = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  // Color styles
  const colorStyles: Record<ProgressBarColor, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className={`relative ${className}`}>
      {/* Background track */}
      <div className={`w-full ${sizeStyles[size]} bg-gray-700/50 rounded-full overflow-hidden`}>
        {/* Progress fill */}
        <motion.div
          className={`h-full ${colorStyles[color]} rounded-full ${
            animated ? 'bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:200%_100%]' : ''
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Label */}
      {showLabel && (
        <span className="text-xs text-gray-400 mt-1 block text-right">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
}

/**
 * Multi-segment progress bar for showing parallel progress
 */
export interface MultiProgressBarProps {
  /** Segments with their values */
  segments: Array<{
    value: number;
    color: ProgressBarColor;
  }>;
  /** Maximum value for each segment */
  max?: number;
  /** Size of the progress bar */
  size?: ProgressBarSize;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Multi-segment progress bar
 * 
 * Shows multiple progress segments in a single bar, useful for
 * displaying parallel download progress.
 * 
 * @example
 * ```tsx
 * <MultiProgressBar
 *   segments={[
 *     { value: 50, color: 'blue' },
 *     { value: 75, color: 'green' },
 *   ]}
 * />
 * ```
 */
export function MultiProgressBar({
  segments,
  max = 100,
  size = 'md',
  className = '',
}: MultiProgressBarProps): JSX.Element {
  const sizeStyles: Record<ProgressBarSize, string> = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const colorStyles: Record<ProgressBarColor, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className={`flex w-full ${sizeStyles[size]} rounded-full overflow-hidden ${className}`}>
      {segments.map((segment, index) => {
        const percentage = Math.min(100, Math.max(0, (segment.value / max) * 100));
        return (
          <motion.div
            key={index}
            className={`h-full ${colorStyles[segment.color]} ${
              index < segments.length - 1 ? 'border-r border-gray-900' : ''
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${percentage / segments.length}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}

/**
 * Circular progress indicator
 */
export interface CircularProgressProps {
  /** Current value (0 to max) */
  value: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Size in pixels */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Color of the progress */
  color?: ProgressBarColor;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Circular progress indicator
 * 
 * Shows progress in a circular format, useful for compact
 * progress displays.
 * 
 * @example
 * ```tsx
 * <CircularProgress value={75} size={60} strokeWidth={4} />
 * ```
 */
export function CircularProgress({
  value,
  max = 100,
  size = 60,
  strokeWidth = 4,
  color = 'blue',
  className = '',
}: CircularProgressProps): JSX.Element {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const colorStyles: Record<ProgressBarColor, string> = {
    blue: 'stroke-blue-500',
    green: 'stroke-green-500',
    yellow: 'stroke-yellow-500',
    red: 'stroke-red-500',
    purple: 'stroke-purple-500',
  };

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-700"
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={colorStyles[color]}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </svg>
      {/* Percentage label */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-medium text-white">{Math.round(percentage)}%</span>
      </div>
    </div>
  );
}
