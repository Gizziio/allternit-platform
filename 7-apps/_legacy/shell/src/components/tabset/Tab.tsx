import React from 'react';
import { CapsuleIcon } from '../../iconography/CapsuleIconRegistry';

interface TabProps {
  id: string;
  title: string;
  type: string;
  isActive?: boolean;
  onClick: () => void;
  onClose: () => void;
}

export const Tab: React.FC<TabProps> = ({
  title,
  type,
  isActive,
  onClick,
  onClose,
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0 12px',
        height: '32px',
        minWidth: '120px',
        maxWidth: '200px',
        backgroundColor: isActive ? 'var(--bg-secondary, #1a1a2e)' : 'transparent',
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        border: isActive ? '1px solid var(--border-color, #2a2a4a)' : '1px solid transparent',
        borderBottom: 'none',
        position: 'relative',
      }}
    >
      <CapsuleIcon type={type} size={14} />
      <span
        style={{
          fontSize: '12px',
          color: isActive ? 'var(--text-primary, #e4e4e7)' : 'var(--text-secondary, #a1a1aa)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {title}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          border: 'none',
          background: 'transparent',
          color: 'var(--text-secondary, #a1a1aa)',
          cursor: 'pointer',
          borderRadius: '4px',
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
};
