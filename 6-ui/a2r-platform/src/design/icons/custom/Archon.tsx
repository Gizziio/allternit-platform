/**
 * Archon Icon Component
 * 
 * Represents an Archon - governing authority component.
 */

import * as React from 'react';
import type { CustomIconProps } from './Logo';

/**
 * Archon icon - represents governing/authority components
 */
export const ArchonIcon = React.forwardRef<SVGSVGElement, CustomIconProps>(
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
        aria-label={props['aria-label'] || 'Archon'}
        aria-hidden={props['aria-hidden']}
        role="img"
      >
        {/* Crown base */}
        <path
          d="M6 24H26"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Crown points */}
        <path
          d="M6 24L8 14L12 18L16 8L20 18L24 14L26 24"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Crown jewels */}
        <circle cx="16" cy="8" r="2" fill="currentColor" />
        <circle cx="8" cy="14" r="1.5" fill="currentColor" fillOpacity="0.7" />
        <circle cx="24" cy="14" r="1.5" fill="currentColor" fillOpacity="0.7" />
        <circle cx="12" cy="18" r="1.5" fill="currentColor" fillOpacity="0.7" />
        <circle cx="20" cy="18" r="1.5" fill="currentColor" fillOpacity="0.7" />
        {/* Authority rays */}
        <line
          x1="16"
          y1="4"
          x2="16"
          y2="2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.6"
        />
        <line
          x1="22"
          y1="5"
          x2="23"
          y2="3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.6"
        />
        <line
          x1="10"
          y1="5"
          x2="9"
          y2="3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.6"
        />
        {/* Scale representation */}
        <path
          d="M12 28H20"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.5"
        />
        <circle cx="16" cy="28" r="1" fill="currentColor" fillOpacity="0.5" />
      </svg>
    );
  }
);

ArchonIcon.displayName = 'ArchonIcon';
