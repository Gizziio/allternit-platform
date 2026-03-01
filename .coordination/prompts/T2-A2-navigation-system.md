# T2-A2: Navigation System

## Agent Role
Navigation Designer - UX Flow

## Task
Create a comprehensive navigation system including command palette, breadcrumbs, and keyboard shortcuts.

## Deliverables

### 1. Command Palette (kbar Integration)

Create: `6-ui/a2r-platform/src/shell/navigation/CommandPalette.tsx`

```typescript
// Leverage existing kbar dependency
import { KBarProvider, KBarPortal, KBarPositioner, KBarAnimator, KBarSearch, useMatches, KBarResults } from 'kbar';

interface CommandPaletteProps {
  children: React.ReactNode;
  actions?: Action[];
}

interface Action {
  id: string;
  name: string;
  shortcut?: string[];
  keywords?: string;
  perform: () => void;
  icon?: IconName;
  subtitle?: string;
  section?: string;
}

export function CommandPaletteProvider({ children, actions }: CommandPaletteProps) {
  return (
    <KBarProvider actions={actions}>
      <CommandPalettePortal />
      {children}
    </KBarProvider>
  );
}

function CommandPalettePortal() {
  return (
    <KBarPortal>
      <KBarPositioner className="bg-black/50 backdrop-blur-sm z-50">
        <KBarAnimator className="w-full max-w-2xl glass-overlay rounded-lg shadow-2xl overflow-hidden">
          <div className="border-b border-white/10">
            <KBarSearch className="w-full px-4 py-4 bg-transparent text-lg outline-none placeholder:text-muted" />
          </div>
          <CommandResults />
        </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  );
}

function CommandResults() {
  const { results } = useMatches();
  
  return (
    <KBarResults
      items={results}
      onRender={({ item, active }) => (
        <div className={cn(
          'px-4 py-3 flex items-center gap-3 cursor-pointer',
          active && 'bg-white/10'
        )}>
          {item.icon && <Icon name={item.icon} size="sm" />}
          <div className="flex-1">
            <div className="font-medium">{item.name}</div>
            {item.subtitle && <div className="text-sm text-muted">{item.subtitle}</div>}
          </div>
          {item.shortcut && (
            <kbd className="px-2 py-1 text-xs glass rounded">
              {item.shortcut.join(' ')}
            </kbd>
          )}
        </div>
      )}
    />
  );
}
```

### 2. Default Actions Registry

Create: `6-ui/a2r-platform/src/shell/navigation/command-actions.ts`

```typescript
export const defaultActions: Action[] = [
  // Navigation
  {
    id: 'nav-home',
    name: 'Go to Home',
    shortcut: ['g', 'h'],
    keywords: 'home dashboard',
    perform: () => navigate('/'),
    icon: 'home',
  },
  {
    id: 'nav-settings',
    name: 'Open Settings',
    shortcut: ['g', 's'],
    keywords: 'settings preferences',
    perform: () => navigate('/settings'),
    icon: 'settings',
  },
  
  // Views
  {
    id: 'view-chat',
    name: 'Open Chat',
    shortcut: ['g', 'c'],
    keywords: 'chat conversation',
    perform: () => navigate('/chat'),
    icon: 'chat',
  },
  {
    id: 'view-agents',
    name: 'View Agents',
    shortcut: ['g', 'a'],
    keywords: 'agents bots',
    perform: () => navigate('/agents'),
    icon: 'agent',
  },
  {
    id: 'view-workflows',
    name: 'View Workflows',
    shortcut: ['g', 'w'],
    keywords: 'workflows pipelines',
    perform: () => navigate('/workflows'),
    icon: 'workflow',
  },
  
  // Actions
  {
    id: 'action-new-chat',
    name: 'New Chat',
    shortcut: ['n', 'c'],
    keywords: 'new chat conversation',
    perform: () => createNewChat(),
    icon: 'add',
  },
  {
    id: 'action-search',
    name: 'Search...',
    shortcut: ['mod', 'k'],
    keywords: 'search find',
    perform: () => toggleCommandPalette(),
    icon: 'search',
  },
  {
    id: 'action-close',
    name: 'Close Tab',
    shortcut: ['mod', 'w'],
    keywords: 'close tab',
    perform: () => closeCurrentTab(),
  },
  
  // Preferences
  {
    id: 'pref-theme',
    name: 'Toggle Theme',
    shortcut: ['mod', 'shift', 'l'],
    keywords: 'theme dark light mode',
    perform: () => toggleTheme(),
    icon: 'sun',
  },
  {
    id: 'pref-fullscreen',
    name: 'Toggle Fullscreen',
    shortcut: ['f11'],
    keywords: 'fullscreen',
    perform: () => toggleFullscreen(),
    icon: 'maximize',
  },
];
```

### 3. Breadcrumbs

Create: `6-ui/a2r-platform/src/shell/navigation/Breadcrumbs.tsx`

```typescript
interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: IconName;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: 'slash' | 'chevron' | 'arrow';
  maxItems?: number;
  itemsBeforeCollapse?: number;
  itemsAfterCollapse?: number;
}

export function Breadcrumbs({
  items,
  separator = 'chevron',
  maxItems = 5,
  itemsBeforeCollapse = 2,
  itemsAfterCollapse = 1,
}: BreadcrumbsProps) {
  const displayItems = items.length > maxItems
    ? [
        ...items.slice(0, itemsBeforeCollapse),
        { label: '...', isCollapsed: true },
        ...items.slice(items.length - itemsAfterCollapse),
      ]
    : items;

  return (
    <nav className="flex items-center text-sm">
      <ol className="flex items-center gap-2">
        {displayItems.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            {index > 0 && <BreadcrumbSeparator type={separator} />}
            <BreadcrumbItemComponent {...item} />
          </li>
        ))}
      </ol>
    </nav>
  );
}

function BreadcrumbItemComponent({ label, href, icon, isCollapsed }: BreadcrumbItem) {
  const content = (
    <>
      {icon && <Icon name={icon} size="xs" />}
      <span className={cn(
        'hover:text-foreground transition-colors',
        href ? 'cursor-pointer' : 'text-muted'
      )}>
        {label}
      </span>
    </>
  );
  
  if (isCollapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger>...</DropdownMenuTrigger>
        <DropdownMenuContent>
          {/* Collapsed items */}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  
  if (href) {
    return <Link href={href} className="flex items-center gap-1.5">{content}</Link>;
  }
  
  return <span className="flex items-center gap-1.5">{content}</span>;
}
```

### 4. Keyboard Shortcuts System

Create: `6-ui/a2r-platform/src/shell/navigation/useShortcuts.ts`

```typescript
import { useHotkeys } from 'react-hotkeys-hook';

interface ShortcutConfig {
  key: string;
  callback: () => void;
  options?: {
    preventDefault?: boolean;
    enabled?: boolean;
    scopes?: string[];
  };
}

export function useShortcuts(configs: ShortcutConfig[]) {
  configs.forEach(({ key, callback, options }) => {
    useHotkeys(key, callback, options);
  });
}

// Hook for single shortcut
export function useShortcut(key: string, callback: () => void, options?: any) {
  useHotkeys(key, callback, options);
}

// Global shortcuts registry
export const shortcutsRegistry = {
  // Navigation
  'go-home': { key: 'g h', description: 'Go to Home' },
  'go-settings': { key: 'g s', description: 'Go to Settings' },
  'go-back': { key: 'alt+left', description: 'Go back' },
  'go-forward': { key: 'alt+right', description: 'Go forward' },
  
  // Actions
  'search': { key: 'mod+k', description: 'Open Command Palette' },
  'new-chat': { key: 'n c', description: 'New Chat' },
  'close-tab': { key: 'mod+w', description: 'Close Tab' },
  'save': { key: 'mod+s', description: 'Save' },
  
  // UI
  'toggle-theme': { key: 'mod+shift+l', description: 'Toggle Theme' },
  'toggle-sidebar': { key: 'mod+b', description: 'Toggle Sidebar' },
  'fullscreen': { key: 'f11', description: 'Toggle Fullscreen' },
  'reload': { key: 'mod+r', description: 'Reload' },
  'dev-tools': { key: 'mod+shift+i', description: 'Developer Tools' },
  
  // Focus
  'focus-search': { key: 'mod+f', description: 'Focus Search' },
  'focus-chat': { key: 'mod+shift+c', description: 'Focus Chat Input' },
};
```

### 5. Shortcuts Help Modal

Create: `6-ui/a2r-platform/src/shell/navigation/ShortcutsHelp.tsx`

```typescript
export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  
  // Open with ? key
  useShortcut('?', () => setOpen(true));
  
  const grouped = groupBy(shortcutsRegistry, s => s.category);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, shortcuts]) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-muted mb-3">{category}</h3>
              <div className="space-y-2">
                {shortcuts.map(shortcut => (
                  <div key={shortcut.id} className="flex items-center justify-between">
                    <span>{shortcut.description}</span>
                    <ShortcutDisplay keys={shortcut.key} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutDisplay({ keys }: { keys: string }) {
  return (
    <div className="flex items-center gap-1">
      {keys.split(' ').map(key => (
        <kbd key={key} className="px-2 py-1 text-xs glass rounded">
          {key.replace('mod', '⌘').replace('shift', '⇧').replace('alt', '⌥')}
        </kbd>
      ))}
    </div>
  );
}
```

### 6. Navigation State

Create: `6-ui/a2r-platform/src/shell/navigation/useNavigation.ts`

```typescript
interface NavigationState {
  history: string[];
  currentIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;
}

export function useNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<NavigationState>({
    history: [location.pathname],
    currentIndex: 0,
    canGoBack: false,
    canGoForward: false,
  });
  
  const goBack = useCallback(() => {
    if (state.canGoBack) {
      navigate(state.history[state.currentIndex - 1]);
    }
  }, [state, navigate]);
  
  const goForward = useCallback(() => {
    if (state.canGoForward) {
      navigate(state.history[state.currentIndex + 1]);
    }
  }, [state, navigate]);
  
  return {
    ...state,
    goBack,
    goForward,
    navigate: (path: string) => {
      // Update history
      const newHistory = state.history.slice(0, state.currentIndex + 1);
      newHistory.push(path);
      setState({
        history: newHistory,
        currentIndex: newHistory.length - 1,
        canGoBack: newHistory.length > 1,
        canGoForward: false,
      });
      navigate(path);
    },
  };
}
```

### 7. Route Config

Create: `6-ui/a2r-platform/src/shell/navigation/routes.ts`

```typescript
export interface RouteConfig {
  path: string;
  label: string;
  icon: IconName;
  component: React.ComponentType;
  children?: RouteConfig[];
  hidden?: boolean;
  exact?: boolean;
}

export const routes: RouteConfig[] = [
  {
    path: '/',
    label: 'Home',
    icon: 'home',
    component: HomeView,
  },
  {
    path: '/chat',
    label: 'Chat',
    icon: 'chat',
    component: ChatView,
  },
  {
    path: '/agents',
    label: 'Agents',
    icon: 'agent',
    component: AgentsView,
  },
  {
    path: '/workflows',
    label: 'Workflows',
    icon: 'workflow',
    component: WorkflowsView,
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: 'settings',
    component: SettingsView,
  },
];
```

## Integration

- Integrate with T2-A1 (Layout) for sidebar navigation
- Integrate with T1-A5 (Icons) for icon system
- Integrate with existing kbar dependency

## Requirements

- Command palette opens with Cmd+K
- All shortcuts work cross-platform (Mac/Windows/Linux)
- Breadcrumbs auto-generate from route
- Navigation state persists

## Success Criteria
- [ ] Command palette with kbar
- [ ] 15+ default actions
- [ ] Breadcrumbs component
- [ ] Shortcuts registry
- [ ] Shortcuts help modal
- [ ] Navigation state hook
- [ ] Route configuration
- [ ] No SYSTEM_LAW violations
