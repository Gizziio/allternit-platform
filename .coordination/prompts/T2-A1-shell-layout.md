# T2-A1: Shell Layout System

## Agent Role
Layout Architect - Shell Structure

## Task
Create a responsive, flexible shell layout system for the A2rchitect desktop application.

## Deliverables

### 1. Shell Layout Architecture

Create: `6-ui/a2r-platform/src/shell/layout/`

```
src/shell/layout/
├── index.ts
├── ShellLayout.tsx       # Main layout wrapper
├── Sidebar.tsx           # Collapsible sidebar
├── TopBar.tsx            # Top navigation bar
├── BottomBar.tsx         # Status bar at bottom
├── PanelContainer.tsx    # Resizable panels
├── useLayout.ts          # Layout state hook
└── layout-context.tsx    # Layout context provider
```

### 2. ShellLayout Component

Create: `6-ui/a2r-platform/src/shell/layout/ShellLayout.tsx`

```typescript
interface ShellLayoutProps {
  children: React.ReactNode;
  
  // Layout configuration
  sidebar?: {
    enabled: boolean;
    defaultOpen?: boolean;
    width?: number;
    collapsible?: boolean;
  };
  
  topbar?: {
    enabled: boolean;
    height?: number;
  };
  
  bottombar?: {
    enabled: boolean;
    height?: number;
  };
  
  panels?: {
    left?: PanelConfig;
    right?: PanelConfig;
    bottom?: PanelConfig;
  };
  
  // Responsive breakpoints
  breakpoints?: {
    sidebarHide?: number;
    panelStack?: number;
  };
}

export function ShellLayout({ children, ...config }: ShellLayoutProps) {
  return (
    <LayoutProvider config={config}>
      <div className="shell-layout h-screen w-screen flex flex-col overflow-hidden">
        {config.topbar?.enabled && <TopBar />}
        
        <div className="flex flex-1 overflow-hidden">
          {config.sidebar?.enabled && <Sidebar />}
          
          <main className="flex-1 flex flex-col overflow-hidden">
            <PanelContainer position="left" />
            
            <div className="flex-1 overflow-auto">
              {children}
            </div>
            
            <PanelContainer position="right" />
          </main>
        </div>
        
        <PanelContainer position="bottom" />
        {config.bottombar?.enabled && <BottomBar />}
      </div>
    </LayoutProvider>
  );
}
```

### 3. Sidebar Component

Create: `6-ui/a2r-platform/src/shell/layout/Sidebar.tsx`

```typescript
interface SidebarProps {
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
}

interface SidebarItem {
  id: string;
  icon: IconName;
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  badge?: number;
  children?: SidebarItem[];
}

export function Sidebar({ items, ...props }: SidebarProps) {
  const { isOpen, toggle, width } = useSidebar();
  
  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? width : props.collapsedWidth || 64 }}
      transition={{ duration: 0.2 }}
      className="sidebar glass-raised border-r border-white/10"
    >
      {/* Header with logo */}
      {/* Navigation items */}
      {/* Footer */}
    </motion.aside>
  );
}
```

Features:
- Collapsible (icon-only mode)
- Nested navigation support
- Active state highlighting
- Badge support on items
- Keyboard navigation (↑↓, Enter, Escape)
- Drag to resize width
- Mobile drawer mode

### 4. TopBar Component

Create: `6-ui/a2r-platform/src/shell/layout/TopBar.tsx`

```typescript
interface TopBarProps {
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
}

export function TopBar(props: TopBarProps) {
  return (
    <header className="topbar h-14 glass-floating border-b border-white/10 flex items-center px-4">
      <div className="flex items-center gap-4">
        {props.showMenuToggle && <MenuToggle />}
        {props.left}
      </div>
      
      <div className="flex-1 flex items-center justify-center">
        {props.breadcrumbs && <Breadcrumbs items={props.breadcrumbs} />}
        {props.title && <h1 className="text-lg font-semibold">{props.title}</h1>}
        {props.center}
      </div>
      
      <div className="flex items-center gap-2">
        {props.showSearch && <GlobalSearch />}
        {props.showNotifications && <NotificationBell />}
        {props.showProfile && <ProfileMenu />}
        {props.right}
      </div>
    </header>
  );
}
```

### 5. BottomBar (Status Bar)

Create: `6-ui/a2r-platform/src/shell/layout/BottomBar.tsx`

```typescript
interface BottomBarProps {
  // Status indicators
  connectionStatus?: 'connected' | 'connecting' | 'disconnected';
  syncStatus?: 'synced' | 'syncing' | 'offline';
  
  // Context info
  currentContext?: string;
  selectedItems?: number;
  
  // Actions
  actions?: BottomBarAction[];
  
  // Right section
  right?: React.ReactNode;
  showVersion?: boolean;
}

export function BottomBar(props: BottomBarProps) {
  return (
    <footer className="bottombar h-8 glass border-t border-white/10 flex items-center px-3 text-xs">
      <div className="flex items-center gap-4">
        <ConnectionStatus status={props.connectionStatus} />
        <SyncStatus status={props.syncStatus} />
        {props.currentContext && <ContextDisplay context={props.currentContext} />}
        {props.selectedItems !== undefined && (
          <span>{props.selectedItems} selected</span>
        )}
      </div>
      
      <div className="flex-1" />
      
      <div className="flex items-center gap-3">
        {props.actions?.map(action => <BottomBarAction key={action.id} {...action} />)}
        {props.showVersion && <VersionDisplay />}
        {props.right}
      </div>
    </footer>
  );
}
```

### 6. Panel Container

Create: `6-ui/a2r-platform/src/shell/layout/PanelContainer.tsx`

```typescript
interface PanelConfig {
  id: string;
  title: string;
  icon?: IconName;
  content: React.ReactNode;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  resizable?: boolean;
  collapsible?: boolean;
}

interface PanelContainerProps {
  position: 'left' | 'right' | 'bottom';
  panels?: PanelConfig[];
}

export function PanelContainer({ position, panels }: PanelContainerProps) {
  // Resizable panel group
  return (
    <ResizablePanelGroup direction={position === 'bottom' ? 'vertical' : 'horizontal'}>
      {panels?.map(panel => (
        <ResizablePanel key={panel.id} defaultSize={panel.defaultSize}>
          <Panel {...panel} />
        </ResizablePanel>
      ))}
    </ResizablePanelGroup>
  );
}
```

### 7. Layout State Management

Create: `6-ui/a2r-platform/src/shell/layout/useLayout.ts`

```typescript
interface LayoutState {
  sidebar: {
    open: boolean;
    width: number;
  };
  panels: {
    left: { open: boolean; size: number };
    right: { open: boolean; size: number };
    bottom: { open: boolean; size: number };
  };
  activeView: string;
}

export function useLayout() {
  const [state, setState] = useLocalStorage<LayoutState>('a2r-layout', defaultLayout);
  
  return {
    ...state,
    toggleSidebar: () => setState(s => ({ ...s, sidebar: { ...s.sidebar, open: !s.sidebar.open } })),
    setSidebarWidth: (width: number) => setState(s => ({ ...s, sidebar: { ...s.sidebar, width } })),
    togglePanel: (position: 'left' | 'right' | 'bottom') => { ... },
    setPanelSize: (position, size) => { ... },
  };
}
```

### 8. Responsive Behavior

```typescript
// Breakpoint handling
function useResponsiveLayout() {
  const { width } = useWindowSize();
  
  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    sidebarMode: width < 768 ? 'drawer' : width < 1024 ? 'collapsed' : 'full',
  };
}

// Mobile drawer sidebar
function MobileSidebar({ children }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon"><Icon name="menu" /></Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        {children}
      </SheetContent>
    </Sheet>
  );
}
```

### 9. Layout Presets

Create preset configurations:

```typescript
export const layoutPresets = {
  // Default: Sidebar + main content
  default: {
    sidebar: { enabled: true, defaultOpen: true, width: 256 },
    topbar: { enabled: true },
    bottombar: { enabled: true },
  },
  
  // Focus: Minimal chrome
  focus: {
    sidebar: { enabled: true, defaultOpen: false },
    topbar: { enabled: true },
    bottombar: { enabled: false },
  },
  
  // Fullscreen: No chrome
  fullscreen: {
    sidebar: { enabled: false },
    topbar: { enabled: false },
    bottombar: { enabled: false },
  },
  
  // IDE: Panels on all sides
  ide: {
    sidebar: { enabled: true },
    topbar: { enabled: true },
    bottombar: { enabled: true },
    panels: {
      left: { enabled: true, size: 20 },
      right: { enabled: true, size: 20 },
      bottom: { enabled: true, size: 25 },
    },
  },
};
```

### 10. Layout Showcase

Create: `6-ui/a2r-platform/src/dev/layout-showcase.tsx`

Demo all layout configurations:
- Default layout
- Collapsed sidebar
- Panel configurations
- Mobile responsive
- Fullscreen mode

## Integration

Coordinate with:
- T1-A3 (Glass System) for visual styling
- T1-A4 (Animation) for transitions
- T1-A5 (Icons) for navigation icons
- T2-A3 (View System) for view integration

## Requirements

- Must be responsive (mobile, tablet, desktop)
- Must persist layout state
- Must support keyboard navigation
- Must be GPU-accelerated animations
- Must work in both light/dark modes

## Success Criteria
- [ ] ShellLayout component complete
- [ ] Sidebar with collapse/expand
- [ ] TopBar with all sections
- [ ] BottomBar with status
- [ ] Panel container with resize
- [ ] Layout state persistence
- [ ] Responsive behavior
- [ ] 4 layout presets
- [ ] No SYSTEM_LAW violations
