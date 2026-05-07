import React from 'react';

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ScrollArea: React.FC<ScrollAreaProps> = ({ style, children, ...props }) => {
  return (
    <div
      style={{
        overflow: 'auto',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export const ScrollBar: React.FC<{ orientation?: 'vertical' | 'horizontal'; className?: string }> = ({ orientation = 'vertical', className }) => {
  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        right: orientation === 'vertical' ? 0 : undefined,
        bottom: orientation === 'horizontal' ? 0 : undefined,
        width: orientation === 'vertical' ? '4px' : undefined,
        height: orientation === 'horizontal' ? '4px' : undefined,
        background: 'rgba(255,255,255,0.2)',
        borderRadius: '2px',
      }}
    />
  );
};
