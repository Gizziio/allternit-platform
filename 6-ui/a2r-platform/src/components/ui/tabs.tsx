import React, { useState } from 'react';

interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({ value, defaultValue, onValueChange, className, children }) => {
  const [activeTab, setActiveTab] = useState(value ?? defaultValue);
  
  return (
    <div className={className}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          if (child.type === TabsList) {
            return React.cloneElement(child as React.ReactElement, {
              activeTab,
              onTabChange: (val: string) => {
                setActiveTab(val);
                onValueChange?.(val);
              },
            });
          }
        }
        return child;
      })}
    </div>
  );
};

export const TabsList: React.FC<{ 
  children: React.ReactNode; 
  activeTab?: string;
  onTabChange?: (val: string) => void;
  className?: string;
}> = ({ children, activeTab, onTabChange, className }) => {
  return (
    <div className={className} style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child) && child.type === TabsTrigger) {
          const val = (child.props as any).value;
          return React.cloneElement(child as React.ReactElement, {
            isActive: activeTab === val,
            onClick: () => onTabChange?.(val),
          });
        }
        return child;
      })}
    </div>
  );
};

export const TabsTrigger: React.FC<{ 
  value: string; 
  children: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}> = ({ children, isActive, onClick, className }) => {
  return (
    <button
      className={className}
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderRadius: '6px',
        border: 'none',
        background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
        color: isActive ? '#fff' : '#888',
        fontSize: '14px',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
};

export const TabsContent: React.FC<{ 
  value: string;
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return <div className={className}>{children}</div>;
};
