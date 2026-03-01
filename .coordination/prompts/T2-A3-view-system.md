# T2-A3: View System

## Agent Role
View System Architect

## Task
Create a flexible view registry and routing system for the shell.

## Deliverables

### 1. View Registry System

Create: `6-ui/a2r-platform/src/shell/views/ViewRegistry.ts`

```typescript
// Type definitions
export interface ViewDefinition {
  id: string;
  label: string;
  icon?: IconName;
  component: React.ComponentType<ViewProps>;
  
  // Metadata
  category?: string;
  description?: string;
  keywords?: string[];
  
  // Behavior
  singleton?: boolean;      // Only one instance allowed
  persistent?: boolean;     // Keep in memory when hidden
  closable?: boolean;       // Can be closed
  
  // State
  defaultState?: Record<string, unknown>;
  
  // Lifecycle
  onOpen?: (view: ViewInstance) => void;
  onClose?: (view: ViewInstance) => void;
  onFocus?: (view: ViewInstance) => void;
}

export interface ViewInstance {
  id: string;
  definitionId: string;
  label: string;
  state: Record<string, unknown>;
  isActive: boolean;
  isDirty?: boolean;
  createdAt: Date;
}

// Registry implementation
class ViewRegistry {
  private definitions = new Map<string, ViewDefinition>();
  private instances = new Map<string, ViewInstance>();
  
  register(definition: ViewDefinition): void {
    this.definitions.set(definition.id, definition);
  }
  
  unregister(viewId: string): void {
    this.definitions.delete(viewId);
  }
  
  create(viewId: string, initialState?: Record<string, unknown>): ViewInstance {
    const def = this.definitions.get(viewId);
    if (!def) throw new Error(`View ${viewId} not registered`);
    
    const instance: ViewInstance = {
      id: nanoid(),
      definitionId: viewId,
      label: def.label,
      state: { ...def.defaultState, ...initialState },
      isActive: false,
      createdAt: new Date(),
    };
    
    this.instances.set(instance.id, instance);
    def.onOpen?.(instance);
    
    return instance;
  }
  
  close(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (!instance) return;
    
    const def = this.definitions.get(instance.definitionId);
    def?.onClose?.(instance);
    
    this.instances.delete(instanceId);
  }
  
  getDefinition(id: string): ViewDefinition | undefined {
    return this.definitions.get(id);
  }
  
  getInstance(id: string): ViewInstance | undefined {
    return this.instances.get(id);
  }
  
  getAllInstances(): ViewInstance[] {
    return Array.from(this.instances.values());
  }
  
  getActiveInstance(): ViewInstance | undefined {
    return this.getAllInstances().find(i => i.isActive);
  }
}

export const viewRegistry = new ViewRegistry();
```

### 2. View Router

Create: `6-ui/a2r-platform/src/shell/views/ViewRouter.tsx`

```typescript
interface ViewRouterProps {
  defaultView?: string;
  views: ViewDefinition[];
}

export function ViewRouter({ views, defaultView }: ViewRouterProps) {
  // Register all views
  useEffect(() => {
    views.forEach(view => viewRegistry.register(view));
  }, [views]);
  
  const { instances, activeInstance, openView, closeView, activateView } = useViewManager();
  
  return (
    <div className="view-router flex flex-col h-full">
      {/* View tabs */}
      <ViewTabs
        instances={instances}
        activeId={activeInstance?.id}
        onActivate={activateView}
        onClose={closeView}
      />
      
      {/* View content */}
      <div className="view-content flex-1 overflow-hidden relative">
        {instances.map(instance => {
          const definition = viewRegistry.getDefinition(instance.definitionId);
          if (!definition) return null;
          
          const Component = definition.component;
          const isActive = instance.id === activeInstance?.id;
          
          return (
            <div
              key={instance.id}
              className={cn(
                'absolute inset-0',
                isActive ? 'visible' : 'invisible'
              )}
            >
              <ViewContext.Provider value={instance}>
                <Component view={instance} isActive={isActive} />
              </ViewContext.Provider>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### 3. View Tabs

Create: `6-ui/a2r-platform/src/shell/views/ViewTabs.tsx`

```typescript
interface ViewTabsProps {
  instances: ViewInstance[];
  activeId?: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
}

export function ViewTabs({ instances, activeId, onActivate, onClose }: ViewTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  return (
    <div className="view-tabs h-10 glass border-b border-white/10 flex items-center">
      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="flex items-center px-2 gap-1">
          {instances.map(instance => {
            const definition = viewRegistry.getDefinition(instance.definitionId);
            const isActive = instance.id === activeId;
            
            return (
              <ViewTab
                key={instance.id}
                instance={instance}
                definition={definition}
                isActive={isActive}
                onActivate={() => onActivate(instance.id)}
                onClose={() => onClose(instance.id)}
              />
            );
          })}
        </div>
      </ScrollArea>
      
      {/* New view button */}
      <Button variant="ghost" size="icon" className="h-8 w-8">
        <Icon name="add" size="sm" />
      </Button>
    </div>
  );
}

function ViewTab({ instance, definition, isActive, onActivate, onClose }) {
  return (
    <motion.div
      layout
      onClick={onActivate}
      className={cn(
        'view-tab flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer text-sm',
        'transition-colors duration-150',
        isActive ? 'bg-white/10 text-foreground' : 'text-muted hover:text-foreground hover:bg-white/5'
      )}
    >
      {definition?.icon && <Icon name={definition.icon} size="sm" />}
      <span className="max-w-32 truncate">{instance.label}</span>
      {instance.isDirty && <span className="w-2 h-2 rounded-full bg-primary" />}
      
      {definition?.closable !== false && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-0.5"
        >
          <Icon name="close" size="xs" />
        </button>
      )}
    </motion.div>
  );
}
```

### 4. View State Persistence

Create: `6-ui/a2r-platform/src/shell/views/useViewState.ts`

```typescript
export function useViewState<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const view = useContext(ViewContext);
  if (!view) throw new Error('useViewState must be used within a View');
  
  const [state, setState] = useState<T>(() => {
    const saved = view.state[key];
    return saved !== undefined ? saved : defaultValue;
  });
  
  const setViewState = useCallback((value: T) => {
    setState(value);
    view.state[key] = value;
  }, [view, key]);
  
  return [state, setViewState];
}

// Auto-save view state
export function useAutoSaveViewState(debounceMs = 1000) {
  const view = useContext(ViewContext);
  const [isDirty, setIsDirty] = useState(false);
  
  useEffect(() => {
    if (!isDirty) return;
    
    const timeout = setTimeout(() => {
      saveViewState(view.id, view.state);
      view.isDirty = false;
      setIsDirty(false);
    }, debounceMs);
    
    return () => clearTimeout(timeout);
  }, [isDirty, view]);
  
  return { isDirty, markDirty: () => setIsDirty(true) };
}
```

### 5. View Manager Hook

Create: `6-ui/a2r-platform/src/shell/views/useViewManager.ts`

```typescript
interface ViewManager {
  instances: ViewInstance[];
  activeInstance: ViewInstance | null;
  openView: (viewId: string, state?: Record<string, unknown>) => ViewInstance;
  closeView: (instanceId: string) => void;
  activateView: (instanceId: string) => void;
  reorderViews: (newOrder: string[]) => void;
  duplicateView: (instanceId: string) => ViewInstance;
}

export function useViewManager(): ViewManager {
  const [instances, setInstances] = useState<ViewInstance[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const openView = useCallback((viewId: string, state?: Record<string, unknown>) => {
    const instance = viewRegistry.create(viewId, state);
    setInstances(prev => [...prev, instance]);
    setActiveId(instance.id);
    return instance;
  }, []);
  
  const closeView = useCallback((instanceId: string) => {
    viewRegistry.close(instanceId);
    setInstances(prev => {
      const index = prev.findIndex(i => i.id === instanceId);
      const newInstances = prev.filter(i => i.id !== instanceId);
      
      // Activate previous or next view
      if (activeId === instanceId && newInstances.length > 0) {
        const newIndex = Math.min(index, newInstances.length - 1);
        setActiveId(newInstances[newIndex]?.id || null);
      }
      
      return newInstances;
    });
  }, [activeId]);
  
  const activateView = useCallback((instanceId: string) => {
    setInstances(prev => prev.map(i => ({
      ...i,
      isActive: i.id === instanceId,
    })));
    setActiveId(instanceId);
  }, []);
  
  // ... other methods
  
  return {
    instances,
    activeInstance: instances.find(i => i.id === activeId) || null,
    openView,
    closeView,
    activateView,
    reorderViews: (newOrder) => { /* ... */ },
    duplicateView: (id) => { /* ... */ },
  };
}
```

### 6. Register Default Views

Create: `6-ui/a2r-platform/src/shell/views/default-views.ts`

```typescript
import { HomeView } from '../../views/home/HomeView';
import { ChatView } from '../../views/chat/ChatView';
import { AgentsView } from '../../views/agents/AgentsView';
import { WorkflowsView } from '../../views/workflows/WorkflowsView';
import { SettingsView } from '../../views/settings/SettingsView';

export const defaultViews: ViewDefinition[] = [
  {
    id: 'home',
    label: 'Home',
    icon: 'home',
    component: HomeView,
    singleton: true,
    persistent: true,
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: 'chat',
    component: ChatView,
    singleton: false,
    persistent: true,
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: 'agent',
    component: AgentsView,
    singleton: true,
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: 'workflow',
    component: WorkflowsView,
    singleton: true,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    component: SettingsView,
    singleton: true,
  },
];
```

## Integration

- Integrate with T2-A2 (Navigation) for route integration
- Integrate with T2-A1 (Layout) for view placement
- Integrate with existing views in `src/views/`

## Success Criteria
- [ ] ViewRegistry complete
- [ ] ViewRouter with tabs
- [ ] View state persistence
- [ ] useViewManager hook
- [ ] 5 default views registered
- [ ] View lifecycle hooks
- [ ] No SYSTEM_LAW violations
