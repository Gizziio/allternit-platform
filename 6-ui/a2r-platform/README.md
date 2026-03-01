# A2R Platform

AI-powered workspace for the A2rchitect ecosystem.

## Features

- **Multi-Modal AI Chat** - Text, images, file uploads
- **Browser Automation** - Via A2R Operator (port 3010)
- **Code Execution** - Multi-tier sandbox system (WASM, Docker, WebVM)
- **Document Management** - Create and edit code/text/sheet documents
- **Agent System** - Kernel-based agent orchestration

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Services Integration

| Service | Port | Purpose |
|---------|------|---------|
| A2R Operator | 3010 | Browser automation, code execution |
| Kernel | 3004 | Agent orchestration |
| WebVM | 8002 | Full Linux VM (optional) |

## Documentation

- [Sandbox System](./src/lib/sandbox/README.md) - Secure code execution
- [Sandbox Architecture](./docs/SANDBOX_ARCHITECTURE.md) - Technical details
- [Sandbox Quick Reference](./docs/SANDBOX_QUICK_REFERENCE.md) - Common patterns

## Code Execution

The platform provides **secure, isolated code execution** with automatic sandbox selection:

```typescript
// Example: Execute Python code
const result = await executeSmart({
  code: `
import numpy as np
import pandas as pd

data = np.random.randn(100)
df = pd.DataFrame({'values': data})
print(df.describe())
  `,
  requestId: "analysis-123"
});

// Automatically routes to:
// - WASM (~100ms): Simple scripts
// - Docker (~50ms): Complex packages
// - WebVM (~3s): Full Linux
```

### Sandboxes

| Tier | Technology | Startup | Languages |
|------|-----------|---------|-----------|
| WASM | Pyodide | ~100ms | Python |
| Docker | Containers | ~50ms | Python |
| WebVM | Linux VM | ~3s | Python/JS/Bash/Rust |

## Development

```bash
# Run type checker
pnpm run typecheck

# Run tests
pnpm vitest run

# Build for production
pnpm build
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    A2R Platform (UI)                     │
├─────────────────────────────────────────────────────────┤
│  Views: ChatView | CoworkView | CodeCanvas | AgentView  │
├─────────────────────────────────────────────────────────┤
│  AI SDK Elements + Custom Components                     │
├─────────────────────────────────────────────────────────┤
│  Sandbox System | Tools | Kernel Adapter                │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
     ┌──────────┐    ┌──────────┐   ┌──────────┐
     │ A2R Op   │    │ Kernel   │   │ WebVM    │
     │ :3010    │    │ :3004    │   │ :8002    │
     └──────────┘    └──────────┘   └──────────┘
```

## License

MIT
