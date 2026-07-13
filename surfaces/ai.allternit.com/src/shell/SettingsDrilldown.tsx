'use client'
import React, { useState, useRef, useEffect } from 'react';
import { usePlatformSignOut, usePlatformUser } from '@/lib/platform-auth-client';
import * as Popover from '@radix-ui/react-popover';
import ReactDOM from 'react-dom';
import { useResolvedTheme, useThemeStore } from '@/design/ThemeStore';
import {
  Gear,
  SignOut,
  Sun,
  Moon,
  Globe,
  Question,
  ArrowUpRight,
  DownloadSimple,
  Gift,
  Info,
  CaretRight,
  ArrowCounterClockwise,
  Check,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  hasSubmenu?: boolean;
  onClick?: () => void;
  children?: MenuItem[];
}

// Submenu component that renders in a portal
function SubmenuFlyout({
  items,
  title,
  isOpen,
  anchorRect,
  onClose,
  selectedId,
}: {
  items: MenuItem[];
  title: string;
  isOpen: boolean;
  anchorRect: DOMRect | null;
  onClose: () => void;
  selectedId?: string | null;
}): React.ReactNode | null {
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const submenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && anchorRect && submenuRef.current) {
      const submenuWidth = 180;
      const submenuHeight = submenuRef.current.offsetHeight;
      const padding = 8;
      
      // Default: show to the right
      let left = anchorRect.right + padding;
      let top = anchorRect.top;
      
      // Check if would go off right edge
      if (left + submenuWidth > window.innerWidth - padding) {
        // Show to the left instead
        left = anchorRect.left - submenuWidth - padding;
      }
      
      // Check if would go off bottom edge
      if (top + submenuHeight > window.innerHeight - padding) {
        // Align to bottom
        top = window.innerHeight - submenuHeight - padding;
      }
      
      // Check if would go off top edge
      if (top < padding) {
        top = padding;
      }
      
      setPosition({ left, top });
    }
  }, [isOpen, anchorRect]);

  if (!isOpen || !anchorRect) return null;

  return ReactDOM.createPortal(
    <div
      ref={submenuRef}
      onMouseEnter={(e) => e.stopPropagation()}
      className="fixed min-w-[180px] bg-[var(--shell-menu-bg)] rounded-[10px] border border-solid border-[var(--shell-menu-border)] shadow-[var(--shadow-lg)] py-2 z-[165] animate-[submenuSlideIn_0.1s_ease-out]"
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      {/* Submenu header */}
      <div className="px-4 pt-2 pb-3 border-b border-solid border-[var(--shell-divider)] mb-1.5">
        <span className="text-[13px] font-medium text-[var(--shell-item-muted)]">
          {title}
        </span>
      </div>
      
      {items.map((child) => (
        <button type="button"
          key={child.id}
          onClick={() => {
            child.onClick?.();
            onClose();
          }}
          className="flex w-full items-center justify-between px-4 py-2 text-[14px] text-[var(--shell-item-fg)] bg-transparent border-none cursor-pointer text-left transition-colors duration-150 ease-in-out hover:bg-[var(--shell-item-hover)]"
        >
          <span className="flex items-center gap-2">
            {child.id === selectedId && <Check size={14} weight="bold" className="text-[var(--accent-primary)]" />}
            {child.label}
          </span>
          {child.shortcut && (
            <span className="text-[12px] text-[var(--shell-item-muted)] font-mono">
              {child.shortcut}
            </span>
          )}
        </button>
      ))}
    </div>,
    document.body
  );
}

const SectionDivider = (): React.ReactNode => (
  <div className="h-px bg-[var(--shell-divider)] my-1.5 mx-3" />
);

export function SettingsDrilldown({ children }: { children?: React.ReactNode }): React.ReactNode {
  const { user, isSignedIn } = usePlatformUser();
  const signOut = usePlatformSignOut()
  const [open, setOpen] = useState(false);
  const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null);
  const [submenuAnchor, setSubmenuAnchor] = useState<DOMRect | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themePreference = useThemeStore((state) => state.theme);
  const setThemePreference = useThemeStore((state) => state.setTheme);
  const resolvedTheme = useResolvedTheme(themePreference);
  const isDark = resolvedTheme === 'dark';
  
  const handleOpenSettings = (section?: string): void => {
    setOpen(false);
    setActiveSubmenuId(null);
    window.dispatchEvent(new CustomEvent('allternit:open-settings', { 
      detail: { section: section || 'general' } 
    }));
  };

  const toggleTheme = (): void => {
    setThemePreference(isDark ? 'light' : 'dark');
  };

  const handleLogout = (): void => {
    setOpen(false);
    setActiveSubmenuId(null);
    signOut();
  };

  // Persisted language preference (honest stub until full i18n is wired)
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    try {
      return localStorage.getItem('allternit:language') || 'en';
    } catch {
      return 'en';
    }
  });
  const saveLanguage = (id: string) => {
    setSelectedLanguage(id);
    try {
      localStorage.setItem('allternit:language', id);
    } catch {
      // ignore
    }
    setActiveSubmenuId(null);
  };

  const openExternal = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Submenu data
  const languageItems: MenuItem[] = [
    { id: 'en', label: 'English', onClick: () => saveLanguage('en') },
    { id: 'es', label: 'Español', onClick: () => saveLanguage('es') },
    { id: 'fr', label: 'Français', onClick: () => saveLanguage('fr') },
    { id: 'de', label: 'Deutsch', onClick: () => saveLanguage('de') },
    { id: 'zh', label: '中文', onClick: () => saveLanguage('zh') },
    { id: 'ja', label: '日本語', onClick: () => saveLanguage('ja') },
  ];

  const helpItems: MenuItem[] = [
    { id: 'docs', label: 'Documentation', onClick: () => openExternal('https://docs.allternit.com') },
    { id: 'support', label: 'Contact Support', onClick: () => openExternal('https://allternit.com/support') },
    { id: 'feedback', label: 'Send Feedback', onClick: () => openExternal('https://allternit.com/feedback') },
  ];

  const learnItems: MenuItem[] = [
    { id: 'api', label: 'API Console', onClick: () => openExternal('https://api.allternit.com') },
    { id: 'about', label: 'About Allternit', onClick: () => { setActiveSubmenuId(null); handleOpenSettings('about'); } },
    { id: 'tutorials', label: 'Tutorials', onClick: () => openExternal('https://docs.allternit.com/tutorials') },
    { id: 'courses', label: 'Courses', onClick: () => openExternal('https://allternit.com/labs') },
    { id: 'usage', label: 'Usage Policy', onClick: () => openExternal('https://allternit.com/usage') },
    { id: 'privacy', label: 'Privacy Policy', onClick: () => openExternal('https://allternit.com/privacy') },
    { id: 'shortcuts', label: 'Keyboard shortcuts', shortcut: '⌘?', onClick: () => { setActiveSubmenuId(null); handleOpenSettings('shortcuts'); } },
  ];

  const menuItems: MenuItem[] = [
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: <Gear size={18} weight="regular" />, 
      shortcut: '⌘,',
      onClick: () => handleOpenSettings('general')
    },
    { 
      id: 'theme', 
      label: isDark ? 'Light Mode' : 'Dark Mode', 
      icon: isDark ? <Sun size={18} weight="regular" /> : <Moon size={18} weight="regular" />,
      onClick: toggleTheme 
    },
    { 
      id: 'language', 
      label: 'Language', 
      icon: <Globe size={18} weight="regular" />,
      hasSubmenu: true,
      children: languageItems
    },
    { 
      id: 'help', 
      label: 'Get help', 
      icon: <Question size={18} weight="regular" />,
      hasSubmenu: true,
      children: helpItems
    },
    { 
      id: 'upgrade', 
      label: 'Upgrade plan', 
      icon: <ArrowUpRight size={18} weight="regular" />,
      onClick: () => handleOpenSettings('billing')
    },
    { 
      id: 'downloads', 
      label: 'Get apps and extensions', 
      icon: <DownloadSimple size={18} weight="regular" />,
      onClick: () => handleOpenSettings('extensions')
    },
    {
      id: 'gift',
      label: 'Gift Allternit',
      icon: <Gift size={18} weight="regular" />,
      onClick: () => { window.open('https://allternit.com/gift', '_blank', 'noopener,noreferrer'); }
    },
    { 
      id: 'learn', 
      label: 'Learn more', 
      icon: <Info size={18} weight="regular" />,
      hasSubmenu: true,
      children: learnItems
    },
    {
      id: 'reset-layout',
      label: 'Layout',
      icon: <ArrowCounterClockwise size={18} weight="regular" />,
      onClick: () => handleOpenSettings('appearance'),
    },
    {
      id: 'logout',
      label: 'Sign out',
      icon: <SignOut size={18} weight="regular" />,
      onClick: handleLogout
    },
  ];

  const activeSubmenuItem = menuItems.find(item => item.id === activeSubmenuId);

  const handleItemHover = (item: MenuItem, el: HTMLButtonElement): void => {
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current);
      submenuTimeoutRef.current = null;
    }
    
    if (item.hasSubmenu && item.children) {
      setActiveSubmenuId(item.id);
      setSubmenuAnchor(el.getBoundingClientRect());
    } else {
      // Small delay before closing to allow moving to submenu
      submenuTimeoutRef.current = setTimeout(() => {
        setActiveSubmenuId(null);
        setSubmenuAnchor(null);
      }, 50);
    }
  };

  return (
    <>
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
      <Popover.Root open={open} onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setActiveSubmenuId(null);
          setSubmenuAnchor(null);
        }
      }}>
        <Popover.Trigger asChild>{children}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content 
            side="top" 
            align="end" 
            sideOffset={8}
            className="min-w-[240px] bg-[var(--shell-menu-bg)] rounded-[10px] border border-solid border-[var(--shell-menu-border)] shadow-[var(--shadow-lg)] py-2 z-[160]"
          >
            <div ref={menuRef}>
              {/* User Profile Header */}
              {isSignedIn && user && (
                <>
                  <button type="button"
                    onClick={() => handleOpenSettings('signin')}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left bg-transparent border-none cursor-pointer transition-colors duration-150 hover:bg-[var(--shell-item-hover)]"
                  >
                    {user.imageUrl ? (
                      <img src={user.imageUrl} className="size-8 rounded-full" alt="Avatar" />
                    ) : (
                      <div className="size-8 rounded-full bg-[var(--status-info)] flex items-center justify-center text-white text-[12px] font-semibold">
                        {(user.firstName?.[0] || user.userEmail?.[0] || 'U').toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-[var(--shell-item-fg)] overflow-hidden text-ellipsis whitespace-nowrap">
                        {user.firstName ? `${user.firstName} ${user.lastName || ''}` : 'User'}
                      </div>
                      <div className="text-[12px] text-[var(--shell-item-muted)] overflow-hidden text-ellipsis whitespace-nowrap">
                        {user.primaryEmailAddress?.emailAddress || user.userEmail || ''}
                      </div>
                    </div>
                  </button>
                  <SectionDivider />
                </>
              )}

              {/* Menu Items - dynamically rendered with bounds checking */}
              {menuItems.map((item) => (
                <MenuItem 
                  key={item.id}
                  item={item} 
                  isActive={activeSubmenuId === item.id}
                  onHover={handleItemHover}
                  onClick={() => { item.onClick?.(); setOpen(false); }}
                />
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Submenu flyout using portal */}
      {activeSubmenuItem?.children && (
        <SubmenuFlyout
          items={activeSubmenuItem.children}
          title={activeSubmenuItem.label}
          isOpen={!!activeSubmenuId}
          anchorRect={submenuAnchor}
          selectedId={activeSubmenuItem.id === 'language' ? selectedLanguage : undefined}
          onClose={() => {
            setActiveSubmenuId(null);
            setSubmenuAnchor(null);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

// Individual menu item component
function MenuItem({ 
  item, 
  isActive,
  onHover,
  onClick
}: { 
  item: MenuItem; 
  isActive: boolean;
  onHover: (item: MenuItem, el: HTMLButtonElement) => void;
  onClick: () => void;
}): React.ReactNode {
  const hasSubmenu = item.hasSubmenu && item.children;
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <button type="button"
      ref={buttonRef}
      onClick={onClick}
      onMouseEnter={() => buttonRef.current && onHover(item, buttonRef.current)}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2 rounded-md text-[14px] font-normal bg-transparent border-none cursor-pointer text-left transition-colors duration-150 ease-in-out",
        item.id === 'logout' ? "text-[var(--status-error)] hover:bg-[var(--shell-danger-soft-bg)]" : "text-[var(--shell-item-fg)]",
        isActive ? "bg-[var(--shell-item-hover)]" : "hover:bg-[var(--shell-item-hover)]"
      )}
    >
      <span className="text-[var(--shell-item-muted)] flex items-center">
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      <div className="flex items-center gap-2">
        {item.shortcut && !hasSubmenu && (
          <span className="text-[12px] text-[var(--shell-item-muted)] font-mono">
            {item.shortcut}
          </span>
        )}
        {hasSubmenu && (
          <CaretRight size={14} className="text-[var(--shell-item-muted)]" />
        )}
      </div>
    </button>
  );
}
