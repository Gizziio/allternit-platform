# T2-A5: Workspace Panels

## Agent Role
Workspace Designer - Panel System

## Task
Create a resizable, draggable panel system for the IDE-like workspace.

## Deliverables

### 1. Panel System Architecture

Create: `6-ui/a2r-platform/src/shell/panels/`

```
src/shell/panels/
├── index.ts
├── PanelGroup.tsx        # Panel container
├── Panel.tsx             # Individual panel
├── PanelHeader.tsx       # Panel header with drag/controls
├── PanelResizeHandle.tsx # Resize handle
├── usePanelState.ts      # Panel state management
├── PanelContext.tsx      # Context provider
└── presets.ts            # Panel presets
```

### 2. Panel Group

Create: `6-ui/a2r-platform/src/shell/panels/PanelGroup.tsx`

```typescript
import { Panel, PanelGroup as ResizablePanelGroup, PanelResizeHandle as ResizableHandle } from 'react-resizable-panels';

interface PanelGroupProps {
  direction: 'horizontal' | 'vertical';
  children: React.ReactNode;
  className?: string;
}

export function PanelGroup({ direction, children, className }: PanelGroupProps) {
  return (
    <ResizablePanelGroup
      direction={direction}
      className={cn('flex', direction === 'horizontal' ? 'flex-row' : 'flex-col', className)}
    >
      {children}
    </ResizablePanelGroup>
  );
}
```

### 3. Workspace Panel

Create: `6-ui/a2r-platform/src/shell/panels/Panel.tsx`

```typescript
interface WorkspacePanelProps {
  id: string;
  title: string;
  icon?: IconName;
  children: React.ReactNode;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  collapsible?: boolean;
  tabs?: PanelTab[];
  onTabChange?: (tabId: string) => void;
  actions?: PanelAction[];
}

interface PanelTab {
  id: string;
  label: string;
  icon?: IconName;
  content: React.ReactNode;
}

interface PanelAction {
  id: string;
  icon: IconName;
  label: string;
  onClick: () => void;
}

export function WorkspacePanel({
  id,
  title,
  icon,
  children,
  defaultSize = 20,
  minSize = 10,
  maxSize = 80,
  collapsible = true,
  tabs,
  actions,
}: WorkspacePanelProps) {
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.id);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { getPanelSize, setPanelSize } = usePanelState();
  
  return (
    <Panel
      defaultSize={getPanelSize(id) || defaultSize}
      minSize={minSize}
      maxSize={maxSize}
      collapsible={collapsible}
      collapsedSize={5}
      onCollapse={() => setIsCollapsed(true)}
      onExpand={() => setIsCollapsed(false)}
      onResize={(size) => setPanelSize(id, size)}
      className="flex flex-col"
    >
      <PanelHeader
        title={title}
        icon={icon}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actions={actions}
      />
      
      {!isCollapsed && (
        <div className="flex-1 overflow-auto">
          {tabs ? (
            tabs.find(t => t.id === activeTab)?.content || children
          ) : (
            children
          )}
        </div>
      )}
    </Panel>
  );
}
```

### 4. Panel Header

Create: `6-ui/a2r-platform/src/shell/panels/PanelHeader.tsx`

```typescript
interface PanelHeaderProps {
  title: string;
  icon?: IconName;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  tabs?: PanelTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  actions?: PanelAction[];
  onDragStart?: () => void;
}

export function PanelHeader(props: PanelHeaderProps) {
  const { tabs, activeTab, onTabChange, actions } = props;
  
  return (
    <div className="panel-header h-9 flex items-center px-2 border-b border-white/10 bg-black/20">
      {/* Drag handle */}
      <div
        className="drag-handle cursor-grab active:cursor-grabbing p-1 hover:bg-white/5 rounded"
        onMouseDown={props.onDragStart}
      >
        <Icon name="grip-vertical" size="xs" className="text-muted" />
      </div>
      
      {/* Title or Tabs */}
      {tabs ? (
        <div className="flex items-center gap-1 ml-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              className={cn(
                'px-2 py-1 text-xs rounded flex items-center gap-1.5',
                activeTab === tab.id
                  ? 'bg-white/10 text-foreground'
                  : 'text-muted hover:text-foreground hover:bg-white/5'
              )}
            >
              {tab.icon && <Icon name={tab.icon} size="xs" />}
              <span className="max-w-24 truncate">{tab.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 ml-2">
          {props.icon && <Icon name={props.icon} size="xs" />}
          <span className="text-xs font-medium truncate">{props.title}</span>
        </div>
      )}
      
      <div className="flex-1" />
      
      {/* Actions */}
      <div className="flex items-center gap-1">
        {actions?.map(action => (
          <Button
            key={action.id}
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={action.onClick}
            title={action.label}
          >
            <Icon name={action.icon} size="xs" />
          </Button>
        ))}
        
        {/* Collapse toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={props.onToggleCollapse}
        >
          <Icon
            name={props.isCollapsed ? 'chevron-right' : 'chevron-left'}
            size="xs"
          />
        </Button>
      </div>
    </div>
  );
}
```

### 5. Custom Resize Handle

Create: `6-ui/a2r-platform/src/shell/panels/PanelResizeHandle.tsx`

```typescript
interface PanelResizeHandleProps {
  direction: 'horizontal' | 'vertical';
}

export function PanelResizeHandle({ direction }: PanelResizeHandleProps) {
  return (
    <ResizableHandle
      className={cn(
        'relative flex items-center justify-center transition-colors',
        direction === 'horizontal'
          ? 'w-1 -mx-0.5 hover:bg-white/10'
          : 'h-1 -my-0.5 hover:bg-white/10'
      )}
    >
      <div className={cn(
        'rounded-full bg-white/20',
        direction === 'horizontal' ? 'w-0.5 h-8' : 'h-0.5 w-8'
      )} />
    </ResizableHandle>
  );
}
```

### 6. Panel State Management

Create: `6-ui/a2r-platform/src/shell/panels/usePanelState.ts`

```typescript
interface PanelState {
  size: number;
  collapsed: boolean;
  activeTab?: string;
}

interface PanelsState {
  [panelId: string]: PanelState;
}

export function usePanelState() {
  const [state, setState] = useLocalStorage<PanelsState>('a2r-panels', {});
  
  const getPanelSize = useCallback((id: string): number | undefined => {
    return state[id]?.size;
  }, [state]);
  
  const setPanelSize = useCallback((id: string, size: number) => {
    setState(prev => ({
      ...prev,
      [id]: { ...prev[id], size },
    }));
  }, [setState]);
  
  const isPanelCollapsed = useCallback((id: string): boolean => {
    return state[id]?.collapsed ?? false;
  }, [state]);
  
  const setPanelCollapsed = useCallback((id: string, collapsed: boolean) => {
    setState(prev => ({
      ...prev,
      [id]: { ...prev[id], collapsed },
    }));
  }, [setState]);
  
  return {
    getPanelSize,
    setPanelSize,
    isPanelCollapsed,
    setPanelCollapsed,
  };
}
```

### 7. Panel Presets

Create: `6-ui/a2r-platform/src/shell/panels/presets.ts`

```typescript
export const panelPresets = {
  // IDE layout: left file tree, bottom terminal, right properties
  ide: {
    left: {
      enabled: true,
      defaultSize: 20,
      panels: [
        { id: 'explorer', title: 'Explorer', icon: 'folder' },
        { id: 'search', title: 'Search', icon: 'search' },
      ],
    },
    right: {
      enabled: true,
      defaultSize: 20,
      panels: [
        { id: 'properties', title: 'Properties', icon: 'settings' },
      ],
    },
    bottom: {
      enabled: true,
      defaultSize: 25,
      panels: [
        { id: 'terminal', title: 'Terminal', icon: 'terminal' },
        { id: 'output', title: 'Output', icon: 'output' },
        { id: 'problems', title: 'Problems', icon: 'alert' },
      ],
    },
  },
  
  // Chat layout: left conversations, main chat area
  chat: {
    left: {
      enabled: true,
      defaultSize: 25,
      panels: [
        { id: 'conversations', title: 'Conversations', icon: 'chat' },
      ],
    },
    right: { enabled: false },
    bottom: { enabled: false },
  },
  
  // Focus layout: minimal panels
  focus: {
    left: { enabled: false },
    right: { enabled: false },
    bottom: { enabled: false },
  },
};

export type PanelPreset = keyof typeof panelPresets;
```

### 8. IDE Workspace Layout

Create: `6-ui/a2r-platform/src/shell/layouts/IDEWorkspace.tsx`

```typescript
export function IDEWorkspace({ children }: { children: React.ReactNode }) {
  return (
    <div className="ide-workspace h-full flex flex-col">
      <PanelGroup direction="horizontal">
        {/* Left panel */}
        <WorkspacePanel
          id="left"
          title="Explorer"
          icon="folder"
          defaultSize={20}
          minSize={15}
          maxSize={40}
          tabs={[
            { id: 'files', label: 'Files', icon: 'folder', content: <FileExplorer /> },
            { id: 'search', label: 'Search', icon: 'search', content: <SearchPanel /> },
          ]}
        />
        
        <PanelResizeHandle direction="horizontal" />
        
        {/* Center panel */}
        <Panel defaultSize={60} minSize={30}>
          <PanelGroup direction="vertical">
            <Panel defaultSize={75} minSize={20}>
              {children}
            </Panel>
            
            <PanelResizeHandle direction="vertical" />
            
            {/* Bottom panel */}
            <WorkspacePanel
              id="bottom"
              title="Terminal"
              icon="terminal"
              defaultSize={25}
              minSize={10}
              maxSize={60}
              tabs={[
                { id: 'terminal', label: 'Terminal', icon: 'terminal', content: <TerminalPanel /> },
                { id: 'output', label: 'Output', icon: 'output', content: <OutputPanel /> },
              ]}
            />
          </PanelGroup>
        </Panel>
        
        <PanelResizeHandle direction="horizontal" />
        
        {/* Right panel */}
        <WorkspacePanel
          id="right"
          title="Properties"
          icon="settings"
          defaultSize={20}
          minSize={15}
          maxSize={40}
        />
      </PanelGroup>
    </div>
  );
}
```

### 9. Panel Content Components

Create placeholder content components:

```typescript
// FileExplorer.tsx - File tree
// SearchPanel.tsx - Search results
// TerminalPanel.tsx - Terminal emulator
// OutputPanel.tsx - Log output
// PropertiesPanel.tsx - Properties editor
```

## Integration

- Use `react-resizable-panels` (already in dependencies)
- Integrate with T2-A1 (Layout) for shell integration
- Integrate with T1-A3 (Glass) for panel styling
- Integrate with T1-A4 (Animation) for panel transitions

## Requirements

- Resizable panels with visual handles
- Collapsible panels (icon-only mode)
- Tabbed panels
- Panel state persistence
- Keyboard shortcuts for panel toggles
- Smooth animations

## Success Criteria
- [ ] PanelGroup component
- [ ] WorkspacePanel with tabs
- [ ] PanelHeader with actions
- [ ] Resize handles
- [ ] State persistence
- [ ] 3 layout presets
- [ ] IDEWorkspace layout
- [ ] No SYSTEM_LAW violations
