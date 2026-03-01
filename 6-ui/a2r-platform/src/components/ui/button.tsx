import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  asChild?: boolean;
}

export const buttonVariants = ({
  variant = 'default',
  size = 'default',
  className = '',
}: {
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
} = {}) => {
  const variants = {
    default: 'bg-blue-500 text-white hover:bg-blue-600',
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    outline: 'border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-100',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100',
    destructive: 'bg-red-500 text-white hover:bg-red-600',
  };

  const sizes = {
    default: 'px-4 py-2 text-base',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
    icon: 'h-9 w-9 p-0',
  };

  return cn(
    'inline-flex items-center justify-center rounded font-medium transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    variants[variant],
    sizes[size],
    className
  );
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant = 'default', 
    size = 'default', 
    loading = false,
    asChild = false,
    children,
    disabled,
    ...props 
  }, ref) => {
    const variants = {
      default: 'bg-blue-500 text-white hover:bg-blue-600',
      primary: 'bg-blue-500 text-white hover:bg-blue-600',
      secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
      outline: 'border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-100',
      ghost: 'bg-transparent text-gray-700 hover:bg-gray-100',
      destructive: 'bg-red-500 text-white hover:bg-red-600',
    };

    const sizes = {
      default: 'px-4 py-2 text-base',
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
      icon: 'h-9 w-9 p-0',
    };

    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && !asChild ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
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
            Loading...
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);

Button.displayName = 'Button';
