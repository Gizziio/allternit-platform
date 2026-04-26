/**
 * Shell Icon Component
 * 
 * Represents the allternit Shell - the main container/workspace.
 */

import * as React from 'react';
import type { CustomIconProps } from './Logo';

/**
 * Shell icon - represents the main application container/workspace
 */
export const ShellIcon = React.forwardRef<SVGSVGElement, CustomIconProps>(
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
        aria-label={props['aria-label'] || 'Shell'}
        aria-hidden={props['aria-hidden']}
        role="img"
      >
        {/* Outer rounded rectangle - shell container */}
        <rect
          x="3"
          y="3"
          width="26"
          height="26"
          rx="6"
          ry="6"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        {/* Top bar - window chrome */}
        <line
          x1="3"
          y1="10"
          x2="29"
          y2="10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Window control dots */}
        <circle cx="7" cy="6.5" r="1.5" fill="currentColor" fillOpacity="0.5" />
        <circle cx="11" cy="6.5" r="1.5" fill="currentColor" fillOpacity="0.5" />
        <circle cx="15" cy="6.5" r="1.5" fill="currentColor" fillOpacity="0.5" />
        {/* Content area lines */}
        <line
          x1="7"
          y1="15"
          x2="25"
          y2="15"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.6"
        />
        <line
          x1="7"
          y1="20"
          x2="20"
          y2="20"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.4"
        />
        <line
          x1="7"
          y1="25"
          x2="16"
          y2="25"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.3"
        />
        {/* Active indicator in corner */}
        <path
          d="M24 21L27 24L24 27"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }
);

ShellIcon.displayName = 'ShellIcon';
