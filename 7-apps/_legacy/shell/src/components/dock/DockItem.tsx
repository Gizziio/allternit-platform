import React from 'react';
import { CapsuleIcon } from '../../iconography/CapsuleIconRegistry';

interface DockItemProps {
  id: string;
  type: string;
  title: string;
  isMinimized?: boolean;
  isActive?: boolean;
  onClick: () => void;
}

export const DockItem: React.FC<DockItemProps> = ({
  type,
  title,
  isMinimized,
  isActive,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        backgroundColor: isActive ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        border: isActive ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
      }}
      title={title}
      className="dock-item"
    >
      <CapsuleIcon type={type} size={24} />
      
      {isMinimized && (
        <div
          style={{
            position: 'absolute',
            bottom: '4px',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: 'var(--text-secondary, #a1a1aa)',
          }}
        />
      )}
      
      {isActive && (
        <div
          style={{
            position: 'absolute',
            bottom: '2px',
            width: '12px',
            height: '2px',
            borderRadius: '1px',
            backgroundColor: '#3b82f6',
          }}
        />
      )}
    </div>
  );
};
