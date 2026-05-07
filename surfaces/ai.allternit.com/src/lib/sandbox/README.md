# Allternit Sandbox System

Multi-tier secure code execution for the allternit platform. Automatically selects the best execution environment based on code requirements.

## Overview

The sandbox system provides **secure, isolated code execution** with automatic tier selection:

```
User Code → Smart Analyzer → Best Sandbox Tier → Execution → Results
```

## Sandboxes (4 Tiers)

| Tier | Technology | Startup | Languages | Use Case |
|------|-----------|---------|-----------|----------|
| **1. WASM** | Pyodide | **~100ms** | Python | Simple scripts, numpy/pandas |
| **2. Docker Pool** | Warm containers | **~50ms** | Python | Complex pip packages |
| **3. WebVM** | Linux VM | **~3s** | Python/JS/Bash/Rust | Full Linux environment |
| **4. Cold Docker** | Fresh containers | 2-5s | Python | Fallback |

## Quick Start

```typescript
import { executeSmart, getSandboxStatus } from "@/lib/sandbox/smart-sandbox";

// Execute code (automatically selects best sandbox)
const result = await executeSmart({
  code: `
import numpy as np
import pandas as pd

data = np.random.randn(100)
df = pd.DataFrame({'values': data})
print(df.describe())
  `,
  requestId: "req-123",
  language: "python", // optional: "python" | "javascript" | "bash" | "rust"
});

console.log(result.method);   // "wasm" | "docker" | "webvm"
console.log(result.output);   // execution output
console.log(result.duration); // execution time in ms
```

## Smart Analyzer

The analyzer automatically detects code requirements:

### Language Detection
- `python` → Analyzed for imports/patterns
- `javascript`, `bash`, `rust` → Direct to WebVM

### Pattern Detection

| Pattern Type | Examples | Routes To |
|--------------|----------|-----------|
| **System Commands** | `apt-get`, `sudo`, `make`, `gcc` | WebVM |
| **Network I/O** | `requests`, `urllib`, `socket` | Docker |
| **Subprocess** | `subprocess`, `os.system` | Docker |
| **ML Libraries** | `tensorflow`, `torch`, `transformers` | Docker |
| **Data Science** | `numpy`, `pandas`, `matplotlib` | WASM |
| **Unknown Packages** | Any unrecognized import | Docker (safe) |

### Import Extraction

Handles all Python import syntax:

```python
import numpy                    ✓ Detected
import numpy as np              ✓ Detected
from pandas import DataFrame    ✓ Detected
from tensorflow import keras    ✓ Detected
import matplotlib.pyplot as plt ✓ Detected (matplotlib)
__import__("torch")            ✓ Detected
```

## Individual Sandboxes

### 1. WASM Sandbox (Pyodide)

```typescript
import { executeInWasmSandbox } from "@/lib/sandbox/wasm-sandbox";

const result = await executeInWasmSandbox({
  code: `
import numpy as np
arr = np.array([1, 2, 3])
print(arr.mean())
  `,
});
```

**Features:**
- Instant startup (~100ms after first load)
- Pre-loaded: numpy, pandas, matplotlib
- Browser-based (works offline)
- Limited package support

**Compatible Packages:**
- `numpy`, `pandas`, `matplotlib`, `scipy`, `scikit-learn`
- Python standard library (200+ modules)
- Pure Python packages

### 2. Docker Sandbox

```typescript
import { executeInSandbox } from "@/lib/sandbox/docker-sandbox";

const result = await executeInSandbox({
  code: `
import requests
from bs4 import BeautifulSoup

url = "https://example.com"
response = requests.get(url)
print(response.status_code)
  `,
  packages: ["requests", "beautifulsoup4"],
  requestId: "req-123",
});
```

**Features:**
- Full pip package support
- Network access (can be disabled)
- Resource limits (512MB RAM, 1 CPU)
- 30-second timeout
- Auto-cleanup

**Security:**
- No host filesystem access
- Network can be disabled
- Memory/CPU limits
- Container isolation

### 3. Docker Pool (Warm Containers)

```typescript
import { sandboxPool } from "@/lib/sandbox/sandbox-pool";

// Initialize at app startup
await sandboxPool.initialize();

// Get warm container (sub-100ms)
const container = await sandboxPool.acquire();

// Use container...

// Return to pool
await sandboxPool.release(container);

// Check pool status
const stats = sandboxPool.getStats();
// { total: 5, idle: 3, inUse: 2 }
```

**Configuration:**
```typescript
const pool = new SandboxPool({
  minSize: 2,           // Always keep 2 warm
  maxSize: 10,          // Max 10 containers
  idleTimeout: 300000,  // 5 minutes
  image: "python:3.11-slim",
});
```

### 4. WebVM Connector

```typescript
import { 
  createWebVMSession, 
  executeInWebVM,
  stopWebVMSession 
} from "@/lib/sandbox/webvm-connector";

// Create session
const session = await createWebVMSession({
  memoryMb: 512,
  cpuCores: 1,
});

// Execute code
const result = await executeInWebVM(
  session.sessionId,
  `
apt-get update
apt-get install -y nodejs
node -e "console.log('Hello from Node.js')"
  `,
  { language: "bash" }
);

// Cleanup
await stopWebVMSession(session.sessionId);
```

**Features:**
- Full Linux environment
- Multi-language support (Python, JS, Bash, Rust)
- Package manager access (apt-get)
- Browser-based VM

## Configuration

### Environment Variables

```bash
# .env
WEBVM_URL=http://localhost:8002    # WebVM service endpoint
```

### Feature Flags

```typescript
// src/lib/config.ts
integrations: {
  sandbox: true,  // Enable Docker sandbox
}
enableCodeExecution: true,  // Enable code execution tool
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Smart Sandbox                            │
│  ┌──────────────┬──────────────┬──────────────────────┐    │
│  │   Analyzer   │   Fallback   │   Availability Check │    │
│  └──────┬───────┴──────┬───────┴──────────┬───────────┘    │
└─────────┼──────────────┼──────────────────┼────────────────┘
          │              │                  │
     ┌────▼────┐    ┌────▼────┐       ┌─────▼─────┐
     │  WASM   │    │ Docker  │       │   WebVM   │
     │ Pyodide │◄───┤  Pool   │◄─────►│ Linux VM  │
     └─────────┘    └────┬────┘       └───────────┘
                         │
                    ┌────▼────┐
                    │  Cold   │
                    │ Docker  │
                    └─────────┘
```

## Testing

```bash
# Run sandbox tests
pnpm vitest run src/lib/sandbox/smart-sandbox.test.ts

# Expected output:
# ✓ 32 tests passed
# - Language detection
# - System command detection  
# - Network/IO detection
# - Package detection
# - Combined scenarios
# - Edge cases
```

## Security

| Sandbox | Isolation | Network | Resources | Persistence |
|---------|-----------|---------|-----------|-------------|
| WASM | Browser VM | ❌ Disabled | Limited | ❌ None |
| Docker | Container | ⚠️ Optional | Limited (512MB/1CPU) | ❌ Ephemeral |
| WebVM | Browser VM | ✅ Configurable | Configurable | ⚠️ Session-based |

All sandboxes:
- Run without root privileges
- Have resource limits enforced
- Auto-cleanup after execution
- Log all activity

## Troubleshooting

### Docker Not Available

```
Error: Docker is not available

Solution:
1. Install Docker: https://docs.docker.com/get-docker/
2. Start Docker daemon
3. Add user to docker group: sudo usermod -aG docker $USER
```

### WebVM Not Available

```
Error: WebVM service not available

Solution:
1. Start WebVM service:
   cd 3-adapters/bridges/allternit-webvm && cargo run
2. Or via docker-compose:
   docker-compose up webvm-service
```

### WASM Not Loading

```
Error: Pyodide failed to load

Solution:
1. Check internet connection (first load requires CDN)
2. Clear browser cache
3. Check browser console for errors
```

## Performance Benchmarks

| Operation | WASM | Docker Pool | WebVM | Cold Docker |
|-----------|------|-------------|-------|-------------|
| Startup | 100ms | 50ms | 3s | 2-5s |
| numpy import | 0ms* | 0ms* | 2s | 2s |
| HTTP request | N/A | 200ms | 300ms | 300ms |
| Chart render | 100ms | 150ms | 400ms | 400ms |

*Pre-loaded in warm containers

## API Reference

### `executeSmart(options)`

Main entry point for code execution.

```typescript
interface SmartSandboxOptions {
  code: string;                    // Code to execute
  requestId: string;               // Unique request ID
  language?: "python" | "javascript" | "bash" | "rust";
  packages?: string[];             // Extra packages to install
  preferredMethod?: "wasm" | "docker" | "webvm" | "auto";
}

interface SmartSandboxResult {
  success: boolean;
  output: string;
  error?: string;
  chart?: string;                  // Base64 PNG if generated
  method: "wasm" | "docker" | "webvm" | "none";
  duration: number;                // Execution time in ms
}
```

### `getSandboxStatus()`

Check availability of all sandbox types.

```typescript
const status = await getSandboxStatus();
// {
//   wasm: { available: true },
//   docker: { available: true, pool: { total: 5, idle: 3, inUse: 2 } },
//   webvm: { available: false }
// }
```

### `warmupSandboxes()`

Pre-warm sandboxes for faster response.

```typescript
await warmupSandboxes();
// Pre-loads WASM and warms Docker pool
```

## Contributing

When adding new sandboxes:

1. Implement sandbox interface
2. Add to `determineExecutionMethod()` analyzer
3. Add to fallback chain
4. Write tests
5. Update documentation

## License

MIT - Part of allternit Platform
