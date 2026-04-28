import React, { useState } from 'react';

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({ children, value, onValueChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div style={{ position: 'relative' }}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          if (child.type === SelectTrigger) {
            return React.cloneElement(child as React.ReactElement, {
              onClick: () => setIsOpen(!isOpen),
              value,
            });
          }
          if (child.type === SelectContent && isOpen) {
            return React.cloneElement(child as React.ReactElement, {
              onSelect: (val: string) => {
                onValueChange?.(val);
                setIsOpen(false);
              },
            });
          }
        }
        return null;
      })}
    </div>
  );
};

interface SelectTriggerProps {
  children: React.ReactNode;
  value?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export const SelectTrigger: React.FC<SelectTriggerProps> = ({ 
  children, 
  value, 
  onClick,
  style,
  className
}) => (
  <button
    type="button"
    onClick={onClick}
    className={className}
    style={{
      width: '100%',
      padding: '10px 14px',
      borderRadius: '8px',
      border: '1px solid var(--ui-border-default)',
      background: 'var(--surface-hover)',
      color: '#fff',
      fontSize: '14px',
      cursor: 'pointer',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      ...style,
    }}
  >
    {value || children}
  </button>
);

export const SelectValue: React.FC<{ placeholder?: string }> = ({ placeholder }) => (
  <span style={{ color: 'var(--ui-text-muted)' }}>{placeholder}</span>
);

export const SelectContent: React.FC<{ children: React.ReactNode; onSelect?: (val: string) => void; className?: string; align?: 'start' | 'end' | 'center'; style?: React.CSSProperties }> = ({
  className, 
  children, 
  onSelect,
  style
}) => (
  <div
    className={className}
    style={{
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: '4px',
      background: 'var(--surface-panel)',
      border: '1px solid var(--ui-border-default)',
      borderRadius: '8px',
      zIndex: 50,
      ...style,
    }}
  >
    {React.Children.map(children, child => {
      if (React.isValidElement(child) && child.type === SelectItem) {
        return React.cloneElement(child as React.ReactElement, {
          onClick: () => onSelect?.((child.props as any).value),
        });
      }
      return child;
    })}
  </div>
);

export const SelectItem: React.FC<{ value: string; children: React.ReactNode; onClick?: () => void; className?: string; disabled?: boolean }> = ({
  className, 
  children, 
  onClick,
  disabled
}) => (
  <div
    onClick={disabled ? undefined : onClick}
    className={className}
    style={{
      padding: '10px 14px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      color: disabled ? 'var(--ui-text-muted)' : '#fff',
      fontSize: '14px',
      opacity: disabled ? 0.5 : 1,
    }}
  >
    {children}
  </div>
);
