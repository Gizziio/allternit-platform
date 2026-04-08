# 6-ui: User Interface Layer

> **Status**: Updated February 2026 - Post-Consolidation  
> **Migration Guide**: See [MIGRATION.md](../MIGRATION.md) for details on the new structure

The `6-ui` layer serves as the user interface layer for the A2R platform. This layer owns the user-facing UI platforms: shell, shared UI kits, and UI components that render DAGs, receipts, and memory workflows. It provides the primary interaction surface for users with the A2R platform.

---

## Purpose & Mission

The 6-ui layer is designed to provide:

- **User Interface**: Primary interaction surfaces for users with the A2R platform
- **Design System**: Consistent UI components and design patterns
- **Shell Applications**: Desktop and web-based shell environments
- **UI Components**: Reusable UI elements and widgets
- **Visualization**: Rendering of DAGs, receipts, memory workflows, and other platform data
- **Accessibility**: Accessible and intuitive user experiences
- **Business Logic**: TypeScript services for budget, pool, and workflow management

---

## Core Components

### Platform UI Components

#### `a2r-platform/` (Main Component Library)
- **Purpose**: UI platform primitives, vendor wrappers, and business logic services
- **Location**: `6-ui/a2r-platform/`
- **Key Features**:
  - Cross-platform UI primitives
  - Vendor-specific UI wrappers
  - Platform abstraction layers
  - UI component libraries
  - **NEW**: Business logic services (ported from Rust)
  - **NEW**: TypeScript type definitions (ported from Rust)
  - **NEW**: React hooks using services
- **Dependencies**: Substrate types, shared utilities
- **Exported Types**: PlatformComponent, UiPrimitive, VendorWrapper
- **Exported Services**: BrowserEngine, BudgetCalculator, PoolManager, WorkflowEngine

**Subdirectories:**
- `src/types/` - TypeScript type definitions (browser, runtime, workflow)
- `src/services/` - Business logic services (ported from Rust)
- `src/hooks/` - React hooks using services
- `src/views/` - React view components

### Canvas Monitoring

#### `canvas-monitor/`
- **Purpose**: Canvas monitoring and visualization tools
- **Location**: `6-ui/canvas-monitor/`
- **Key Features**:
  - Canvas state visualization
  - Real-time monitoring
  - Interactive canvas controls
  - Canvas workflow tracking
- **Dependencies**: Presentation kernel, substrate types
- **Exported Types**: CanvasMonitor, CanvasState, Visualization

### Archived Code

#### `_reference/shell-native-rust/` (ARCHIVED)
- **Purpose**: Archived original Rust code for reference
- **Location**: `6-ui/_reference/shell-native-rust/`
- **Contents**: Original `6-ui/shell-ui/` Rust implementation (~3,883 lines)
- **Status**: Not used in build, preserved for historical reference
- **Note**: All capabilities have been ported to TypeScript in `a2r-platform/`

### Support Systems

#### `stubs/`
- **Purpose**: Mock implementations for UI testing and development
- **Location**: `6-ui/stubs/`
- **Key Features**:
  - Mock UI components
  - Test UI configurations
  - Development environment helpers
  - UI integration test fixtures
- **Dependencies**: None (for testing)
- **Exported Types**: MockComponent, TestUi, DevStub

#### `ts/`
- **Purpose**: TypeScript-based UI implementations
- **Location**: `6-ui/ts/`
- **Key Features**:
  - Type-safe UI components
  - Frontend integration capabilities
  - Client-side UI logic
  - UI state management
- **Dependencies**: Substrate types, UI protocols
- **Exported Types**: TsComponent, UiState, FrontendLogic

---

## New Services (TypeScript)

The following services have been ported from the original Rust implementation in `6-ui/shell-ui` to TypeScript:

| Service | Location | Description | Hook |
|---------|----------|-------------|------|
| **browserEngine** | `src/services/browserEngine.ts` | Browser automation via API | - |
| **budgetCalculator** | `src/services/budgetCalculator.ts` | Budget metering calculations | `useBudget` |
| **poolManager** | `src/services/poolManager.ts` | Prewarm pool lifecycle | `usePrewarm` |
| **workflowEngine** | `src/services/workflowEngine.ts` | Workflow validation/layout | `useWorkflow` |

### Service Usage Example

```typescript
// Direct service usage
import { createBudgetCalculator } from '@/services/budgetCalculator';

const calculator = createBudgetCalculator({ quotas: [...] });
const percentages = calculator.calculatePercentages('tenant-123');
```

### Hook Usage Example

```typescript
// Via React hooks
import { useBudget } from '@/hooks';

function BudgetView() {
  const { stats, calculatePercentages, checkQuotaExceeded } = useBudget();
  return <div>{stats.total_cpu_hours} hours used</div>;
}
```

---

## Architectural Principles

### User-Centric Design
- Intuitive and accessible user interfaces
- Consistent design patterns across all UI components
- Responsive and adaptive layouts
- User workflow optimization

### Performance Optimized
- Efficient rendering and updates
- Minimal resource consumption
- Smooth animations and transitions
- Optimized data fetching and caching

### Cross-Platform Compatibility
- Consistent experience across platforms
- Platform-specific optimizations
- Responsive design for all screen sizes
- Accessibility compliance

### Integration Ready
- Seamless integration with platform services
- Real-time data synchronization
- Event-driven UI updates
- Consistent data flow patterns

---

## Directory Structure

```
6-ui/
├── a2r-platform/              # Main UI component library
│   ├── src/
│   │   ├── types/             # TypeScript types (ported from Rust)
│   │   │   ├── browser.ts     # BrowserView types
│   │   │   ├── runtime.ts     # Budget, Pool, Replay types
│   │   │   └── workflow.ts    # Workflow types
│   │   ├── services/          # Business logic services
│   │   │   ├── browserEngine.ts
│   │   │   ├── budgetCalculator.ts
│   │   │   ├── poolManager.ts
│   │   │   └── workflowEngine.ts
│   │   ├── hooks/             # React hooks
│   │   │   ├── useBudget.ts
│   │   │   ├── usePrewarm.ts
│   │   │   └── useWorkflow.ts
│   │   └── views/             # React components
│   └── ...
├── _reference/                # Archived code
│   └── shell-native-rust/     # Original Rust code (archived)
├── canvas-monitor/            # Canvas monitoring
├── stubs/                     # Mock implementations
└── ts/                        # TypeScript utilities
```

---

## Integration Points

### With Layer 0-Substrate
- Imports substrate types for standardized data structures
- Uses presentation kernel for canvas rendering
- Leverages substrate protocols for communication
- Access patterns: Direct imports of types and functions

### With Layer 1-Kernel
- Receives execution status updates from kernel
- Sends user commands to kernel services
- Displays kernel state and activity
- Access patterns: API calls and event subscriptions

### With Layer 2-Governance
- Displays governance decisions and policies
- Provides interfaces for governance workflows
- Shows compliance and audit information
- Access patterns: Governance API calls and event streams

### With Layer 3-Adapters
- Visualizes adapter status and activity
- Provides interfaces for external system integration
- Displays adapter performance metrics
- Access patterns: Adapter status APIs and event streams

### With Layer 4-Services
- Consumes service APIs for data and functionality
- Displays service status and metrics
- Provides interfaces for service configuration
- Access patterns: Service APIs and WebSocket connections

### With Layer 7-Apps
- Provides UI components to applications
- `7-apps/shell/web/` uses `a2r-platform` components
- `7-apps/shell/desktop/` wraps web components

---

## Quality Assurance

### Testing Strategy
- Unit tests for all UI components
- Unit tests for services (Vitest)
- Integration tests for UI-service interactions
- Visual regression testing for UI consistency
- Accessibility testing for compliance
- Performance testing for responsiveness

### Service Testing
```typescript
// Example: Testing BudgetCalculator
import { createBudgetCalculator } from '@/services/budgetCalculator';

describe('BudgetCalculator', () => {
  it('calculates percentages correctly', () => {
    const calculator = createBudgetCalculator({
      quotas: [{ tenant_id: 't1', cpu_seconds_limit: 100, ... }]
    });
    const pct = calculator.cpuUsagePercent('t1');
    expect(pct).toBeGreaterThanOrEqual(0);
  });
});
```

### Monitoring & Observability
- User interaction analytics
- Performance metrics for UI operations
- Error tracking for UI components
- User session monitoring
- Feature usage analytics

---

## Development Guidelines

### Adding New UI Components
1. Ensure the component follows design system guidelines
2. Follow existing UI patterns and interfaces
3. Implement proper accessibility features
4. Include comprehensive unit tests
5. Document the component's functionality

### Using Services
1. Prefer hooks for React components
2. Use services directly for non-React code
3. Import from `@/services` or `@/hooks`
4. See [MIGRATION.md](../MIGRATION.md) for examples

### Maintaining Existing Components
1. Preserve backward compatibility for public interfaces
2. Follow accessibility best practices
3. Update documentation when making changes
4. Ensure all tests pass before merging
5. Verify cross-browser compatibility

---

## Versioning & Release Strategy

The 6-ui follows semantic versioning (semver):
- Major versions: Breaking changes to public UI interfaces
- Minor versions: New UI components maintaining backward compatibility
- Patch versions: Bug fixes and accessibility improvements

---

## Migration Notes

For developers migrating from the old structure:

1. **Services**: Import from `@/services` instead of Rust FFI
2. **Types**: Import from `@/types` instead of Rust definitions
3. **Hooks**: Use new hooks (`useBudget`, `usePrewarm`, `useWorkflow`)
4. **Archived Code**: Original Rust code is in `6-ui/_reference/shell-native-rust/`

See [MIGRATION.md](../MIGRATION.md) for complete migration guide.

---

## Related Documentation

- [MIGRATION.md](../MIGRATION.md) - Migration guide for developers
- [docs/SERVICES.md](../docs/SERVICES.md) - Service API documentation
- [CONSOLIDATION_COMPLETE.md](../CONSOLIDATION_COMPLETE.md) - Consolidation summary
- [6-ui/ARCHITECTURE.md](./ARCHITECTURE.md) - Detailed architecture
- [6-ui/SHELL_UI_ANALYSIS.md](./SHELL_UI_ANALYSIS.md) - Historical analysis (archived)

---

## Future Evolution

Planned enhancements for the UI layer include:
- Enhanced accessibility with WCAG 2.1 AA compliance
- Advanced theming and customization options
- Improved performance with virtualized components
- Enhanced real-time collaboration features
- Advanced visualization capabilities for complex data
# Trigger build
# Deploy retry Tue Apr  7 11:00:22 CDT 2026
// Deployment trigger: Wed Apr  8 10:08:36 CDT 2026
// Deploy: Wed Apr  8 10:30:05 CDT 2026
