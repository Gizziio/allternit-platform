/**
 * A2R Mark Component
 * 
 * Compact logo mark without wordmark.
 */

import * as React from 'react';
import type { CustomIconProps } from './Logo';

/**
 * A2rchitect logo mark (icon only, no text)
 */
export const AllternitMark = React.forwardRef<SVGSVGElement, CustomIconProps>(
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
        aria-label={props['aria-label'] || 'A2rchitect'}
        aria-hidden={props['aria-hidden']}
        role="img"
      >
        {/* Outer hexagon frame */}
        <path
          d="M16 2L28.928 9.072V23.072L16 30.144L3.072 23.072V9.072L16 2Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Inner A structure */}
        <path
          d="M16 8L22 18H10L16 8Z"
          fill="currentColor"
          fillOpacity="0.2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* The "2" element */}
        <path
          d="M11 22C11 22 13 24 16 24C19 24 21 22 21 20"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Center dot */}
        <circle cx="16" cy="20" r="1.5" fill="currentColor" />
      </svg>
    );
  }
);

AllternitMark.displayName = 'AllternitMark';
