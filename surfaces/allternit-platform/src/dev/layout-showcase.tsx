"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ShellLayout,
  Sidebar,
  TopBar,
  BottomBar,
  PanelContainer,
  useLayout,
  useLayoutPresets,
  useResponsiveLayout,
  layoutPresets,
  type SidebarItem,
  type LayoutPreset,
} from '@/shell/layout';
import {
  House as Home,
  GearSix as Settings,
  Users,
  FileText,
  Code,
  Terminal,
  MagnifyingGlass as Search,
  Bell,
  List as Menu,
  Layout,
  ArrowsOut as Maximize,
  ArrowsIn as Minimize,
  Columns,
  SidebarSimple as PanelLeft,
  SidebarSimple as PanelRight,
  SidebarSimple as PanelBottom,
  WifiHigh as Wifi,
  WifiSlash as WifiOff,
  CircleNotch as Loader2,
  CheckCircle as CheckCircle2,
  Warning as AlertCircle,
  Moon,
  Sun,
  GitBranch,
  Command,
  SquaresFour as LayoutGrid,
  CrosshairSimple as Focus,
  ArrowsOut as Fullscreen,
  AppWindow,
  X,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

// =============================================================================
// Demo Navigation Items
// =============================================================================

const demoNavItems: SidebarItem[] = [
  {
    id: 'home',
    icon: Home,
    label: 'Home',
    active: true,
  },
  {
    id: 'projects',
    icon: LayoutGrid,
    label: 'Projects',
    badge: 5,
  },
  {
    id: 'code',
    icon: Code,
    label: 'Code',
    children: [
      {
        id: 'files',
        icon: FileText,
        label: 'Files',
      },
      {
        id: 'terminal',
        icon: Terminal,
        label: 'Terminal',
      },
    ],
  },
  {
    id: 'team',
    icon: Users,
    label: 'Team',
  },
  {
    id: 'settings',
    icon: Settings,
    label: 'Settings',
  },
];

// =============================================================================
// Layout Showcase Main Component
// =============================================================================

export default function LayoutShowcase() {
  const [activeDemo, setActiveDemo] = useState<'default' | 'focus' | 'fullscreen' | 'ide' | 'custom'>('default');
  const [darkMode, setDarkMode] = useState(false);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className={cn('min-h-screen', darkMode ? 'dark' : '')}>
      {/* Demo Selector - Only visible when not in fullscreen mode */}
      {activeDemo !== 'fullscreen' && (
        <DemoSelector 
          activeDemo={activeDemo} 
          onChange={setActiveDemo}
          darkMode={darkMode}
          onToggleTheme={toggleTheme}
        />
      )}

      {/* Demo Content */}
      <div className="h-screen">
        {activeDemo === 'default' && <DefaultDemo />}
        {activeDemo === 'focus' && <FocusDemo />}
        {activeDemo === 'fullscreen' && <FullscreenDemo onExit={() => setActiveDemo('default')} />}
        {activeDemo === 'ide' && <IDEDemo />}
        {activeDemo === 'custom' && <CustomDemo />}
      </div>
    </div>
  );
}

// =============================================================================
// Demo Selector Component
// =============================================================================

interface DemoSelectorProps {
  activeDemo: string;
  onChange: (demo: 'default' | 'focus' | 'fullscreen' | 'ide' | 'custom') => void;
  darkMode: boolean;
  onToggleTheme: () => void;
}

function DemoSelector({ activeDemo, onChange, darkMode, onToggleTheme }: DemoSelectorProps) {
  const demos = [
    { id: 'default', label: 'Default', icon: Layout, description: 'Sidebar + main content' },
    { id: 'focus', label: 'Focus', icon: Focus, description: 'Minimal chrome' },
    { id: 'fullscreen', label: 'Fullscreen', icon: Fullscreen, description: 'No chrome' },
    { id: 'ide', label: 'IDE', icon: AppWindow, description: 'Panels on all sides' },
    { id: 'custom', label: 'Custom', icon: Settings, description: 'Custom configuration' },
  ] as const;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 p-2 bg-background/90 backdrop-blur-md border border-border rounded-xl shadow-lg">
        {demos.map((demo) => (
          <button
            key={demo.id}
            onClick={() => onChange(demo.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
              activeDemo === demo.id
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent text-muted-foreground hover:text-foreground'
            )}
            title={demo.description}
          >
            <demo.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{demo.label}</span>
          </button>
        ))}
        
        <div className="w-px h-6 bg-border mx-1" />
        
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
          title="Toggle theme"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Default Demo
// =============================================================================

function DefaultDemo() {
  return (
    <ShellLayout
      sidebar={{
        enabled: true,
        defaultOpen: true,
        width: 256,
        collapsible: true,
        items: demoNavItems,
      }}
      topbar={{
        enabled: true,
        title: 'Default Layout',
        breadcrumbs: [
          { label: 'Home', href: '#' },
          { label: 'Projects', href: '#' },
          { label: 'My Project' },
        ],
        showSearch: true,
        showNotifications: true,
        showProfile: true,
      }}
      bottombar={{
        enabled: true,
        connectionStatus: 'connected',
        syncStatus: 'synced',
        currentContext: 'production',
        showVersion: true,
        version: '2.1.0',
      }}
    >
      <DemoContent 
        title="Default Layout"
        description="This is the default layout with sidebar, topbar, and bottombar. The sidebar is fully expanded by default."
      />
    </ShellLayout>
  );
}

// =============================================================================
// Focus Demo
// =============================================================================

function FocusDemo() {
  return (
    <ShellLayout
      sidebar={{
        enabled: true,
        defaultOpen: false,
        width: 256,
        collapsible: true,
        items: demoNavItems,
      }}
      topbar={{
        enabled: true,
        title: 'Focus Mode',
        showSearch: true,
        showNotifications: false,
        showProfile: true,
      }}
      bottombar={{
        enabled: false,
      }}
    >
      <DemoContent 
        title="Focus Mode"
        description="This is the focus layout with minimal chrome. The sidebar is collapsed by default and the bottombar is hidden."
        variant="focus"
      />
    </ShellLayout>
  );
}

// =============================================================================
// Fullscreen Demo
// =============================================================================

interface FullscreenDemoProps {
  onExit: () => void;
}

function FullscreenDemo({ onExit }: FullscreenDemoProps) {
  return (
    <div className="relative h-screen w-screen bg-background">
      {/* Exit button */}
      <button
        onClick={onExit}
        className="fixed top-4 right-4 z-50 p-3 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-lg hover:bg-accent transition-colors"
        title="Exit fullscreen"
      >
        <X className="w-5 h-5" />
      </button>

      <DemoContent 
        title="Fullscreen Mode"
        description="This is the fullscreen layout with no chrome. All UI elements are hidden for maximum content space."
        variant="fullscreen"
      />
    </div>
  );
}

// =============================================================================
// IDE Demo
// =============================================================================

function IDEDemo() {
  const leftPanel = {
    id: 'explorer',
    title: 'Explorer',
    icon: 'folder',
    content: (
      <div className="p-4">
        <h4 className="font-medium mb-2">Project Files</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>📁 src/</li>
          <li className="pl-4">📄 index.ts</li>
          <li className="pl-4">📄 app.tsx</li>
          <li>📄 package.json</li>
          <li>📄 README.md</li>
        </ul>
      </div>
    ),
    defaultSize: 20,
    minSize: 15,
    maxSize: 40,
  };

  const rightPanel = {
    id: 'inspector',
    title: 'Inspector',
    icon: 'panel-right',
    content: (
      <div className="p-4">
        <h4 className="font-medium mb-2">Properties</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type</span>
            <span>Component</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span>ShellLayout</span>
          </div>
        </div>
      </div>
    ),
    defaultSize: 20,
    minSize: 15,
    maxSize: 40,
  };

  const bottomPanel = {
    id: 'terminal',
    title: 'Terminal',
    icon: 'terminal',
    content: (
      <div className="p-4 font-mono text-sm">
        <div className="text-green-500">$ npm run dev</div>
        <div className="text-muted-foreground mt-1">
          {'>'} ready started server on 0.0.0.0:3000, url: http://localhost:3000
        </div>
        <div className="text-muted-foreground">
          {'>'} event - compiled client and server successfully in 245 ms (124 modules)
        </div>
      </div>
    ),
    defaultSize: 25,
    minSize: 10,
    maxSize: 50,
  };

  return (
    <ShellLayout
      sidebar={{
        enabled: true,
        defaultOpen: true,
        width: 256,
        collapsible: true,
        items: demoNavItems,
      }}
      topbar={{
        enabled: true,
        title: 'IDE Layout',
        showSearch: true,
        showNotifications: true,
        showProfile: true,
      }}
      bottombar={{
        enabled: true,
        connectionStatus: 'connected',
        syncStatus: 'synced',
        showVersion: true,
      }}
      panels={{
        left: leftPanel,
        right: rightPanel,
        bottom: bottomPanel,
      }}
    >
      <DemoContent 
        title="IDE Layout"
        description="This is the IDE layout with resizable panels on all sides. Try dragging the resize handles to adjust panel sizes."
        variant="ide"
      />
    </ShellLayout>
  );
}

// =============================================================================
// Custom Demo
// =============================================================================

function CustomDemo() {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connected');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');

  const cycleConnection = () => {
    const states: ('connected' | 'connecting' | 'disconnected')[] = ['connected', 'connecting', 'disconnected'];
    const currentIndex = states.indexOf(connectionStatus);
    setConnectionStatus(states[(currentIndex + 1) % states.length]);
  };

  const cycleSync = () => {
    const states: ('synced' | 'syncing' | 'offline' | 'error')[] = ['synced', 'syncing', 'offline', 'error'];
    const currentIndex = states.indexOf(syncStatus);
    setSyncStatus(states[(currentIndex + 1) % states.length]);
  };

  return (
    <ShellLayout
      sidebar={{
        enabled: true,
        defaultOpen: true,
        width: 280,
        collapsible: true,
        items: [
          ...demoNavItems,
          {
            id: 'custom',
            icon: Settings,
            label: 'Custom Section',
            children: [
              { id: 'option1', icon: Command, label: 'Option 1' },
              { id: 'option2', icon: Command, label: 'Option 2', badge: 3 },
            ],
          },
        ],
      }}
      topbar={{
        enabled: true,
        title: 'Custom Layout',
        showSearch: true,
        showNotifications: true,
        showProfile: true,
        actions: [
          {
            id: 'custom-action',
            icon: GitBranch,
            label: 'Branch: main',
            onClick: () => alert('Branch selector clicked!'),
          },
        ],
      }}
      bottombar={{
        enabled: true,
        connectionStatus,
        syncStatus,
        currentContext: 'development',
        selectedItems: 3,
        actions: [
          {
            id: 'toggle-connection',
            icon: connectionStatus === 'connected' ? Wifi : connectionStatus === 'connecting' ? Loader2 : WifiOff,
            label: 'Connection',
            onClick: cycleConnection,
            active: connectionStatus === 'connected',
          },
          {
            id: 'toggle-sync',
            icon: syncStatus === 'synced' ? CheckCircle2 : syncStatus === 'error' ? AlertCircle : Loader2,
            label: 'Sync',
            onClick: cycleSync,
            active: syncStatus === 'synced',
          },
        ],
        showVersion: true,
        version: '2.1.0-beta',
      }}
    >
      <DemoContent 
        title="Custom Layout"
        description="This is a custom layout with interactive status indicators. Try clicking the connection and sync buttons in the bottom bar!"
        variant="custom"
      >
        <div className="mt-6 space-y-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <h4 className="font-medium mb-2">Interactive Features</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Click connection status in bottom bar to cycle states
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Click sync status in bottom bar to cycle states
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Try keyboard navigation (Arrow keys, Enter, Escape)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Use Cmd+K to open global search
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Resize sidebar by dragging its right edge
              </li>
            </ul>
          </div>
        </div>
      </DemoContent>
    </ShellLayout>
  );
}

// =============================================================================
// Demo Content Component
// =============================================================================

interface DemoContentProps {
  title: string;
  description: string;
  variant?: 'default' | 'focus' | 'fullscreen' | 'ide' | 'custom';
  children?: React.ReactNode;
}

function DemoContent({ title, description, variant = 'default', children }: DemoContentProps) {
  const variants = {
    default: 'from-blue-500/20 to-purple-500/20',
    focus: 'from-emerald-500/20 to-teal-500/20',
    fullscreen: 'from-amber-500/20 to-orange-500/20',
    ide: 'from-violet-500/20 to-pink-500/20',
    custom: 'from-cyan-500/20 to-blue-500/20',
  };

  return (
    <div className="h-full flex items-center justify-center p-8 overflow-auto">
      <div className={cn(
        'max-w-2xl w-full p-8 rounded-2xl',
        'bg-gradient-to-br',
        variants[variant],
        'border border-white/10',
        'text-center'
      )}>
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-background/50 flex items-center justify-center">
          <Layout className="w-8 h-8 text-foreground" />
        </div>
        
        <h1 className="text-3xl font-bold mb-4">{title}</h1>
        <p className="text-lg text-muted-foreground mb-6">{description}</p>
        
        {children}
        
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <PanelLeft className="w-4 h-4" />
            <span>Sidebar</span>
          </div>
          <div className="flex items-center gap-2">
            <PanelRight className="w-4 h-4" />
            <span>Panels</span>
          </div>
          <div className="flex items-center gap-2">
            <PanelBottom className="w-4 h-4" />
            <span>Status</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Individual Component Showcase
// =============================================================================

export function SidebarShowcase() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="h-screen flex">
      <div className="h-full">
        <Sidebar
          items={demoNavItems}
          collapsible
          defaultOpen={isOpen}
          showToggle
          showLogo
        />
      </div>
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-4">Sidebar Component</h1>
        <p className="text-muted-foreground mb-4">
          The sidebar supports collapsible mode, nested navigation, badges, and keyboard navigation.
        </p>
        <Button onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? 'Collapse' : 'Expand'} Sidebar
        </Button>
      </div>
    </div>
  );
}

export function TopBarShowcase() {
  return (
    <div className="h-screen">
      <TopBar
        title="TopBar Component"
        breadcrumbs={[
          { label: 'Home', href: '#' },
          { label: 'Components', href: '#' },
          { label: 'TopBar' },
        ]}
        showSearch
        showNotifications
        showProfile
        actions={[
          {
            id: 'settings',
            icon: Settings,
            label: 'Settings',
            onClick: () => alert('Settings clicked!'),
          },
        ]}
      />
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">TopBar Component</h1>
        <p className="text-muted-foreground">
          The topbar includes search, notifications, profile menu, breadcrumbs, and custom actions.
          Try pressing Cmd+K to open the search modal!
        </p>
      </div>
    </div>
  );
}

export function BottomBarShowcase() {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connected');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-4">BottomBar Component</h1>
        <p className="text-muted-foreground mb-4">
          The bottombar shows connection status, sync status, context, and version info.
          Click the buttons below to change states:
        </p>
        <div className="flex gap-4">
          <Button onClick={() => {
            const states: ('connected' | 'connecting' | 'disconnected')[] = ['connected', 'connecting', 'disconnected'];
            const currentIndex = states.indexOf(connectionStatus);
            setConnectionStatus(states[(currentIndex + 1) % states.length]);
          }}>
            Toggle Connection
          </Button>
          <Button onClick={() => {
            const states: ('synced' | 'syncing' | 'offline' | 'error')[] = ['synced', 'syncing', 'offline', 'error'];
            const currentIndex = states.indexOf(syncStatus);
            setSyncStatus(states[(currentIndex + 1) % states.length]);
          }}>
            Toggle Sync
          </Button>
        </div>
      </div>
      <BottomBar
        connectionStatus={connectionStatus}
        syncStatus={syncStatus}
        currentContext="production"
        selectedItems={5}
        showVersion
        version="2.1.0"
      />
    </div>
  );
}
