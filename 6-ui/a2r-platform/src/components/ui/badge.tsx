import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'default',
  style,
  ...props 
}) => {
  const variantStyles = {
    default: { background: '#d4b08c', color: '#0a0a0a' },
    secondary: { background: 'rgba(255,255,255,0.1)', color: '#888' },
    outline: { background: 'transparent', color: '#d4b08c', border: '1px solid #d4b08c' },
    destructive: { background: 'rgba(239,68,68,0.2)', color: '#ef4444' },
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
