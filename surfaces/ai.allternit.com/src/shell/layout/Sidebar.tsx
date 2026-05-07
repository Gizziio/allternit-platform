"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useSidebar, useResponsiveLayout } from './useLayout';
import {
  CaretLeft,
  CaretRight,
  List,
  X,
  CaretDown,
} from '@phosphor-icons/react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';

// =============================================================================
// Types
// =============================================================================

export interface SidebarItem {
  id: string;
  icon: PhosphorIcon | string;
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  badge?: number | string;
  disabled?: boolean;
  children?: SidebarItem[];
}

export interface SidebarProps {
  // Content
  header?: React.ReactNode;
  items: SidebarItem[];
  footer?: React.ReactNode;
  
  // Behavior
  collapsible?: boolean;
  defaultOpen?: boolean;
  width?: number;
  collapsedWidth?: number;
  
  // Visual
  showToggle?: boolean;
  showLogo?: boolean;
  logo?: React.ReactNode;
  
  // Styling
  className?: string;
}

// =============================================================================
// Sidebar Component
// =============================================================================

export function Sidebar({
  header,
  items,
  footer,
  collapsible = true,
  width = 256,
  collapsedWidth = 64,
  showToggle = true,
  showLogo = true,
  logo,
  className,
}: SidebarProps) {
  const { isOpen, toggle, setWidth } = useSidebar();
  const { isMobile } = useResponsiveLayout();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // Flatten items for keyboard navigation
  const flatItems = React.useMemo(() => {
    const flat: (SidebarItem & { depth: number; parentId?: string })[] = [];
    const traverse = (items: SidebarItem[], depth = 0, parentId?: string) => {
      items.forEach(item => {
        flat.push({ ...item, depth, parentId });
        if (expandedItems.has(item.id) && item.children) {
          traverse(item.children, depth + 1, item.id);
        }
      });
    };
    traverse(items);
    return flat;
  }, [items, expandedItems]);

  // Toggle nested item expansion
  const toggleExpanded = useCallback((id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!sidebarRef.current?.contains(document.activeElement)) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(i => Math.min(i + 1, flatItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(i => Math.max(i - 1, 0));
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (focusedIndex >= 0) {
            const item = flatItems[focusedIndex];
            if (item?.children?.length && !expandedItems.has(item.id)) {
              toggleExpanded(item.id);
            }
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (focusedIndex >= 0) {
            const item = flatItems[focusedIndex];
            if (item?.children?.length && expandedItems.has(item.id)) {
              toggleExpanded(item.id);
            } else if (item?.parentId) {
              // Focus parent
              const parentIndex = flatItems.findIndex(i => i.id === item.parentId);
              if (parentIndex >= 0) {
                setFocusedIndex(parentIndex);
                toggleExpanded(item.parentId);
              }
            }
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0) {
            const item = flatItems[focusedIndex];
            if (item?.onClick) item.onClick();
            if (item?.children?.length) {
              toggleExpanded(item.id);
            }
          }
          break;
        case 'Escape':
          if (isMobile) {
            toggle();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flatItems, focusedIndex, expandedItems, isMobile, toggle, toggleExpanded]);

  // Focus management
  useEffect(() => {
    if (focusedIndex >= 0) {
      const element = document.querySelector(`[data-sidebar-index="${focusedIndex}"]`) as HTMLElement;
      element?.focus();
    }
  }, [focusedIndex]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (!collapsible) return;
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = isOpen ? width : collapsedWidth;
  }, [collapsible, isOpen, width, collapsedWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current;
      const newWidth = Math.max(collapsedWidth, Math.min(400, resizeStartWidth.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, setWidth, collapsedWidth]);

  // Mobile drawer mode
  if (isMobile) {
    return (
      <MobileSidebar
        header={header}
        items={items}
        footer={footer}
        logo={logo}
        showLogo={showLogo}
        expandedItems={expandedItems}
        toggleExpanded={toggleExpanded}
        flatItems={flatItems}
        focusedIndex={focusedIndex}
        setFocusedIndex={setFocusedIndex}
      />
    );
  }

  const currentWidth = isOpen ? width : collapsedWidth;

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        'sidebar relative flex flex-col h-full shrink-0 transition-all duration-200 ease-out',
        'border-r border-white/10',
        isResizing && 'transition-none',
        className
      )}
      style={{
        width: currentWidth,
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {/* Header */}
      {(showLogo || header) && (
        <div className={cn(
          'flex items-center border-b border-white/10',
          isOpen ? 'h-14 px-4' : 'h-14 px-2 justify-center'
        )}>
          {showLogo && (logo || (
            <div className={cn(
              'flex items-center gap-3 font-semibold text-lg',
              !isOpen && 'hidden'
            )}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <span className="text-white text-sm font-bold">A2</span>
              </div>
              <span className="text-foreground">allternit</span>
            </div>
          ))}
          {isOpen && header}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2" role="navigation" aria-label="Main">
        <ul className="space-y-1 px-2">
          {items.map((item, index) => (
            <SidebarNavItem
              key={item.id}
              item={item}
              isOpen={isOpen}
              collapsedWidth={collapsedWidth}
              expandedItems={expandedItems}
              toggleExpanded={toggleExpanded}
              focusedIndex={focusedIndex}
              setFocusedIndex={setFocusedIndex}
              baseIndex={index}
            />
          ))}
        </ul>
      </nav>

      {/* Footer */}
      {footer && (
        <div className={cn(
          'border-t border-white/10',
          isOpen ? 'p-4' : 'p-2'
        )}>
          {footer}
        </div>
      )}

      {/* Toggle button */}
      {collapsible && showToggle && (
        <button
          onClick={toggle}
          className={cn(
            'absolute -right-3 top-1/2 -translate-y-1/2',
            'w-6 h-12 rounded-full',
            'bg-background border border-border',
            'flex items-center justify-center',
            'hover:bg-accent transition-colors',
            'shadow-md z-10'
          )}
          aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isOpen ? (
            <CaretLeft size={16} />
          ) : (
            <CaretRight size={16} />
          )}
        </button>
      )}

      {/* Resize handle */}
      {collapsible && isOpen && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/50 transition-colors"
          onMouseDown={handleResizeStart}
          style={{ touchAction: 'none' }}
        />
      )}
    </aside>
  );
}

// =============================================================================
// SidebarNavItem Component
// =============================================================================

interface SidebarNavItemProps {
  item: SidebarItem;
  isOpen: boolean;
  collapsedWidth: number;
  expandedItems: Set<string>;
  toggleExpanded: (id: string) => void;
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
  baseIndex: number;
  depth?: number;
}

function SidebarNavItem({
  item,
  isOpen,
  collapsedWidth,
  expandedItems,
  toggleExpanded,
  focusedIndex,
  setFocusedIndex,
  baseIndex,
  depth = 0,
}: SidebarNavItemProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedItems.has(item.id);
  const Icon = typeof item.icon === 'string' ? null : item.icon;
  const isActive = item.active;

  const handleClick = () => {
    if (hasChildren) {
      toggleExpanded(item.id);
    }
    item.onClick?.();
  };

  const content = (
    <>
      {/* Icon */}
      <div className={cn(
        'flex items-center justify-center shrink-0',
        isOpen ? 'w-8 h-8' : 'w-10 h-10'
      )}>
        {Icon ? (
          <Icon className={cn(
            'w-5 h-5',
            isActive ? 'text-primary' : 'text-muted-foreground'
          )} />
        ) : (
          <span className="text-sm">{item.icon as string}</span>
        )}
      </div>

      {/* Label */}
      {isOpen && (
        <>
          <span className={cn(
            'flex-1 truncate text-sm',
            isActive ? 'font-medium text-foreground' : 'text-muted-foreground'
          )}>
            {item.label}
          </span>

          {/* Badge */}
          {item.badge !== undefined && (
            <span className={cn(
              'px-2 py-0.5 text-xs rounded-full',
              typeof item.badge === 'number' && item.badge > 0
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}>
              {item.badge}
            </span>
          )}

          {/* Expand chevron */}
          {hasChildren && (
            <CaretDown className={cn(
              'w-4 h-4 transition-transform duration-200',
              isExpanded && 'rotate-180'
            )} />
          )}
        </>
      )}

      {/* Badge indicator for collapsed state */}
      {!isOpen && item.badge !== undefined && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
      )}
    </>
  );

  const buttonClasses = cn(
    'w-full flex items-center gap-2 rounded-md transition-colors',
    'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring',
    isActive && 'bg-accent',
    item.disabled && 'opacity-50 cursor-not-allowed',
    isOpen ? 'px-3 py-2' : 'justify-center py-3',
    depth > 0 && isOpen && 'pl-' + (3 + depth * 3)
  );

  return (
    <li className={cn('relative', !isOpen && 'group')}>
      {item.href ? (
        <a
          href={item.href}
          className={buttonClasses}
          data-sidebar-index={baseIndex}
          onClick={handleClick}
          tabIndex={0}
        >
          {content}
        </a>
      ) : (
        <button
          className={buttonClasses}
          data-sidebar-index={baseIndex}
          onClick={handleClick}
          disabled={item.disabled}
          tabIndex={0}
        >
          {content}
        </button>
      )}

      {/* Tooltip for collapsed state */}
      {!isOpen && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg border border-border">
          {item.label}
          {item.badge !== undefined && (
            <span className="ml-2 text-xs text-muted-foreground">({item.badge})</span>
          )}
        </div>
      )}

      {/* Nested items - using optional chaining with fallback to empty array */}
      {hasChildren && isExpanded && isOpen && (
        <ul className="mt-1 space-y-1">
          {(item.children ?? []).map((child, childIndex) => (
            <SidebarNavItem
              key={child.id}
              item={child}
              isOpen={isOpen}
              collapsedWidth={collapsedWidth}
              expandedItems={expandedItems}
              toggleExpanded={toggleExpanded}
              focusedIndex={focusedIndex}
              setFocusedIndex={setFocusedIndex}
              baseIndex={baseIndex + childIndex + 1}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// =============================================================================
// MobileSidebar Component
// =============================================================================

interface MobileSidebarProps {
  header?: React.ReactNode;
  items: SidebarItem[];
  footer?: React.ReactNode;
  logo?: React.ReactNode;
  showLogo?: boolean;
  expandedItems: Set<string>;
  toggleExpanded: (id: string) => void;
  flatItems: (SidebarItem & { depth: number; parentId?: string })[];
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
}

function MobileSidebar({
  header,
  items,
  footer,
  logo,
  showLogo,
  expandedItems,
  toggleExpanded,
  flatItems,
  focusedIndex,
  setFocusedIndex,
}: MobileSidebarProps) {
  const { isOpen, toggle, setOpen } = useSidebar();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      setOpen(false);
    }
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={toggle}
        className="fixed top-4 left-4 z-50 p-2 rounded-md bg-background/80 backdrop-blur-sm border border-border shadow-md"
        aria-label="Toggle menu"
      >
        <List size={20} />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          ref={overlayRef}
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
          onClick={handleOverlayClick}
        />
      )}

      {/* Drawer */}
      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 z-50 w-72',
          'flex flex-col',
          'bg-background border-r border-border',
          'transform transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-border">
          {showLogo && (logo || (
            <div className="flex items-center gap-3 font-semibold text-lg">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <span className="text-white text-sm font-bold">A2</span>
              </div>
              <span>allternit</span>
            </div>
          ))}
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-md hover:bg-accent"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-3" role="navigation">
          <ul className="space-y-1">
            {items.map((item, index) => (
              <MobileNavItem
                key={item.id}
                item={item}
                expandedItems={expandedItems}
                toggleExpanded={toggleExpanded}
                onClose={() => setOpen(false)}
              />
            ))}
          </ul>
        </nav>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-border">
            {footer}
          </div>
        )}
      </aside>
    </>
  );
}

// =============================================================================
// MobileNavItem Component
// =============================================================================

interface MobileNavItemProps {
  item: SidebarItem;
  expandedItems: Set<string>;
  toggleExpanded: (id: string) => void;
  onClose: () => void;
  depth?: number;
}

function MobileNavItem({
  item,
  expandedItems,
  toggleExpanded,
  onClose,
  depth = 0,
}: MobileNavItemProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedItems.has(item.id);
  const Icon = typeof item.icon === 'string' ? null : item.icon;
  const isActive = item.active;

  const handleClick = () => {
    if (hasChildren) {
      toggleExpanded(item.id);
    } else {
      item.onClick?.();
      onClose();
    }
  };

  return (
    <li>
      <button
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-3 rounded-md transition-colors',
          'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
          isActive && 'bg-accent',
          depth > 0 && `pl-${3 + depth * 3}`
        )}
      >
        {Icon && (
          <Icon className={cn(
            'w-5 h-5 shrink-0',
            isActive ? 'text-primary' : 'text-muted-foreground'
          )} />
        )}
        <span className={cn(
          'flex-1 text-left',
          isActive ? 'font-medium' : ''
        )}>
          {item.label}
        </span>
        {item.badge !== undefined && (
          <span className={cn(
            'px-2 py-0.5 text-xs rounded-full',
            typeof item.badge === 'number' && item.badge > 0
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}>
            {item.badge}
          </span>
        )}
        {hasChildren && (
          <CaretDown className={cn(
            'w-4 h-4 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )} />
        )}
      </button>

      {/* Using optional chaining with fallback to empty array */}
      {hasChildren && isExpanded && (
        <ul className="mt-1 space-y-1">
          {(item.children ?? []).map(child => (
            <MobileNavItem
              key={child.id}
              item={child}
              expandedItems={expandedItems}
              toggleExpanded={toggleExpanded}
              onClose={onClose}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
