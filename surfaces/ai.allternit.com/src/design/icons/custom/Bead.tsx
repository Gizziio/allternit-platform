/**
 * Bead Icon Component
 * 
 * Represents a Bead - atomic data/state unit.
 */

import * as React from 'react';
import type { CustomIconProps } from './Logo';

/**
 * Bead icon - represents atomic data/state units
 */
export const BeadIcon = React.forwardRef<SVGSVGElement, CustomIconProps>(
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
        aria-label={props['aria-label'] || 'Bead'}
        aria-hidden={props['aria-hidden']}
        role="img"
      >
        {/* Outer circle - bead boundary */}
        <circle
          cx="16"
          cy="16"
          r="12"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        {/* Inner circle - core */}
        <circle
          cx="16"
          cy="16"
          r="5"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        {/* Orbital rings */}
        <ellipse
          cx="16"
          cy="16"
          rx="8"
          ry="3"
          stroke="currentColor"
          strokeWidth="1"
          strokeOpacity="0.4"
          fill="none"
          transform="rotate(45 16 16)"
        />
        <ellipse
          cx="16"
          cy="16"
          rx="8"
          ry="3"
          stroke="currentColor"
          strokeWidth="1"
          strokeOpacity="0.4"
          fill="none"
          transform="rotate(-45 16 16)"
        />
        {/* Center dot */}
        <circle cx="16" cy="16" r="2" fill="currentColor" />
        {/* Data flow indicators */}
        <circle cx="24" cy="12" r="1" fill="currentColor" fillOpacity="0.6" />
        <circle cx="8" cy="20" r="1" fill="currentColor" fillOpacity="0.6" />
      </svg>
    );
  }
);

BeadIcon.displayName = 'BeadIcon';
