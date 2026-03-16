"use client";

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useSidebar, useResponsiveLayout } from './useLayout';
import { GlassSurface } from '@/design/GlassSurface';
import {
  Menu,
  Search,
  Bell,
  Settings,
  ChevronRight,
  Command,
  User,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface TopBarAction {
  id: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  badge?: number;
  disabled?: boolean;
}

export interface TopBarProps {
  // Left section
  left?: React.ReactNode;
  showMenuToggle?: boolean;
  
  // Center section
  center?: React.ReactNode;
  title?: string;
  breadcrumbs?: BreadcrumbItem[];
  
  // Right section
  right?: React.ReactNode;
  showSearch?: boolean;
  showNotifications?: boolean;
  showProfile?: boolean;
  
  // Custom actions
  actions?: TopBarAction[];
  
  // Styling
  className?: string;
  height?: number;
}

// =============================================================================
// TopBar Component
// =============================================================================

export function TopBar({
  left,
  showMenuToggle = true,
  center,
  title,
  breadcrumbs,
  right,
  showSearch = true,
  showNotifications = true,
  showProfile = true,
  actions = [],
  className,
  height = 56,
}: TopBarProps) {
  const { toggle, isOpen, mode } = useSidebar();
  const { isTablet, isMobile } = useResponsiveLayout();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header
      className={cn(
        'topbar shrink-0 flex items-center px-4 gap-4',
        'border-b border-white/10',
        'bg-background/80 backdrop-blur-md',
        className
      )}
      style={{ height }}
    >
      {/* Left Section */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Menu Toggle */}
        {(showMenuToggle && (isMobile || isTablet || !isOpen)) && (
          <button
            onClick={toggle}
            className="p-2 rounded-md hover:bg-accent transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        
        {left}
      </div>

      {/* Center Section */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        {breadcrumbs ? (
          <Breadcrumbs items={breadcrumbs} />
        ) : title ? (
          <h1 className="text-lg font-semibold truncate">{title}</h1>
        ) : (
          center
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Custom Actions */}
        {actions.map(action => (
          <TopBarActionButton key={action.id} action={action} />
        ))}

        {/* Search */}
        {showSearch && (
          <GlobalSearch 
            isOpen={searchOpen} 
            onOpenChange={setSearchOpen} 
          />
        )}

        {/* Notifications */}
        {showNotifications && (
          <NotificationBell
            isOpen={notificationsOpen}
            onOpenChange={setNotificationsOpen}
          />
        )}

        {/* Profile */}
        {showProfile && (
          <ProfileMenu
            isOpen={profileOpen}
            onOpenChange={setProfileOpen}
          />
        )}

        {right}
      </div>
    </header>
  );
}

// =============================================================================
// Breadcrumbs Component
// =============================================================================

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const content = (
          <span
            className={cn(
              'px-2 py-1 rounded transition-colors',
              !isLast && 'hover:bg-accent cursor-pointer text-muted-foreground',
              isLast && 'font-medium text-foreground'
            )}
            onClick={item.onClick}
          >
            {item.label}
          </span>
        );

        return (
          <React.Fragment key={index}>
            {index > 0 && (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            {item.href ? (
              <a href={item.href} className="no-underline">
                {content}
              </a>
            ) : (
              content
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// =============================================================================
// TopBarActionButton Component
// =============================================================================

interface TopBarActionButtonProps {
  action: TopBarAction;
}

function TopBarActionButton({ action }: TopBarActionButtonProps) {
  const Icon = action.icon;
  
  return (
    <button
      onClick={action.onClick}
      disabled={action.disabled}
      className={cn(
        'relative p-2 rounded-md transition-colors',
        'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
        action.disabled && 'opacity-50 cursor-not-allowed'
      )}
      aria-label={action.label}
      title={action.label}
    >
      <Icon className="w-5 h-5" />
      {action.badge !== undefined && action.badge > 0 && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
      )}
    </button>
  );
}

// =============================================================================
// GlobalSearch Component
// =============================================================================

interface GlobalSearchProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function GlobalSearch({ isOpen, onOpenChange }: GlobalSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!isOpen);
      }
      if (e.key === 'Escape' && isOpen) {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onOpenChange]);

  if (!isOpen) {
    return (
      <button
        onClick={() => onOpenChange(true)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md',
          'bg-muted/50 hover:bg-muted transition-colors',
          'text-muted-foreground text-sm'
        )}
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-background rounded border">
          <Command className="w-3 h-3" />
          <span>K</span>
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Search Modal */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-xl z-50 px-4">
        <div className="bg-background border border-border rounded-lg shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-5 h-5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search commands, files, or agents..."
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto py-2">
            {query ? (
              <div className="px-4 py-8 text-center text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Searching for &quot;{query}&quot;...</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase">
                  Recent
                </div>
                <SearchResultItem
                  icon={Command}
                  label="Open Command Palette"
                  shortcut="⌘⇧P"
                />
                <SearchResultItem
                  icon={Settings}
                  label="Settings"
                  shortcut="⌘,"
                />
                <div className="px-4 py-2 mt-2 text-xs font-medium text-muted-foreground uppercase">
                  Suggestions
                </div>
                <SearchResultItem
                  icon={User}
                  label="Profile"
                />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

interface SearchResultItemProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  shortcut?: string;
  onClick?: () => void;
}

function SearchResultItem({ icon: Icon, label, description, shortcut, onClick }: SearchResultItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5',
        'hover:bg-accent transition-colors text-left'
      )}
    >
      <Icon className="w-4 h-4 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground truncate">{description}</div>
        )}
      </div>
      {shortcut && (
        <kbd className="px-2 py-1 text-xs bg-muted rounded">{shortcut}</kbd>
      )}
    </button>
  );
}

// =============================================================================
// NotificationBell Component
// =============================================================================

interface NotificationBellProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function NotificationBell({ isOpen, onOpenChange }: NotificationBellProps) {
  const [unreadCount] = useState(3);
  const bellRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onOpenChange]);

  return (
    <div ref={bellRef} className="relative">
      <button
        onClick={() => onOpenChange(!isOpen)}
        className={cn(
          'relative p-2 rounded-md transition-colors',
          'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
          isOpen && 'bg-accent'
        )}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 text-xs font-medium bg-primary text-primary-foreground rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-lg shadow-lg overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-medium">Notifications</h3>
            <button className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <NotificationItem
              title="Agent task completed"
              description="Code review task finished successfully"
              time="2 min ago"
              unread
            />
            <NotificationItem
              title="New message"
              description="Agent-1 sent a message"
              time="15 min ago"
              unread
            />
            <NotificationItem
              title="Deployment successful"
              description="Production deployment completed"
              time="1 hour ago"
              unread
            />
            <NotificationItem
              title="System update"
              description="A2rchitect updated to v2.1.0"
              time="2 hours ago"
            />
          </div>
          <div className="px-4 py-2 border-t border-border text-center">
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface NotificationItemProps {
  title: string;
  description: string;
  time: string;
  unread?: boolean;
}

function NotificationItem({ title, description, time, unread }: NotificationItemProps) {
  return (
    <button className={cn(
      'w-full text-left px-4 py-3 hover:bg-accent transition-colors',
      'border-b border-border last:border-b-0'
    )}>
      <div className="flex items-start gap-3">
        {unread && (
          <span className="w-2 h-2 mt-2 bg-primary rounded-full shrink-0" />
        )}
        <div className={cn('flex-1 min-w-0', !unread && 'pl-5')}>
          <div className="font-medium text-sm">{title}</div>
          <div className="text-sm text-muted-foreground truncate">{description}</div>
          <div className="text-xs text-muted-foreground mt-1">{time}</div>
        </div>
      </div>
    </button>
  );
}

// =============================================================================
// ProfileMenu Component
// =============================================================================

interface ProfileMenuProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function ProfileMenu({ isOpen, onOpenChange }: ProfileMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onOpenChange]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => onOpenChange(!isOpen)}
        className={cn(
          'flex items-center gap-2 p-1.5 rounded-md transition-colors',
          'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
          isOpen && 'bg-accent'
        )}
        aria-label="Profile menu"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
          <User className="w-4 h-4 text-primary-foreground" />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-background border border-border rounded-lg shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-border">
            <div className="font-medium">User Name</div>
            <div className="text-sm text-muted-foreground">user@example.com</div>
          </div>
          <div className="py-1">
            <ProfileMenuItem icon={User} label="Profile" />
            <ProfileMenuItem icon={Settings} label="Settings" shortcut="⌘," />
          </div>
          <div className="border-t border-border py-1">
            <ProfileMenuItem icon={LogOut} label="Log out" />
          </div>
        </div>
      )}
    </div>
  );
}

interface ProfileMenuItemProps {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  onClick?: () => void;
}

function ProfileMenuItem({ icon: Icon, label, shortcut, onClick }: ProfileMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between px-4 py-2',
        'hover:bg-accent transition-colors text-left'
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>
      {shortcut && (
        <kbd className="text-xs text-muted-foreground">{shortcut}</kbd>
      )}
    </button>
  );
}
