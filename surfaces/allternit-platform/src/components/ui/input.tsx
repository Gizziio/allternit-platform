import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input: React.FC<InputProps> = ({ style, ...props }) => {
  return (
    <input
      style={{
        width: '100%',
        padding: '10px 14px',
        borderRadius: '8px',
        border: '1px solid var(--ui-border-default)',
        background: 'var(--surface-hover)',
        color: '#fff',
        fontSize: '14px',
        outline: 'none',
        ...style,
      }}
      {...props}
    />
  );
};
