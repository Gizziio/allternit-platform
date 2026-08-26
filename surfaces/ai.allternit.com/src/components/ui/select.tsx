import React, { createContext, useContext, useState } from 'react';

interface SelectContextValue {
  isOpen: boolean;
  setIsOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  value?: string;
  onValueChange?: (value: string) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

const useSelectContext = () => {
  const ctx = useContext(SelectContext);
  if (!ctx) {
    throw new Error('Select compound components must be used inside <Select>');
  }
  return ctx;
};

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({ children, value, onValueChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SelectContext.Provider value={{ isOpen, setIsOpen, value, onValueChange }}>
      <div style={{ position: 'relative' }}>{children}</div>
    </SelectContext.Provider>
  );
};

interface SelectTriggerProps extends React.AriaAttributes {
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
  className,
  ...ariaProps
}) => {
  const { setIsOpen } = useSelectContext();
  return (
    <button
      type="button"
      onClick={() => {
        setIsOpen((prev) => !prev);
        onClick?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsOpen((prev) => !prev);
        }
      }}
      className={className}
      {...ariaProps}
      style={{
        width: '100%',
        padding: '10px 14px',
        borderRadius: '8px',
        border: '1px solid var(--ui-border-default)',
        background: 'var(--surface-hover)',
        color: 'var(--text-primary)',
        fontSize: '14px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        ...style,
      }}
    >
      {children ?? value}
    </button>
  );
};

export const SelectValue: React.FC<{ placeholder?: string }> = ({ placeholder }) => (
  <span style={{ color: 'var(--ui-text-muted)' }}>{placeholder}</span>
);

export const SelectContent: React.FC<{ children: React.ReactNode; className?: string; align?: 'start' | 'end' | 'center'; style?: React.CSSProperties }> = ({
  className, 
  children, 
  style
}) => {
  const { isOpen } = useSelectContext();
  if (!isOpen) return null;
  return (
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
      {children}
    </div>
  );
};

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export const SelectItem: React.FC<SelectItemProps> = ({
  className, 
  children, 
  onClick,
  value,
  disabled
}) => {
  const { setIsOpen, onValueChange } = useSelectContext();
  const handleSelect = () => {
    if (disabled) return;
    onValueChange?.(value);
    setIsOpen(false);
    onClick?.();
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSelect();
        }
      }}
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
};
