/**
 * Context Menu Hook
 * 
 * Provides right-click context menus for:
 * - File tree items (files and folders)
 * - Capability items in the list
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetType: 'file' | 'directory' | 'capability' | null;
  targetId: string | null;
  targetPath: string | null;
  targetName: string | null;
}

export interface ContextMenuActions {
  onOpen?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onNewFile?: () => void;
  onNewFolder?: () => void;
  onToggleEnabled?: () => void;
  onEdit?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
}

export function useContextMenu(actions: ContextMenuActions) {
  const [state, setState] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    targetType: null,
    targetId: null,
    targetPath: null,
    targetName: null,
  });

  const menuRef = useRef<HTMLDivElement>(null);

  const showContextMenu = useCallback((
    e: React.MouseEvent,
    targetType: 'file' | 'directory' | 'capability',
    targetId: string,
    targetPath?: string,
    targetName?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Calculate position to keep menu on screen
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 300);

    setState({
      visible: true,
      x,
      y,
      targetType,
      targetId,
      targetPath: targetPath || null,
      targetName: targetName || null,
    });
  }, []);

  const hideContextMenu = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    if (!state.visible) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        hideContextMenu();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hideContextMenu();
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [state.visible, hideContextMenu]);

  return {
    state,
    menuRef,
    showContextMenu,
    hideContextMenu,
  };
}

// ============================================================================
// Context Menu Component
// ============================================================================

import React from 'react';
import {
  FileText,
  Folder,
  Edit3,
  Trash2,
  Copy,
  ClipboardPaste,
  Plus,
  FolderPlus,
  Power,
  ExternalLink,
  FolderOpen,
} from 'lucide-react';

const THEME = {
  bg: '#1c1917',
  border: 'rgba(212, 176, 140, 0.15)',
  textPrimary: '#e7e5e4',
  textSecondary: '#a8a29e',
  textTertiary: '#78716c',
  hoverBg: 'rgba(255,255,255,0.05)',
  danger: '#ef4444',
  accent: '#d4b08c',
};

interface ContextMenuProps {
  state: ContextMenuState;
  menuRef: React.RefObject<HTMLDivElement>;
  actions: ContextMenuActions;
  onClose: () => void;
}

export function ContextMenu({ state, menuRef, actions, onClose }: ContextMenuProps) {
  if (!state.visible) return null;

  const { targetType } = state;

  const handleAction = (action: (() => void) | undefined) => {
    if (action) {
      action();
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: state.x,
        top: state.y,
        backgroundColor: THEME.bg,
        border: `1px solid ${THEME.border}`,
        borderRadius: 8,
        padding: '4px',
        minWidth: 180,
        zIndex: 1000,
        boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
      }}
    >
      {/* File-specific actions */}
      {targetType === 'file' && (
        <>
          <MenuItem icon={ExternalLink} onClick={() => handleAction(actions.onOpen)}>
            Open
          </MenuItem>
          <MenuItem icon={Edit3} onClick={() => handleAction(actions.onEdit)}>
            Edit
          </MenuItem>
          <MenuItem icon={Copy} onClick={() => handleAction(actions.onCopy)}>
            Copy
          </MenuItem>
          <Divider />
          <MenuItem icon={FileText} onClick={() => handleAction(actions.onRename)}>
            Rename
          </MenuItem>
          <MenuItem icon={Trash2} danger onClick={() => handleAction(actions.onDelete)}>
            Delete
          </MenuItem>
        </>
      )}

      {/* Directory-specific actions */}
      {targetType === 'directory' && (
        <>
          <MenuItem icon={FolderOpen} onClick={() => handleAction(actions.onOpen)}>
            Open
          </MenuItem>
          <Divider />
          <MenuItem icon={Plus} onClick={() => handleAction(actions.onNewFile)}>
            New File
          </MenuItem>
          <MenuItem icon={FolderPlus} onClick={() => handleAction(actions.onNewFolder)}>
            New Folder
          </MenuItem>
          <Divider />
          <MenuItem icon={Folder} onClick={() => handleAction(actions.onRename)}>
            Rename
          </MenuItem>
          <MenuItem icon={Trash2} danger onClick={() => handleAction(actions.onDelete)}>
            Delete
          </MenuItem>
        </>
      )}

      {/* Capability-specific actions */}
      {targetType === 'capability' && (
        <>
          <MenuItem icon={Edit3} onClick={() => handleAction(actions.onEdit)}>
            Edit
          </MenuItem>
          <MenuItem icon={Power} onClick={() => handleAction(actions.onToggleEnabled)}>
            Toggle Enabled
          </MenuItem>
          <MenuItem icon={Copy} onClick={() => handleAction(actions.onDuplicate)}>
            Duplicate
          </MenuItem>
          <Divider />
          <MenuItem icon={Trash2} danger onClick={() => handleAction(actions.onDelete)}>
            Delete
          </MenuItem>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  children,
  danger,
  onClick,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 6,
        backgroundColor: 'transparent',
        border: 'none',
        color: danger ? THEME.danger : THEME.textSecondary,
        fontSize: 13,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = THEME.hoverBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <Icon size={14} color={danger ? THEME.danger : THEME.textTertiary} />
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        backgroundColor: THEME.border,
        margin: '4px 0',
      }}
    />
  );
}
