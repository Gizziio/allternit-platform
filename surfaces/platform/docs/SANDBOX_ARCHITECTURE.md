# Sandbox System Architecture

## Design Principles

1. **Security First** - All code runs in isolated environments
2. **Performance** - Sub-100ms startup for common use cases
3. **Automatic Selection** - No user configuration needed
4. **Graceful Degradation** - Falls back if primary method unavailable

## System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER REQUEST                                    │
│  Code: "import tensorflow as tf; model = tf.keras.Sequential()"             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SMART ANALYZER                                     │
│                                                                              │
│  1. Language Detection                                                       │
│     └─> Python (can use any tier)                                           │
│                                                                              │
│  2. Import Extraction                                                        │
│     └─> "tensorflow" detected                                               │
│                                                                              │
│  3. Package Analysis                                                         │
│     └─> tensorflow ∈ DOCKER_ONLY_PACKAGES                                   │
│                                                                              │
│  4. Decision: Docker Required                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AVAILABILITY CHECK                                    │
│                                                                              │
│  Docker Available? ──YES──> Use Docker Pool                                 │
│        │                                                                     │
│       NO                                                                     │
│        │                                                                     │
│        ▼                                                                     │
│  WebVM Available? ───YES──> Use WebVM                                       │
│        │                                                                     │
│       NO                                                                     │
│        │                                                                     │
│        ▼                                                                     │
│  WASM Available? ────YES──> Return Error (tensorflow not supported)        │
│        │                                                                     │
│       NO                                                                     │
│        │                                                                     │
│        ▼                                                                     │
│              Return "No Sandbox Available" Error                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXECUTION                                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  DOCKER POOL                                                         │   │
│  │  1. Acquire warm container (<50ms)                                  │   │
│  │  2. Install tensorflow                                              │   │
│  │  3. Execute code                                                    │   │
│  │  4. Return results                                                  │   │
│  │  5. Release container back to pool                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RESULT                                             │
│  {                                                                           │
│    success: true,                                                            │
│    output: "<tensorflow output>",                                            │
│    method: "docker",                                                         │
│    duration: 2450  // ms                                                     │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Decision Matrix

| Requirement | WASM | Docker | WebVM |
|-------------|------|--------|-------|
| **Language** ||||
| Python | ✅ | ✅ | ✅ |
| JavaScript | ❌ | ❌ | ✅ |
| Bash | ❌ | ❌ | ✅ |
| Rust | ❌ | ❌ | ✅ |
| **Libraries** ||||
| numpy/pandas | ✅ | ✅ | ✅ |
| matplotlib | ✅ | ✅ | ✅ |
| tensorflow | ❌ | ✅ | ✅ |
| torch | ❌ | ✅ | ✅ |
| requests | ❌ | ✅ | ✅ |
| flask/django | ❌ | ✅ | ✅ |
| **System Access** ||||
| File I/O (limited) | ✅ | ✅ | ✅ |
| Network | ❌ | ⚠️ | ✅ |
| apt-get | ❌ | ❌ | ✅ |
| sudo | ❌ | ❌ | ✅ |
| make/gcc | ❌ | ❌ | ✅ |
| **Performance** ||||
| Startup | ~100ms | ~50ms | ~3s |
| Memory | Browser | 512MB | Configurable |
| CPU | Shared | 1 core | Configurable |

## Component Details

### 1. Smart Analyzer

**File:** `src/lib/sandbox/smart-sandbox.ts`

**Responsibilities:**
- Parse Python imports
- Detect system command patterns
- Check package compatibility
- Route to appropriate sandbox

**Key Functions:**

```typescript
// Extracts all imports from Python code
extractImportsFromCode(code: string): string[]

// Checks if package requires Docker
requiresDockerPackage(pkg: string): boolean

// Main decision function
determineExecutionMethod(code, language, packages): "wasm" | "docker" | "webvm"
```

### 2. WASM Sandbox

**File:** `src/lib/sandbox/wasm-sandbox.ts`

**Technology:** Pyodide (WebAssembly Python)

**Best For:**
- Simple data analysis
- Educational Python
- Offline execution

**Limitations:**
- ~50MB download on first load
- Limited package support
- No network access

### 3. Docker Sandbox

**File:** `src/lib/sandbox/docker-sandbox.ts`

**Technology:** Docker containers via dockerode

**Best For:**
- Complex Python packages
- Network requests
- File operations

**Security:**
- No network (by default)
- 512MB RAM limit
- 30s timeout
- Ephemeral filesystem

### 4. Docker Pool

**File:** `src/lib/sandbox/sandbox-pool.ts`

**Technology:** Pre-warmed container pool

**Benefits:**
- Sub-100ms startup
- Connection reuse
- Resource efficiency

**Configuration:**
```typescript
{
  minSize: 2,      // Always keep 2 warm
  maxSize: 10,     // Maximum containers
  idleTimeout: 300000  // 5 minutes
}
```

### 5. WebVM Connector

**File:** `src/lib/sandbox/webvm-connector.ts`

**Technology:** WebVM Linux VM service

**Best For:**
- Multi-language support
- Full Linux environment
- Package installation

**Architecture:**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   UI / Agent    │────▶│  WebVM Service  │────▶│  Linux VM (x86) │
│                 │     │  (Rust/Axum)    │     │  (Browser WASM) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                              │
        │           WebSocket (xterm.js)               │
        └──────────────────────────────────────────────┘
```

## Security Model

### Threat Vectors & Mitigations

| Threat | Mitigation |
|--------|------------|
| **Resource Exhaustion** | Memory/CPU limits enforced |
| **Data Exfiltration** | Network disabled or monitored |
| **Host Compromise** | Container/VM isolation |
| **Persistence** | Ephemeral containers |
| **Privilege Escalation** | Non-root execution |
| **DoS** | Timeouts + rate limiting |

### Isolation Levels

```
┌─────────────────────────────────────────────────────────────┐
│  HOST SYSTEM                                                │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  DOCKER DAEMON                                         │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │  CONTAINER (isolated)                            │  │ │
│  │  │  ┌───────────────────────────────────────────┐  │  │ │
│  │  │  │  PYTHON PROCESS                            │  │  │ │
│  │  │  │  ┌─────────────────────────────────────┐  │  │  │ │
│  │  │  │  │  USER CODE                           │  │  │  │ │
│  │  │  │  └─────────────────────────────────────┘  │  │  │ │
│  │  │  └───────────────────────────────────────────┘  │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Performance Optimization

### Startup Time Breakdown

| Stage | WASM | Docker Pool | WebVM |
|-------|------|-------------|-------|
| Detection | 1ms | 1ms | 1ms |
| Pool Check | N/A | 5ms | 5ms |
| Container Creation | N/A | 0ms (warm) | N/A |
| VM Startup | N/A | N/A | 3000ms |
| Pyodide Load | 100ms | N/A | N/A |
| **Total** | **101ms** | **6ms** | **3006ms** |

### Optimization Strategies

1. **Pool Sizing**
   - Monitor usage patterns
   - Auto-scale based on demand
   - Pre-warm during low-traffic periods

2. **Package Caching**
   - Pre-install common packages
   - Layer Docker images
   - Share package downloads

3. **Lazy Loading**
   - Don't load Pyodide until needed
   - Defer Docker image pulls
   - On-demand WebVM initialization

## Error Handling

### Fallback Chain

```
WASM (target)
  │──► Not Available
  │     └──► Docker Pool
  │            │──► Not Available
  │            │     └──► WebVM
  │            │            │──► Not Available
  │            │            │     └──► Cold Docker
  │            │            │            │──► Not Available
  │            │            │            │     └──► Error: No Sandbox
```

### Recovery Strategies

| Error | Strategy |
|-------|----------|
| Pool Exhausted | Create new container (cold start) |
| Docker Unavailable | Switch to WebVM |
| Timeout | Kill container, return error |
| Out of Memory | Increase limit or use smaller dataset |
| Import Error | Suggest Docker for that package |

## Monitoring & Observability

### Metrics to Track

- Sandbox selection frequency by tier
- Average execution time by tier
- Pool hit rate
- Error rates by type
- Resource utilization

### Logging

```typescript
log.info({ 
  requestId, 
  method: "docker", 
  duration: 2450,
  packages: ["tensorflow"],
  poolSize: 5
}, "Code execution completed");
```

## Future Enhancements

1. **GPU Support**
   - CUDA-enabled containers
   - ML training acceleration

2. **Caching Layer**
   - Package cache sharing
   - Result caching for idempotent code

3. **Custom Sandboxes**
   - User-defined containers
   - Organization-specific packages

4. **Distributed Execution**
   - Remote sandbox workers
   - Load balancing

5. **Interactive Mode**
   - Jupyter notebook integration
   - Live code editing
