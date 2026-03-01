/**
 * Kernel Icon Component
 * 
 * Represents the core operating system kernel.
 */

import * as React from 'react';
import type { CustomIconProps } from './Logo';

/**
 * Kernel icon - represents the core OS/kernel component
 */
export const KernelIcon = React.forwardRef<SVGSVGElement, CustomIconProps>(
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
        aria-label={props['aria-label'] || 'Kernel'}
        aria-hidden={props['aria-hidden']}
        role="img"
      >
        {/* Outer octagon - kernel boundary */}
        <path
          d="M16 2L26.392 7.608V18.392L16 24L5.608 18.392V7.608L16 2Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Inner hexagon - core */}
        <path
          d="M16 9L21.196 12V18L16 21L10.804 18V12L16 9Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Center nucleus */}
        <circle
          cx="16"
          cy="15"
          r="2.5"
          fill="currentColor"
          fillOpacity="0.3"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        {/* Connection spokes */}
        <line
          x1="16"
          y1="2"
          x2="16"
          y2="6.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />
        <line
          x1="26.392"
          y1="7.608"
          x2="22"
          y2="10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />
        <line
          x1="26.392"
          y1="18.392"
          x2="22"
          y2="16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />
        <line
          x1="16"
          y1="24"
          x2="16"
          y2="19.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />
        <line
          x1="5.608"
          y1="18.392"
          x2="10"
          y2="16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />
        <line
          x1="5.608"
          y1="7.608"
          x2="10"
          y2="10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />
        {/* Activity indicators */}
        <circle cx="16" cy="4" r="1" fill="currentColor" />
        <circle cx="24" cy="13" r="1" fill="currentColor" fillOpacity="0.6" />
        <circle cx="8" cy="13" r="1" fill="currentColor" fillOpacity="0.6" />
      </svg>
    );
  }
);

KernelIcon.displayName = 'KernelIcon';
