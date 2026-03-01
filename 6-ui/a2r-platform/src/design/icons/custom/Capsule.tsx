/**
 * Capsule Icon Component
 * 
 * Represents a Capsule - self-contained functional unit.
 */

import * as React from 'react';
import type { CustomIconProps } from './Logo';

/**
 * Capsule icon - represents self-contained functional units
 */
export const CapsuleIcon = React.forwardRef<SVGSVGElement, CustomIconProps>(
  ({ size = 32, className, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label={props['aria-label'] || 'Capsule'}
        aria-hidden={props['aria-hidden']}
        role="img"
      >
        {/* Capsule outer shape - pill/rounded rectangle */}
        <rect
          x="6"
          y="4"
          width="20"
          height="24"
          rx="10"
          ry="10"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        {/* Middle divider */}
        <line
          x1="6"
          y1="16"
          x2="26"
          y2="16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Top half highlight */}
        <path
          d="M10 12H14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.6"
        />
        {/* Bottom half content indicator */}
        <circle cx="16" cy="20" r="2" fill="currentColor" fillOpacity="0.5" />
        {/* Connection points */}
        <circle cx="16" cy="4" r="1.5" fill="currentColor" />
        <circle cx="16" cy="28" r="1.5" fill="currentColor" />
      </svg>
    );
  }
);

CapsuleIcon.displayName = 'CapsuleIcon';
