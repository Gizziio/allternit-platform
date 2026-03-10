import React, { useState, useRef, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';
import ReactDOM from 'react-dom';
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
} from '@phosphor-icons/react';

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
  onClose
}: { 
  items: MenuItem[];
  title: string;
  isOpen: boolean;
  anchorRect: DOMRect | null;
  onClose: () => void;
}) {
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
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        minWidth: '180px',
        backgroundColor: '#1f1f1f',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        padding: '8px 0',
        zIndex: 100000,
        animation: 'submenuSlideIn 0.1s ease-out',
      }}
    >
      {/* Submenu header */}
      <div style={{ 
        padding: '8px 16px 12px', 
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        marginBottom: '6px'
      }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#a0a0a0' }}>
          {title}
        </span>
      </div>
      
      {items.map((child) => (
        <button
          key={child.id}
          onClick={() => {
            child.onClick?.();
            onClose();
          }}
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            fontSize: '14px',
            color: '#e5e5e5',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => { 
            e.currentTarget.style.backgroundColor = '#2a2a2a'; 
          }}
          onMouseLeave={(e) => { 
            e.currentTarget.style.backgroundColor = 'transparent'; 
          }}
        >
          <span>{child.label}</span>
          {child.shortcut && (
            <span style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>
              {child.shortcut}
            </span>
          )}
        </button>
      ))}
    </div>,
    document.body
  );
}

export function SettingsDrilldown({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null);
  const [submenuAnchor, setSubmenuAnchor] = useState<DOMRect | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleOpenSettings = (section?: string) => {
    setOpen(false);
    setActiveSubmenuId(null);
    window.dispatchEvent(new CustomEvent('a2r:open-settings', { 
      detail: { section: section || 'general' } 
    }));
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const handleLogout = () => {
    setOpen(false);
    setActiveSubmenuId(null);
    window.dispatchEvent(new CustomEvent('a2r:logout'));
  };

  // Submenu data
  const languageItems: MenuItem[] = [
    { id: 'en', label: 'English', onClick: () => setActiveSubmenuId(null) },
    { id: 'es', label: 'Español', onClick: () => setActiveSubmenuId(null) },
    { id: 'fr', label: 'Français', onClick: () => setActiveSubmenuId(null) },
    { id: 'de', label: 'Deutsch', onClick: () => setActiveSubmenuId(null) },
    { id: 'zh', label: '中文', onClick: () => setActiveSubmenuId(null) },
    { id: 'ja', label: '日本語', onClick: () => setActiveSubmenuId(null) },
  ];

  const helpItems: MenuItem[] = [
    { id: 'docs', label: 'Documentation', onClick: () => setActiveSubmenuId(null) },
    { id: 'support', label: 'Contact Support', onClick: () => setActiveSubmenuId(null) },
    { id: 'feedback', label: 'Send Feedback', onClick: () => setActiveSubmenuId(null) },
  ];

  const learnItems: MenuItem[] = [
    { id: 'api', label: 'API Console', onClick: () => setActiveSubmenuId(null) },
    { id: 'about', label: 'About A2R', onClick: () => { setActiveSubmenuId(null); handleOpenSettings('about'); } },
    { id: 'tutorials', label: 'Tutorials', onClick: () => setActiveSubmenuId(null) },
    { id: 'courses', label: 'Courses', onClick: () => setActiveSubmenuId(null) },
    { id: 'usage', label: 'Usage Policy', onClick: () => setActiveSubmenuId(null) },
    { id: 'privacy', label: 'Privacy Policy', onClick: () => setActiveSubmenuId(null) },
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
      label: 'Gift A2R', 
      icon: <Gift size={18} weight="regular" />,
      onClick: () => {}
    },
    { 
      id: 'learn', 
      label: 'Learn more', 
      icon: <Info size={18} weight="regular" />,
      hasSubmenu: true,
      children: learnItems
    },
    { 
      id: 'logout', 
      label: 'Log out', 
      icon: <SignOut size={18} weight="regular" />,
      onClick: handleLogout
    },
  ];

  const activeSubmenuItem = menuItems.find(item => item.id === activeSubmenuId);

  const handleItemHover = (item: MenuItem, el: HTMLButtonElement) => {
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

  const handleSubmenuEnter = () => {
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current);
      submenuTimeoutRef.current = null;
    }
  };

  const handleSubmenuLeave = () => {
    submenuTimeoutRef.current = setTimeout(() => {
      setActiveSubmenuId(null);
      setSubmenuAnchor(null);
    }, 150);
  };

  const SectionDivider = () => (
    <div style={{ 
      height: '1px', 
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      margin: '6px 12px'
    }} />
  );

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
            style={{
              minWidth: '240px',
              backgroundColor: '#1f1f1f',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              padding: '8px 0',
              zIndex: 9999,
            }}
          >
            <div ref={menuRef}>
              {/* Menu Items - dynamically rendered with bounds checking */}
              {menuItems.slice(0, 9).map((item, index) => (
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
}) {
  const hasSubmenu = item.hasSubmenu && item.children;
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      onMouseEnter={() => buttonRef.current && onHover(item, buttonRef.current)}
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: 400,
        color: item.id === 'logout' ? '#ef4444' : '#e5e5e5',
        background: isActive ? '#2a2a2a' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background-color 0.15s ease',
      }}
      onMouseOver={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 
            item.id === 'logout' ? 'rgba(239, 68, 68, 0.1)' : '#2a2a2a';
        }
      }}
      onMouseOut={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      <span style={{ color: '#a0a0a0', display: 'flex', alignItems: 'center' }}>
        {item.icon}
      </span>
      <span style={{ flex: 1 }}>{item.label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {item.shortcut && !hasSubmenu && (
          <span style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>
            {item.shortcut}
          </span>
        )}
        {hasSubmenu && (
          <CaretRight size={14} color="#666" />
        )}
      </div>
    </button>
  );
}
