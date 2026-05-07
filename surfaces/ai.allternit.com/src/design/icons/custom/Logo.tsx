/**
 * Allternit Logo Component
 * 
 * Full allternit logo with wordmark.
 */

import * as React from 'react';

export interface CustomIconProps {
  /** Size in pixels */
  size?: number;
  /** Additional CSS classes */
  className?: string;
  /** ARIA label for accessibility */
  'aria-label'?: string;
  /** ARIA hidden state */
  'aria-hidden'?: boolean | 'true' | 'false';
}

/**
 * allternit full logo with mark and wordmark
 */
export const AllternitLogo = React.forwardRef<SVGSVGElement, CustomIconProps>(
  ({ size = 32, className, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        width={size * 4} // Wider for wordmark
        height={size}
        viewBox="0 0 128 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label={props['aria-label'] || 'allternit'}
        aria-hidden={props['aria-hidden']}
        role="img"
      >
        {/* Logo Mark - Geometric A shape */}
        <g className="logo-mark">
          {/* Outer hexagon/circle hybrid */}
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
          {/* The "2" element - curved stroke */}
          <path
            d="M11 22C11 22 13 24 16 24C19 24 21 22 21 20"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Center dot */}
          <circle cx="16" cy="20" r="1.5" fill="currentColor" />
        </g>
        
        {/* Wordmark */}
        <g className="wordmark" transform="translate(38, 8)">
          {/* A */}
          <path
            d="M0 16L4 4L8 16M1.5 12H6.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* 2 */}
          <path
            d="M12 8C12 6 14 5 15 5C16 5 18 6 18 8C18 10 12 12 12 16H18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* r */}
          <path
            d="M22 16V10M22 11C22 9 23.5 8 26 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* c */}
          <path
            d="M34 12C34 10 32.5 9 31 9C28.5 9 28 11 28 12C28 13 28.5 15 31 15C32.5 15 34 14 34 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* h */}
          <path
            d="M36 6V16M36 11C37 9.5 38.5 9 40 9C41.5 9 42.5 10 42.5 12V16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* i */}
          <path
            d="M46 9V16M46 6V6.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* t */}
          <path
            d="M52 6V12C52 14 53 15 55 15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M50 9H54"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          {/* e */}
          <path
            d="M62 12C62 10 60.5 9 59 9C56.5 9 56 11 56 12C56 13 56.5 15 59 15C60.5 15 62 14 62 12Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M56 12H61"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          {/* c */}
          <path
            d="M70 12C70 10 68.5 9 67 9C64.5 9 64 11 64 12C64 13 64.5 15 67 15C68.5 15 70 14 70 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* t */}
          <path
            d="M76 6V12C76 14 77 15 79 15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M74 9H78"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </svg>
    );
  }
);

AllternitLogo.displayName = 'AllternitLogo';
