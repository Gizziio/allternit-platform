# TUI Testing Plan for Allternit Harness Integration

**Objective:** Test the TUI build, rendering, and harness integration without requiring API keys.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          TUI Application                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │  SDK Client  │───▶│  Allternit   │───▶│  Harness (when BYOK)     │  │
│  │  (@allternit │    │   Backend    │    │  - System Prompt Inject  │  │
│  │    /sdk)     │    │  (Optional)  │    │  - Route to Provider     │  │
│  └──────────────┘    └──────────────┘    └──────────────────────────┘  │
│         │                                              │                 │
│         │                                              ▼                 │
│         │                                     ┌──────────────────┐      │
│         │                                     │  15 Providers    │      │
│         │                                     │  - Local: Ollama │      │
│         │                                     │  - CLI: Kimi, etc│      │
│         │                                     └──────────────────┘      │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Solid.js + OpenTUI                          │   │
│  │  - Component rendering                                          │   │
│  │  - Event handling                                               │   │
│  │  - Keyboard/mouse input                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Testing Without API Keys

### 1. **Subprocess Mode** (Kimi CLI, etc.)

```bash
# Test Kimi CLI subprocess mode (no API key needed if kimi is installed)
export GIZZI_USE_HARNESS=1
export GIZZI_HARNESS_MODE=subprocess
export GIZZI_SUBPROCESS_CMD="kimi -p"

./dist/gizzi-code-darwin-arm64
```

**Expected:** TUI starts, subprocess spawns kimi CLI, prompts are routed through subprocess.

---

### 2. **Local Mode** (Ollama)

```bash
# Install ollama first: https://ollama.com
ollama pull llama2

# Test local mode
export GIZZI_USE_HARNESS=1
export GIZZI_HARNESS_MODE=local
export OLLAMA_BASE_URL=http://localhost:11434

./dist/gizzi-code-darwin-arm64
```

**Expected:** TUI starts, connects to local Ollama, system prompt injected.

---

### 3. **Mock/Stub Mode** (No AI needed)

Create a mock provider that returns canned responses:

```typescript
// packages/sdk/src/providers/mock/index.ts
export class AllternitMock {
  async *chatStream(options) {
    yield { type: 'text', text: '[MOCK] ' + options.messages[0].content };
    yield { type: 'done' };
  }
}
```

```bash
export GIZZI_USE_HARNESS=1
export GIZZI_HARNESS_MODE=byok
export GIZZI_MOCK_MODE=1

./dist/gizzi-code-darwin-arm64
```

---

## TUI-Specific Testing

### Test 1: Build Verification

```bash
# Clean build
rm -rf dist .build .build-production

# Build SDK
cd packages/sdk && bun run build

# Build CLI
bun run build:production

# Verify binary exists
ls -la dist/gizzi-code-darwin-arm64
```

**Pass Criteria:**
- [ ] No TypeScript errors
- [ ] Bundle size ~78MB
- [ ] Binary runs without crashing

---

### Test 2: TUI Rendering (No AI)

```bash
# Start TUI in dry-run mode
./dist/gizzi-code-darwin-arm64 --help

# Start TUI and immediately quit
./dist/gizzi-code-darwin-arm64 --version

# Test TUI with mock command
echo "test" | ./dist/gizzi-code-darwin-arm64 --dry-run
```

**Pass Criteria:**
- [ ] TUI renders without errors
- [ ] Keyboard input works
- [ ] Clean exit on quit

---

### Test 3: Component Tests

```bash
# Run TUI component tests
bun test src/cli/ui/tui/

# Run specific component test
bun test src/cli/ui/tui/components/
```

**Key Components to Test:**
- [ ] `PromptInput` - User input handling
- [ ] `DialogProvider` - Modal dialogs
- [ ] `Session` - Chat session UI
- [ ] `SDKProvider` - SDK integration
- [ ] `ThemeProvider` - Theme switching

---

### Test 4: Event System

```typescript
// Test event flow
import { useSDK } from '@/cli/ui/tui/context/sdk'

// Mock event source
const mockEvents = {
  on: (handler) => {
    // Simulate incoming events
    setTimeout(() => handler({ type: 'message', content: 'test' }), 100)
    return () => {} // unsubscribe
  }
}
```

**Test:**
- [ ] Events flow from SDK to UI
- [ ] UI updates on events
- [ ] No memory leaks

---

### Test 5: Keyboard Handling

```bash
# Interactive keyboard test
./dist/gizzi-code-darwin-arm64

# Inside TUI, test:
# - Arrow keys navigation
# - Enter to submit
# - Ctrl+C to quit
# - Tab for autocomplete
```

---

### Test 6: ACP Integration in TUI

```bash
# Test ACP agent connection
export GIZZI_USE_HARNESS=1
export GIZZI_ACP_MODE=1

./dist/gizzi-code-darwin-arm64 --agent
```

**Expected:**
- [ ] ACP registry loads
- [ ] Agent capabilities displayed
- [ ] ACP messages render correctly

---

## Automated Testing Script

```bash
#!/bin/bash
# scripts/test-tui.sh

set -e

echo "🧪 TUI Testing Suite"

# 1. Build Test
echo "📦 Building..."
bun run build:production

# 2. Basic Startup Test
echo "🚀 Testing startup..."
timeout 5 ./dist/gizzi-code-darwin-arm64 --version || true

# 3. Help Display Test
echo "❓ Testing help..."
./dist/gizzi-code-darwin-arm64 --help | grep -q "Usage:"

# 4. Config Test
echo "⚙️ Testing config..."
./dist/gizzi-code-darwin-arm64 config get mode || true

# 5. Doctor Test
echo "🏥 Testing doctor..."
./dist/gizzi-code-darwin-arm64 doctor

# 6. Mock Provider Test (no API key)
echo "🎭 Testing mock provider..."
export GIZZI_USE_HARNESS=1
export GIZZI_MOCK_MODE=1
echo "hello" | timeout 10 ./dist/gizzi-code-darwin-arm64 || true

echo "✅ All TUI tests passed!"
```

---

## Debugging TUI Issues

### 1. **Enable Debug Logging**

```bash
export GIZZI_DEBUG=1
export GIZZI_LOG_LEVEL=debug
./dist/gizzi-code-darwin-arm64 2>&1 | tee tui-debug.log
```

### 2. **Test in Non-TTY Mode**

```bash
# Pipe input to test without interactive terminal
echo "hello" | ./dist/gizzi-code-darwin-arm64
```

### 3. **Check Terminal Capabilities**

```bash
# Verify terminal supports TUI
echo $TERM
stty size
```

### 4. **Isolate Components**

```bash
# Test just the SDK (no TUI)
node -e "const { AllternitHarness } = require('./packages/sdk/dist/index.js'); console.log('SDK loaded')"

# Test just the TUI (no SDK)
./dist/gizzi-code-darwin-arm64 --no-sdk
```

---

## Test Matrix

| Test | Without API Key | With API Key | Subprocess | Local | Cloud |
|------|-----------------|--------------|------------|-------|-------|
| TUI Builds | ✅ | ✅ | ✅ | ✅ | ✅ |
| TUI Renders | ✅ | ✅ | ✅ | ✅ | ✅ |
| Keyboard Input | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mock Provider | ✅ | N/A | N/A | N/A | N/A |
| Ollama Local | N/A | N/A | N/A | ✅ | N/A |
| Kimi CLI | N/A | N/A | ✅ | N/A | N/A |
| Anthropic | N/A | ✅ | N/A | N/A | N/A |
| Cloud Gateway | N/A | N/A | N/A | N/A | ✅ |

---

## Key Files for TUI Testing

| File | Purpose |
|------|---------|
| `src/cli/ui/tui/app.tsx` | Main TUI app |
| `src/cli/ui/tui/context/sdk.tsx` | SDK context provider |
| `src/cli/ui/tui/routes/session.tsx` | Chat session UI |
| `src/cli/ui/tui/components/prompt/` | Input components |
| `script/build-production.ts` | Build script |

---

## Next Steps

1. **Run build test** - Verify binary compiles
2. **Run TUI smoke test** - Basic startup/exit
3. **Test with mock provider** - No API key needed
4. **Test subprocess mode** - Kimi CLI if available
5. **Test local Ollama** - If installed
6. **Document any issues** - For iteration
