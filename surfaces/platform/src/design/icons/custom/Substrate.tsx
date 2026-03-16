/**
 * Substrate Icon Component
 * 
 * Represents the foundational layer of the A2rchitect system.
 */

import * as React from 'react';
import type { CustomIconProps } from './Logo';

/**
 * Substrate icon - represents the foundational infrastructure layer
 */
export const SubstrateIcon = React.forwardRef<SVGSVGElement, CustomIconProps>(
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
        aria-label={props['aria-label'] || 'Substrate'}
        aria-hidden={props['aria-hidden']}
        role="img"
      >
        {/* Base layer - foundation */}
        <path
          d="M4 24L16 30L28 24"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Middle layer */}
        <path
          d="M4 18L16 24L28 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Top layer */}
        <path
          d="M4 12L16 18L28 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Capstone */}
        <path
          d="M16 2L4 12L16 18L28 12L16 2Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Connection lines */}
        <line
          x1="16"
          y1="18"
          x2="16"
          y2="30"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="2 2"
          strokeOpacity="0.5"
        />
        {/* Side pillars */}
        <line
          x1="4"
          y1="12"
          x2="4"
          y2="24"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />
        <line
          x1="28"
          y1="12"
          x2="28"
          y2="24"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />
      </svg>
    );
  }
);

SubstrateIcon.displayName = 'SubstrateIcon';
