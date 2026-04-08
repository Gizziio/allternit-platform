/**
 * @fileoverview Button Component
 * 
 * Reusable button component with variants for different use cases
 * and full accessibility support.
 * 
 * @module components/onboarding/components/Button
 */

import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';

/**
 * Button variant types
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

/**
 * Button size types
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Props for the Button component
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant of the button */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ButtonSize;
  /** Whether the button is in a loading state */
  isLoading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Button component
 * 
 * A versatile button component with multiple variants and sizes,
 * designed for the VS Code-like dark theme aesthetic.
 * 
 * @example
 * ```tsx
 * <Button variant="primary" size="lg" onClick={handleClick}>
 *   Get Started
 * </Button>
 * ```
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      fullWidth = false,
      disabled = false,
      className = '',
      ...props
    },
    ref
  ): JSX.Element {
    // Variant styles
    const variantStyles: Record<ButtonVariant, string> = {
      primary: `
        bg-blue-600 hover:bg-blue-500 
        text-white 
        shadow-lg shadow-blue-600/20
        disabled:bg-blue-600/50 disabled:shadow-none
      `,
      secondary: `
        bg-gray-700 hover:bg-gray-600 
        text-white 
        disabled:bg-gray-700/50
      `,
      outline: `
        bg-transparent 
        border-2 border-gray-600 hover:border-gray-500 
        text-gray-300 hover:text-white
        disabled:border-gray-700 disabled:text-gray-600
      `,
      ghost: `
        bg-transparent hover:bg-gray-800 
        text-gray-400 hover:text-white
        disabled:text-gray-600 disabled:hover:bg-transparent
      `,
    };

    // Size styles
    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    const baseStyles = `
      inline-flex items-center justify-center
      font-medium rounded-lg
      transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-gray-900
      disabled:cursor-not-allowed
    `;

    return (
      <motion.button
        ref={ref}
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        disabled={disabled || isLoading}
        whileHover={!disabled && !isLoading ? { scale: 1.02 } : {}}
        whileTap={!disabled && !isLoading ? { scale: 0.98 } : {}}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </motion.button>
    );
  }
);
