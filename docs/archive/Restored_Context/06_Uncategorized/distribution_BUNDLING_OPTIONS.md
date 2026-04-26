# Allternit Platform - Bundling Options Comparison

## Three Approaches, Different Trade-offs

### Option A: Sidecar (Multi-Binary) ✅ RECOMMENDED FOR DEVELOPMENT

```
Allternit Platform.app/
├── Contents/
│   ├── MacOS/Allternit Platform (Electron - 150MB)
│   └── Resources/bin/allternit-api (Rust - 20MB)
```

**Pros:**
- Fastest build times
- Easy to debug (separate processes)
- Can update components independently
- Rust runs at full native performance
- Clear error messages

**Cons:**
- Two files, not one
- User sees two processes
- Slightly more complex install

**Use When:** Development, frequent updates, debugging needed

---

### Option B: Single Binary (Self-Extracting) ✅ RECOMMENDED FOR USERS

```
allternit-platform (Single executable - 180MB)
```

**How it works:**
1. Rust launcher embeds API binary as bytes (`include_bytes!`)
2. Embeds UI assets as compressed bytes
3. On first run: Extracts to `~/.cache/allternit-platform/`
4. Spawns API from extracted location
5. Starts HTTP server for UI
6. Opens browser

**Pros:**
- True single file
- Double-click to run
- User just downloads one file
- Self-contained
- Can cache extraction for fast startup

**Cons:**
- Slower first startup (extraction time)
- Larger file (compression helps)
- Temp files on disk
- Harder to debug (embedded)

**Use When:** Distribution to end users, "it just works" experience

---

### Option C: WebAssembly (WASM) in Electron

```
Allternit Platform.app/
└── Contents/MacOS/Allternit Platform (Electron + WASM - 100MB)
```

**How it works:**
1. Compile Rust API to WASM target
2. Load WASM in Electron's Node.js context
3. No separate process

**Pros:**
- Single process
- Smaller file size
- Sandboxed execution
- "True" single binary

**Cons:**
- Limited system access (no native APIs)
- Slower than native Rust
- Can't use some Rust crates
- Complex FFI bridge needed
- Harder to debug

**Use When:** You need true single-binary and can accept limitations

---

## Comparison Table

| Feature | Sidecar (A) | Single Binary (B) | WASM (C) |
|---------|-------------|-------------------|----------|
| **File Count** | 2+ | 1 | 1 |
| **File Size** | ~170MB | ~180MB | ~100MB |
| **First Startup** | Fast | Slow (extraction) | Fast |
| **Subsequent** | Fast | Fast (cached) | Fast |
| **Debuggability** | Easy | Medium | Hard |
| **Performance** | Native | Native | ~20-50% slower |
| **System Access** | Full | Full | Limited |
| **Build Time** | Fast | Slow | Medium |
| **User Experience** | Good | Excellent | Good |

---

## Recommendation

### For Development: Use Sidecar (Option A)

```bash
cd distribution
./build-electron.sh
```

- Fast iteration
- Easy debugging
- Can restart components independently

### For Production Release: Use Single Binary (Option B)

```bash
cd distribution
./build-single-binary.sh
```

- Users download one file
- Double-click to run
- Professional experience

### For Constrained Environments: Consider WASM (Option C)

- If you must have smallest file size
- If sandboxing is critical
- Accept performance trade-offs

---

## The "Why Not True Single Binary?" Explanation

**You asked why the sidecar isn't a single binary.** Here's the technical reality:

### The Problem

Electron (Chromium + Node.js) and Rust are **different runtimes**:

```
┌─────────────────────────────────────┐
│  Electron Runtime (V8 + libuv)      │
│  ├─ Chromium rendering engine       │
│  ├─ Node.js APIs                    │
│  └─ Your UI code                    │
└─────────────────────────────────────┘
           VS
┌─────────────────────────────────────┐
│  Rust Runtime (tokio runtime)       │
│  ├─ Async executor                  │
│  ├─ Memory allocator                │
│  └─ Your API code                   │
└─────────────────────────────────────┘
```

They can't be merged into one process because:
1. Different memory allocators
2. Different async runtimes
3. Different ABI (Application Binary Interface)
4. V8 vs native code execution

### The Solutions

**Sidecar (A):** Accept they're separate, manage them together

**Single Binary (B):** Embed one inside the other, extract at runtime

**WASM (C):** Compile Rust to WASM bytecode that V8 can run

**Pure Rust UI (D):** Build UI in Rust (egui, tauri, iced)
  - This gives TRUE single binary
  - But you'd rewrite the entire UI layer
  - Current Electron UI won't work

---

## My Recommendation for Allternit

**Use both:**

1. **Development:** Sidecar (fast builds, easy debugging)
2. **Production:** Single Binary (best user experience)

The single binary (`build-single-binary.sh`) gives users:
- One file to download
- Double-click to run
- Automatic extraction
- Cached for fast restarts

It's the best balance of:
- User experience (single file)
- Performance (native Rust)
- Maintainability (clear separation)

---

## Quick Start

```bash
# Build for development (sidecar)
./distribution/build-electron.sh

# Build for users (single binary)
./distribution/build-single-binary.sh

# Run the single binary
./dist/single-binary/allternit-platform
```
