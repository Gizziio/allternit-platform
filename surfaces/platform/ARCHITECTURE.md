# 6-ui Architecture

> **Status**: Updated February 2026 - Post-Consolidation  
> **Note**: This document reflects the current structure after Rust → TypeScript consolidation. See [MIGRATION.md](../MIGRATION.md) for migration details.

---

## Overview

The 6-ui layer serves as the user interface layer for the A2R platform. This layer owns the user-facing UI platforms: shell components, shared UI kits, and UI components that render DAGs, receipts, and memory workflows. It provides the primary interaction surface for users with the A2R platform.

### Key Changes (February 2026)

- ✅ All Rust code from `6-ui/shell-ui/` has been **ported to TypeScript**
- ✅ New services: `browserEngine`, `budgetCalculator`, `poolManager`, `workflowEngine`
- ✅ New hooks: `useBudget`, `usePrewarm`, `useWorkflow`
- ✅ Original Rust code archived in `6-ui/_reference/shell-native-rust/`
- ✅ Clear separation: `6-ui/` (components) vs `7-apps/` (applications)

---

## Component Architecture

### Platform UI Components

#### `a2r-platform/`
- **Location**: `6-ui/a2r-platform/`
- **Purpose**: UI platform primitives, vendor wrappers, and business logic services
- **Components**:
  - Cross-platform UI primitives
  - Vendor-specific UI wrappers
  - Platform abstraction layers
  - UI component libraries
  - **NEW**: Business logic services (ported from Rust)
  - **NEW**: TypeScript type definitions (ported from Rust)
- **Dependencies**: Substrate types, shared utilities
- **Exported Types**: PlatformComponent, UiPrimitive, VendorWrapper
- **Exported Services**: BrowserEngine, BudgetCalculator, PoolManager, WorkflowEngine

#### Service Layer (NEW)

The `src/services/` directory contains business logic ported from the original Rust implementation:

| Service | File | Description | Ported From |
|---------|------|-------------|-------------|
| **browserEngine** | `services/browserEngine.ts` | Browser automation via API | `shell-ui/src/views/browserview/lib.rs` |
| **budgetCalculator** | `services/budgetCalculator.ts` | Budget metering calculations | `shell-ui/src/views/runtime/budget.rs` |
| **poolManager** | `services/poolManager.ts` | Prewarm pool lifecycle | `shell-ui/src/views/runtime/prewarm.rs` |
| **workflowEngine** | `services/workflowEngine.ts` | Workflow validation/layout | `shell-ui/src/views/workflow/designer.rs` |

#### Type Definitions (NEW)

The `src/types/` directory contains TypeScript types ported from Rust:

| File | Description | Ported From |
|------|-------------|-------------|
| `types/browser.ts` | BrowserView, Playwright types | `browserview/*.rs` |
| `types/runtime.ts` | Budget, Pool, Replay types | `runtime/*.rs` |
| `types/workflow.ts` | Designer, Monitor types | `workflow/*.rs` |

#### React Hooks (UPDATED)

The `src/hooks/` directory has been updated to use the new services:

| Hook | Service Used | Description |
|------|--------------|-------------|
| `useBudget.ts` | BudgetCalculator | Budget metering and quota management |
| `usePrewarm.ts` | PoolManager | Prewarm pool management |
| `useWorkflow.ts` | WorkflowEngine | Workflow design and validation |
| `useReplay.ts` | - | Replay session management |

### Canvas Monitoring

#### `canvas-monitor/`
- **Location**: `6-ui/canvas-monitor/`
- **Purpose**: Canvas monitoring and visualization tools
- **Components**:
  - Canvas state visualization
  - Real-time monitoring
  - Interactive canvas controls
  - Canvas workflow tracking
- **Dependencies**: Presentation kernel, substrate types

### Archived Code

#### `_reference/shell-native-rust/`
- **Location**: `6-ui/_reference/shell-native-rust/`
- **Purpose**: Archived original Rust code for reference
- **Contents**: Original `6-ui/shell-ui/` Rust implementation (~3,883 lines)
- **Status**: Not used in build, preserved for historical reference

---

## Data Flow Patterns

### UI Request Flow

```
┌─────────────┐    ┌─────────────────────────┐    ┌─────────────────────┐
│ User        │───▶│ React Component        │───▶│ Service (Business   │
│ Interaction │    │ (a2r-platform/views/)  │    │ Logic)              │
└─────────────┘    └─────────────────────────┘    └─────────────────────┘
                          │                               │
                          ▼                               ▼
                   ┌─────────────────────────┐    ┌─────────────────────┐
                   │ React Hook             │    │ Backend API         │
                   │ (useBudget, etc.)      │───▶│ (Playwright, etc.)  │
                   └─────────────────────────┘    └─────────────────────┘
```

### Service Integration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          REACT COMPONENT                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  useBudget(), usePrewarm(), useWorkflow()                             │  │
│  │  - React state management                                             │  │
│  │  - API calls                                                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SERVICE LAYER                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ BudgetCalc   │  │ PoolManager  │  │ WorkflowEng  │  │ BrowserEng   │    │
│  │ - calculate  │  │ - health     │  │ - validate   │  │ - navigate   │    │
│  │ - getStats   │  │ - lifecycle  │  │ - layout     │  │ - screenshot │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND API                                         │
│  /api/v1/budget/*  /api/v1/pools/*  /api/v1/workflows/*  /api/v1/browser/*   │
└─────────────────────────────────────────────────────────────────────────────┘
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

---

## Service Usage Examples

### BrowserEngine

```typescript
import { createBrowserEngine } from '@/services/browserEngine';

const engine = createBrowserEngine({ apiBaseUrl: '/api/v1' });
await engine.createSession({ viewport: { width: 1920, height: 1080 } });
await engine.navigate('https://example.com');
const capture = await engine.screenshot(true);
```

### BudgetCalculator

```typescript
import { createBudgetCalculator } from '@/services/budgetCalculator';

const calculator = createBudgetCalculator({ quotas: [...] });
const percentages = calculator.calculatePercentages('tenant-123');
const stats = calculator.getStats();
```

### PoolManager

```typescript
import { createPoolManager } from '@/services/poolManager';

const manager = createPoolManager({ apiBaseUrl: '/api/v1' });
const pool = await manager.createPool({ name: 'workers', image: 'node:18', pool_size: 5 });
const health = manager.calculateHealth(pool);
```

### WorkflowEngine

```typescript
import { createWorkflowEngine } from '@/services/workflowEngine';

const engine = createWorkflowEngine();
const validation = engine.validateWorkflow(nodes, edges);
const positions = engine.autoLayout(nodes, edges);
const executable = engine.compileToExecutable(draft);
```

---

## Hook Usage Examples

### useBudget

```typescript
import { useBudget } from '@/hooks';

function BudgetView() {
  const { quotas, stats, calculatePercentages, checkQuotaExceeded } = useBudget();
  const alertLevel = checkQuotaExceeded('tenant-123');
  return <div>{stats.total_cpu_hours} hours used</div>;
}
```

### usePrewarm

```typescript
import { usePrewarm } from '@/hooks';

function PoolView() {
  const { pools, createPool, getPoolsByHealth, calculateHealth } = usePrewarm();
  const healthyPools = getPoolsByHealth(PoolHealth.Healthy);
  return <PoolList pools={pools} />;
}
```

### useWorkflow

```typescript
import { useWorkflow } from '@/hooks';

function DesignerView() {
  const { validateDesign, autoLayout, wouldCreateCycle } = useWorkflow();
  return <Designer onValidate={validateDesign} />;
}
```

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

---

## Security Considerations

### UI Security
- Input sanitization for all user inputs
- XSS prevention for dynamic content
- Secure communication with services
- Authentication and authorization for UI features

### Data Protection
- Encryption for sensitive data in transit
- Secure handling of user credentials
- Data sanitization for display
- Secure disposal of temporary data

### Access Control
- Role-based access control for UI features
- Permission checks for all UI operations
- Audit trails for user actions
- Secure session management

---

## Performance Characteristics

### Latency Targets
- UI rendering: <100ms for simple components
- Canvas visualization: <200ms for complex visualizations
- Real-time updates: <50ms for live data
- User interaction response: <50ms for feedback
- Service calculations: <10ms (browser-side)

### Throughput Targets
- Concurrent users: 1000+ simultaneous sessions
- UI operations: 5,000 ops/sec
- Canvas updates: 1,000 updates/sec
- Real-time events: 10,000 events/sec

### Resource Usage
- Memory footprint: <200MB per user session
- CPU usage: <15% under normal load
- Bandwidth: Optimized with compression and caching

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

- [MIGRATION.md](../MIGRATION.md) - Migration guide
- [CONSOLIDATION_COMPLETE.md](../CONSOLIDATION_COMPLETE.md) - Consolidation summary
- [docs/SERVICES.md](../docs/SERVICES.md) - Service documentation
- [SHELL_UI_ANALYSIS.md](./SHELL_UI_ANALYSIS.md) - Analysis of old structure
