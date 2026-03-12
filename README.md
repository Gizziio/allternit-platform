# A2rchitect Platform

> **Enterprise Agentic Operating System**
> A comprehensive backend infrastructure for AI agents with a layered microservices architecture.

---

## Quick Start

```bash
# Install dependencies
./install.sh

# Start the development environment
make dev

# Or start individual services
cd 7-apps/shell && pnpm dev      # Shell web app
cd 6-ui/a2r-platform && pnpm dev  # UI component library
```

---

## Directory Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROJECT STRUCTURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  0-substrate/           # Layer 0: Foundational infrastructure              │
│  ├── a2r-substrate/     # Core runtime and helper utilities                 │
│  ├── a2r-intent-graph-kernel/  # Persistent graph of intent nodes          │
│  └── types/             # Shared TypeScript interfaces                      │
│                                                                             │
│  1-kernel/              # Layer 1: Execution engine, sandboxing             │
│                                                                             │
│  2-governance/          # Layer 2: Policy enforcement, WIH, receipts        │
│                                                                             │
│  3-adapters/            # Layer 3: Runtime boundaries, vendor adapters      │
│                                                                             │
│  4-services/            # Layer 4: Orchestration services                   │
│  ├── ai/                # AI services (voice, vision, operator)             │
│  ├── memory/            # State and context management                      │
│  ├── registry/          # Agent, skill, and tool definitions                │
│  └── orchestration/     # Kernel, workflow management                       │
│                                                                             │
│  5-agents/              # Layer 5: Agent implementations                    │
│                                                                             │
│  6-ui/                  # Layer 6: UI components and platform               │
│  ├── a2r-platform/      # React component library (main)                    │
│  │   ├── src/types/     # TypeScript types (browser, runtime, workflow)     │
│  │   ├── src/services/  # Business logic services                           │
│  │   ├── src/hooks/     # React hooks (useBudget, usePrewarm, useWorkflow)  │
│  │   └── src/views/     # React view components                             │
│  ├── _reference/        # Archived code                                     │
│  └── canvas-monitor/    # Canvas monitoring tools                           │
│                                                                             │
│  7-apps/                # Layer 7: Applications and entrypoints             │
│  ├── shell/             # Shell product family                              │
│  │   ├── web/           # Browser shell (@a2rchitech/shell-ui)              │
│  │   ├── desktop/       # Electron wrapper (@a2rchitech/shell)              │
│  │   └── terminal/      # TUI (terminal interface)                          │
│  ├── api/               # Rust API server (port 3000)                       │
│  ├── chrome-extension/  # Browser extension                                 │
│  └── launcher/          # App launcher                                      │
│                                                                             │
│  docs/                  # Documentation                                     │
│  ├── archive/           # Archived documentation                            │
│  └── SERVICES.md        # Service documentation                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## New Services (TypeScript)

The following services have been ported from the original Rust implementation in `6-ui/shell-ui` to TypeScript in `6-ui/a2r-platform/src/services/`:

### browserEngine
Browser automation service using Playwright via backend API.

**Location**: `6-ui/a2r-platform/src/services/browserEngine.ts`

```typescript
import { createBrowserEngine } from '@/services/browserEngine';

const engine = createBrowserEngine({ 
  apiBaseUrl: '/api/v1',
  onStateChange: (state) => console.log(state.current_url)
});

await engine.createSession({ viewport: { width: 1920, height: 1080 } });
await engine.navigate('https://example.com');
const screenshot = await engine.screenshot(true);
```

### budgetCalculator
Budget metering and quota management.

**Location**: `6-ui/a2r-platform/src/services/budgetCalculator.ts`

```typescript
import { createBudgetCalculator } from '@/services/budgetCalculator';

const calculator = createBudgetCalculator({ quotas: [...] });
const stats = calculator.getStats();
const percentages = calculator.calculatePercentages('tenant-123');
```

### poolManager
Prewarm pool lifecycle management.

**Location**: `6-ui/a2r-platform/src/services/poolManager.ts`

```typescript
import { createPoolManager } from '@/services/poolManager';

const manager = createPoolManager({ apiBaseUrl: '/api/v1' });
const pool = await manager.createPool({ name: 'worker-pool', image: 'node:18', pool_size: 5 });
const health = manager.calculateHealth(pool);
```

### workflowEngine
Workflow validation, auto-layout, and compilation.

**Location**: `6-ui/a2r-platform/src/services/workflowEngine.ts`

```typescript
import { createWorkflowEngine } from '@/services/workflowEngine';

const engine = createWorkflowEngine();
const validation = engine.validateWorkflow(nodes, edges);
const layout = engine.autoLayout(nodes, edges);
const executable = engine.compileToExecutable(draft);
```

### visualVerificationApi
Visual verification for A2R Autoland quality gates.

**Location**: `6-ui/a2r-platform/src/services/visualVerificationApi.ts`

```typescript
import { visualVerificationApi, useVisualVerification } from '@/services';

// API service
const result = await visualVerificationApi.getStatus('wih_123');
const trend = await visualVerificationApi.getTrendData('wih_123', { days: 7 });

// React hook
function VerificationPanel({ wihId }) {
  const { result, isLoading, trendData, refresh } = useVisualVerification({ wihId });
  return <VisualVerificationPanel status={result} trendData={trendData} />;
}
```

---

## React Hooks

### useBudget
Hook for budget management and quota tracking.

```typescript
import { useBudget } from '@/hooks';

function BudgetDashboard() {
  const { 
    quotas, usage, stats, 
    calculatePercentages, 
    checkQuotaExceeded,
    getCriticalAlerts 
  } = useBudget();
  
  return <div>{stats.total_cpu_hours} hours used</div>;
}
```

### usePrewarm
Hook for prewarm pool management.

```typescript
import { usePrewarm } from '@/hooks';

function PoolManager() {
  const { 
    pools, stats, activities,
    createPool, warmupPool,
    getPoolsByHealth, calculateHealth 
  } = usePrewarm();
  
  return <PoolList pools={pools} />;
}
```

### useWorkflow
Hook for workflow design and execution.

```typescript
import { useWorkflow } from '@/hooks';

function WorkflowDesigner() {
  const { 
    workflows, executions,
    validateDesign, autoLayout,
    compileWorkflow, wouldCreateCycle 
  } = useWorkflow();
  
  return <Designer onValidate={validateDesign} />;
}
```

### useVisualVerification
Hook for visual verification status and operations.

```typescript
import { useVisualVerification } from '@/hooks';

function VerificationDashboard({ wihId }) {
  const { 
    result, isLoading, isPolling,
    error, trendData,
    refresh, startVerification, requestBypass 
  } = useVisualVerification({ 
    wihId, 
    pollInterval: 3000,
    onComplete: (result) => console.log('Done!', result)
  });
  
  return (
    <VisualVerificationPanel 
      status={result}
      trendData={trendData}
      onRefresh={refresh}
      onRequestBypass={() => requestBypass('Emergency hotfix')}
    />
  );
}
```

---

## Build Instructions

### Shell Web App
```bash
cd 7-apps/shell/web
pnpm install
pnpm dev
```

### UI Platform (Component Library)
```bash
cd 6-ui/a2r-platform
pnpm install
pnpm build
```

### Rust Services
```bash
# Build all Rust services
cargo build --release

# Run specific service
cargo run -p a2r-api
```

---

## Migration Notes

The project has undergone significant restructuring. See [MIGRATION.md](./MIGRATION.md) for details on:
- What moved and where
- How to update imports
- Path mapping changes
- Using new hooks and services

---

## Architecture Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Platform-wide architecture
- [6-ui/ARCHITECTURE.md](./6-ui/ARCHITECTURE.md) - UI layer architecture
- [docs/SERVICES.md](./docs/SERVICES.md) - Service documentation
- [CONSOLIDATION_COMPLETE.md](./CONSOLIDATION_COMPLETE.md) - Consolidation summary

---

## Service Ports

| Service | Port | Language | Description |
|---------|------|----------|-------------|
| Gateway | 8013 | Python | API Gateway |
| API | 3000 | Rust | Public API |
| Kernel | 3004 | Rust | Execution engine |
| Memory | 3200 | Rust | State management |
| Registry | 8080 | Rust | Agent/skill registry |
| Voice | 8001 | Python | TTS service |
| WebVM | 8002 | Rust | WebAssembly VMs |
| Operator | 3010 | Python | Browser automation |
| Rails | 3011 | Rust | Agent task planning |
| Visual Verification | 50052 | TypeScript/gRPC | UI evidence capture |

---

## Contributing

See [AGENTS.md](./AGENTS.md) for agent-specific instructions.

---

## License

[Add license information]
