import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'default',
  style,
  ...props 
}) => {
  const variantStyles = {
    default: { background: 'var(--accent-primary)', color: 'var(--ui-text-inverse)' },
    secondary: { background: 'var(--ui-border-default)', color: 'var(--ui-text-muted)' },
    outline: { background: 'transparent', color: 'var(--accent-primary)', border: '1px solid #d4b08c' },
    destructive: { background: 'rgba(239,68,68,0.2)', color: 'var(--status-error)' },
  };

  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '500',
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  );
};
