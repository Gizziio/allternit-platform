import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ShellMenuProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  className?: string;
  children: React.ReactNode;
}

const MENU_ITEM_SELECTOR = '[role="menuitem"]';

/**
 * Shared shell dropdown menu panel, styled to match the sibling context
 * menus (SettingsDrilldown, ProjectRailSection). Positioning is the caller's
 * job via className — no portal, matching the rest of the shell today.
 *
 * Handles outside-click (mousedown) close, Escape close, ArrowUp/ArrowDown
 * (plus Home/End) focus cycling between items, and returns focus to the
 * trigger button when the menu closes.
 */
export function ShellMenu({
  open,
  onClose,
  triggerRef,
  className,
  children,
}: ShellMenuProps): React.ReactNode {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, triggerRef]);

  // Focus management: focus the first item on open, return focus to the
  // trigger when the menu closes.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const first = menuRef.current?.querySelector<HTMLElement>(MENU_ITEM_SELECTOR);
      first?.focus();
    }
    if (!open && wasOpenRef.current) {
      triggerRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open, triggerRef]);

  const focusItem = (index: number): void => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? [],
    );
    if (items.length === 0) return;
    items[Math.max(0, Math.min(index, items.length - 1))]?.focus();
  };

  const cycleFocus = (direction: 1 | -1): void => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? [],
    );
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (current === -1) {
      focusItem(direction === 1 ? 0 : items.length - 1);
      return;
    }
    focusItem((current + direction + items.length) % items.length);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      cycleFocus(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      cycleFocus(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      const items = menuRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? [];
      focusItem(items.length - 1);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Keyframes mirrored from SettingsDrilldown's submenu entrance; they
          are defined there in a local <style> block, so we provide our own
          copy rather than depend on that component being mounted. */}
      <style>{`
        @keyframes submenuSlideIn {
          from {
            opacity: 0;
            transform: translateX(-4px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
      <div
        ref={menuRef}
        role="menu"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'py-2 rounded-xl border border-solid border-[var(--shell-menu-border)]',
          'bg-[var(--shell-menu-bg)] shadow-[var(--shadow-lg)] overflow-hidden',
          'z-[165] animate-[submenuSlideIn_0.1s_ease-out]',
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}

interface ShellMenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

/** Single-line icon + label menu row, matching sibling menu item styling. */
export function ShellMenuItem({
  icon,
  label,
  onClick,
}: ShellMenuItemProps): React.ReactNode {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-4 py-2 border-none bg-transparent text-[13px] font-medium text-[var(--shell-item-fg)] cursor-pointer text-left transition-colors hover:bg-[var(--shell-item-hover)]"
    >
      <span className="shrink-0 flex items-center text-[var(--shell-item-muted)]">{icon}</span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
