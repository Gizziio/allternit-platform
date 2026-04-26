import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { Icon } from '@phosphor-icons/react';
import {
  DotsThreeOutline,
  PencilSimple,
  Copy,
  Trash,
} from '@phosphor-icons/react';

interface RailRowMenuProps {
  onRename?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
}

export function RailRowMenu({ onRename, onCopy, onDelete }: RailRowMenuProps): JSX.Element {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}
          onClick={e => e.stopPropagation()}
        >
          <DotsThreeOutline size={18} strokeWidth={2.5} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          style={{
            minWidth: 180,
            background: 'var(--bg-secondary)',
            borderRadius: 10,
            padding: 4,
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 10000,
          }}
          sideOffset={5}
        >
          <DropdownMenuItem icon={PencilSimple} label="Rename" onClick={onRename} />
          <DropdownMenuItem icon={Copy} label="Duplicate" onClick={onCopy} />
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
          <DropdownMenuItem icon={Trash} label="Delete" onClick={onDelete} color="var(--status-error)" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface DropdownMenuItemProps {
  icon: Icon;
  label: string;
  onClick?: () => void;
  color?: string;
}

function DropdownMenuItem({ icon: Icon, label, onClick, color }: DropdownMenuItemProps): JSX.Element {
  return (
    <DropdownMenu.Item
      onClick={onClick}
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: color || 'var(--text-primary)',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        height: 32,
        padding: '0 8px',
        gap: 10,
        outline: 'none',
        cursor: 'pointer',
      }}
      className="dropdown-item-hover"
    >
      {Icon && <Icon size={16} />}
      {label}
    </DropdownMenu.Item>
  );
}
