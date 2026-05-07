# SwarmADE (Agent Development Environment)

A unified agent orchestration interface with 6 view modes for managing AI agent swarms.

## Features

- **6 View Modes**: GRID, TOPOLOGY, KANBAN, CONSOLE, DETAIL, HISTORY
- **Real-time Data**: Connected to mode-specific session stores with SSE updates
- **Search & Filter**: By name, role, and status
- **Agent Actions**: Restart, stop, and view logs
- **Batch Operations**: Multi-select agents for bulk actions
- **Historical Metrics**: Recharts visualization of metrics over time
- **Agent Templates**: Save/load agent configurations
- **Data Export**: CSV, JSON, Markdown export
- **Virtualized Grid**: Handles 100+ agents efficiently
- **Error Boundaries**: Graceful error handling
- **Loading States**: Skeletons and progress indicators

## Usage

```tsx
import { SwarmADE } from '@/views/swarm';

function MyComponent() {
  return <SwarmADE />;
}
```

## View Modes

### GRID (Default)
Information-dense card layout showing all agents with:
- Role-based sizing (orchestrators = larger)
- Status pulse indicators
- Task progress bars
- Cost/token counters
- Batch selection mode (checkboxes)
- Virtualization for 100+ agents

### TOPOLOGY
Network relationship visualization with:
- SVG-based node graph
- Animated pulse lines
- Orbital layout
- Status indicators

### TIMELINE
Gantt-style task flow showing:
- Time-based task bars
- Agent lanes
- Current time indicator

### CONSOLE
Power-user metrics dashboard:
- Three-column layout
- Monospace fonts
- Real-time updating

### DETAIL
Deep agent inspection:
- Agent selector sidebar
- Detailed metrics
- Active task cards
- Action buttons (logs, restart, stop)

### HISTORY
Metrics over time with Recharts:
- Line/Area/Bar charts
- Time range selection (1h, 6h, 24h, 7d)
- Metric toggle (select which to display)
- Min/max/avg/current stats
- CSV/JSON export

## Batch Operations

Enable batch mode in the GRID view to perform actions on multiple agents:

1. Click "Batch Select" button
2. Select agents via checkboxes
3. Use "Restart" or "Stop" buttons

```tsx
import { useBatchSelection } from '@/views/swarm';

const { 
  isBatchMode, 
  selectedCount,
  toggleBatchMode,
  selectAll,
  batchRestart,
  batchStop 
} = useBatchSelection();
```

## Historical Metrics

Metrics are automatically sampled every 30 seconds and stored for 7 days:

```tsx
import { metricsHistory } from '@/views/swarm';

// Get all history
const data = metricsHistory.getHistory();

// Get aggregated data
const hourly = metricsHistory.getAggregated('1h');

// Get statistics
const stats = metricsHistory.getStats('throughput');
// { min: 2.1, max: 5.4, avg: 3.8, current: 4.2 }

// Export
const csv = metricsHistory.exportToCSV();
const json = metricsHistory.exportToJSON();
```

## Agent Templates

Save and reuse agent configurations:

```tsx
import { templateStorage } from '@/views/swarm';

// Create template
const template = templateStorage.create({
  name: 'Code Reviewer',
  description: 'Specialized in code review',
  role: 'reviewer',
  model: 'gpt-4o',
  capabilities: ['security-review', 'best-practices'],
  config: {},
});

// Get all templates
const templates = templateStorage.getAll();

// Search
const results = templateStorage.search('review');

// Export/Import
const json = templateStorage.exportToJSON();
templateStorage.importFromJSON(jsonString);
```

## Data Export

Export agents in multiple formats:

```tsx
import { exportAndDownloadAgents, copyToClipboard } from '@/views/swarm';

// Download as file
exportAndDownloadAgents(agents, 'csv', { filename: 'my-agents' });
exportAndDownloadAgents(agents, 'json');
exportAndDownloadAgents(agents, 'markdown');

// Copy to clipboard
await copyToClipboard(jsonString);
```

## State Management

```tsx
import { 
  useSwarmMonitorStore, 
  useAgents, 
  useMetrics,
  useFilters,
  useAgentActions,
  useRealtime,
  useBatchSelection,
} from '@/views/swarm';

// Access filtered agents
const agents = useAgents();

// Access metrics
const metrics = useMetrics();

// Use filters
const { searchQuery, setSearchQuery, clearFilters } = useFilters();

// Use agent actions
const { restartAgent, stopAgent, viewAgentLogs } = useAgentActions();

// Real-time connection
const { isConnected, connect, disconnect } = useRealtime();

// Batch selection
const { selectedIds, isBatchMode, toggleBatchMode } = useBatchSelection();
```

## Architecture

```
src/views/swarm/
├── types.ts                    # Type definitions
├── SwarmMonitor.store.ts       # Zustand store
├── SwarmADE.tsx                # Main component
├── lib/
│   ├── metrics-history.ts      # Historical metrics tracking
│   ├── template-storage.ts     # Agent template management
│   └── export-utils.ts         # Export utilities
├── components/
│   ├── VirtualizedGrid.tsx     # High-performance grid
│   ├── BatchToolbar.tsx        # Batch operations UI
│   ├── ExportPanel.tsx         # Export interface
│   ├── FilterBar.tsx           # Search & filters
│   └── ...
├── views/
│   ├── GridView.tsx
│   ├── TopologyView.tsx
│   ├── TimelineView.tsx
│   ├── ConsoleView.tsx
│   ├── DetailView.tsx
│   ├── HistoryView.tsx         # Recharts metrics
│   └── TemplatesView.tsx       # Template management
└── index.ts                    # Module exports
```

## Design Tokens

Uses Allternit design tokens:
- `MODE_COLORS.code.accent` - Primary accent (#d97757)
- `TEXT.primary` - Primary text
- `TEXT.secondary` - Secondary text
- `TEXT.tertiary` - Tertiary text

## Real-time Updates

The store automatically connects to SSE:

```tsx
useEffect(() => {
  const disconnect = connect();
  return () => disconnect();
}, [connect]);
```

The "LIVE" indicator shows when real-time updates are active.

## Performance

- **VirtualizedGrid**: Only renders visible agents (handles 100+ efficiently)
- **ResizeObserver**: Responsive column layout
- **Memoization**: Expensive calculations cached
- **Debounced updates**: Metrics sampled every 30s

## Error Handling

Error boundary wraps the component tree:

```tsx
import { SwarmErrorBoundary } from '@/views/swarm';

<SwarmErrorBoundary>
  <SwarmADE />
</SwarmErrorBoundary>
```

## Future Enhancements

- [x] Historical metrics charts
- [x] Custom topology layouts
- [x] Export metrics to CSV/JSON
- [x] Agent grouping/folders
- [x] Batch operations on multiple agents
- [ ] Mobile-responsive layouts
- [ ] Dark/light theme toggle
- [ ] Agent performance comparisons
