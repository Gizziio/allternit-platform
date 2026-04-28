import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

// Export buttonVariants for components that need variant styles
export const buttonVariants = (options?: { variant?: string; size?: string }) => {
  const variant = options?.variant || 'default';
  const size = options?.size || 'default';
  
  const variantStyles: Record<string, string> = {
    default: 'bg-[#d4b08c] text-[#0a0a0a]',
    secondary: 'bg-white/10 text-white',
    outline: 'bg-transparent text-[#d4b08c] border border-[#d4b08c]',
    ghost: 'bg-transparent text-gray-400',
    destructive: 'bg-red-500 text-white',
  };
  
  const sizeStyles: Record<string, string> = {
    default: 'px-5 py-2.5 text-sm',
    sm: 'px-3 py-1.5 text-xs',
    lg: 'px-7 py-3.5 text-base',
    icon: 'p-2 w-9 h-9',
  };
  
  return `inline-flex items-center justify-center gap-2 rounded-lg font-medium cursor-pointer ${variantStyles[variant] || variantStyles.default} ${sizeStyles[size] || sizeStyles.default}`;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'default', size = 'default', style, ...props }, ref) => {
    const variantStyles = {
      default: { background: 'var(--accent-primary)', color: 'var(--ui-text-inverse)', border: 'none' },
      secondary: { background: 'var(--ui-border-default)', color: '#fff', border: 'none' },
      outline: { background: 'transparent', color: 'var(--accent-primary)', border: '1px solid #d4b08c' },
      ghost: { background: 'transparent', color: 'var(--ui-text-muted)', border: 'none' },
      destructive: { background: 'var(--status-error)', color: '#fff', border: 'none' },
    };
    
    const sizeStyles = {
      default: { padding: '10px 20px', fontSize: '14px' },
      sm: { padding: '6px 12px', fontSize: '12px' },
      lg: { padding: '14px 28px', fontSize: '16px' },
      icon: { padding: '8px', width: '36px', height: '36px' },
    };

    return (
      <button
        ref={ref}
        style={{
          borderRadius: '8px',
          fontWeight: '500',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          ...variantStyles[variant],
          ...sizeStyles[size],
          ...style,
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
