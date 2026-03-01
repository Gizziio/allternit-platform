# Tool Registration & Integration Guide

**How to Register Tools for TUI, GUI, and Agent Use**

**Date:** February 26, 2026

---

## 📋 OVERVIEW

This guide explains how to:
1. **Register** a tool in the A2Rchitech tool registry
2. **Wire** it to the TUI for command-line use
3. **Wire** it to the GUI for visual interaction
4. **Make it available** to agents for autonomous use
5. **Use it deterministically** with proper error handling

---

## 🏗️ ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                    TOOL REGISTRY (JSON)                         │
│  tools/tool_registry.json                                       │
│  - Tool definitions with schemas                                │
│  - Entrypoint paths                                             │
│  - Security policies                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    TOOL GATEWAY (Rust)                          │
│  4-services/io-service/src/lib.rs                               │
│  - Loads tools from registry                                    │
│  - Validates schemas                                            │
│  - Enforces policies                                            │
│  - Executes tools                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
┌───────────────┐   ┌─────────────────┐   ┌───────────────┐
│     TUI       │   │      API        │   │     GUI       │
│ 7-apps/cli    │   │ 7-apps/api      │   │ 6-ui/a2r-plat │
│               │   │                 │   │               │
│ /tools exec   │   │ POST /tools/    │   │ useTool()     │
│               │   │ execute         │   │ hook          │
└───────────────┘   └─────────────────┘   └───────────────┘
        ↓                     ↓                     ↓
┌─────────────────────────────────────────────────────────────────┐
│                      AGENTS                                     │
│  Any agent can call tools via:                                  │
│  - Direct tool execution                                        │
│  - Workflow definitions                                         │
│  - Skill definitions                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📝 STEP 1: CREATE TOOL IMPLEMENTATION

**Location:** `tools/<tool-name>/mod.ts`

Example (agent-browser):
```typescript
// tools/agent-browser/mod.ts

export const tool = {
  id: "agent-browser.automation",
  title: "Agent Browser Automation",
  description: "Control a headless browser",
  kind: "write",
  safety_level: "caution",
};

export const inputSchema = z.object({
  action: z.enum(["open", "snapshot", "click", "fill", "screenshot"]),
  url: z.string().optional(),
  selector: z.string().optional(),
  value: z.string().optional(),
  path: z.string().optional(),
});

export const outputSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  screenshot: z.string().optional(),
});

export async function execute(input: Input): Promise<Output> {
  // Implementation
}

export default { ...tool, inputs_schema: inputSchema, outputs_schema: outputSchema, execute };
```

---

## 📝 STEP 2: REGISTER IN TOOL REGISTRY

**Location:** `tools/tool_registry.json`

Add entry to the `tools` array:

```json
{
  "id": "agent-browser.automation",
  "title": "Agent Browser Automation",
  "kind": "write",
  "safety_level": "caution",
  "entrypoint": "tools/agent-browser/mod.ts",
  "inputs_schema": {
    "type": "object",
    "required": ["action"],
    "properties": {
      "action": {
        "type": "string",
        "enum": ["open", "snapshot", "click", "fill", "type", "screenshot"]
      },
      "url": { "type": "string", "format": "uri" },
      "selector": { "type": "string" },
      "value": { "type": "string" },
      "path": { "type": "string" }
    }
  },
  "outputs_schema": {
    "type": "object",
    "properties": {
      "success": { "type": "boolean" },
      "data": { "type": "object" },
      "error": { "type": "string" },
      "screenshot": { "type": "string" }
    }
  },
  "preconditions": ["WIH_VALID", "TASK_RUNNING"],
  "postconditions": ["BROWSER_STATE_UPDATED"],
  "side_effects": ["browser_navigation", "dom_modification"],
  "policy": {
    "domain_allowlist": ["example.com", "myapp.com"],
    "require_approval_for": ["fill", "click"],
    "output_limit_bytes": 1048576
  }
}
```

---

## 📝 STEP 3: TOOL GATEWAY AUTO-LOADS

The Tool Gateway automatically loads tools from the registry at startup:

**Location:** `4-services/io-service/src/lib.rs`

```rust
pub struct ToolGateway {
    policy_engine: Arc<PolicyEngine>,
    history_ledger: Arc<HistoryLedger>,
    messaging_system: Arc<MessagingSystem>,
    tools: Arc<RwLock<HashMap<String, ToolDefinition>>>,
}

impl ToolGateway {
    pub fn new(
        policy_engine: Arc<PolicyEngine>,
        history_ledger: Arc<HistoryLedger>,
        messaging_system: Arc<MessagingSystem>,
    ) -> Self {
        let gateway = Self {
            policy_engine,
            history_ledger,
            messaging_system,
            tools: Arc::new(RwLock::new(HashMap::new())),
        };
        
        // Auto-load tools from registry
        gateway.load_tools_from_registry();
        
        gateway
    }
    
    fn load_tools_from_registry(&self) {
        // Load tools/tool_registry.json
        // Parse each tool definition
        // Register in self.tools
    }
    
    pub async fn register_tool(&self, tool: ToolDefinition) -> Result<()> {
        let mut tools = self.tools.write().await;
        tools.insert(tool.id.clone(), tool);
        Ok(())
    }
    
    pub async fn list_tools(&self) -> Vec<ToolDefinition> {
        let tools = self.tools.read().await;
        tools.values().cloned().collect()
    }
    
    pub async fn get_tool(&self, id: &str) -> Option<ToolDefinition> {
        let tools = self.tools.read().await;
        tools.get(id).cloned()
    }
}
```

**No manual registration needed** - tools are auto-loaded from `tools/tool_registry.json`.

---

## 📝 STEP 4: TUI INTEGRATION

The TUI automatically has access to all registered tools via:

### 4a. `/tools` Command

**Location:** `7-apps/cli/src/commands/tui.rs`

```rust
// Already implemented - lists all tools
"/tools" => {
    match self.client.get::<Value>("/v1/tools").await {
        Ok(tools) => {
            self.push_system(format!("available tools ({}):", tools.len()));
            for tool in tools.as_array().unwrap_or(&vec![]) {
                let name = tool.get("id").and_then(|v| v.as_str()).unwrap_or("unknown");
                self.push_system(format!("  - {}", name));
            }
        }
        Err(err) => self.push_error(format!("failed to list tools: {err}")),
    }
}

// Already implemented - execute tool
"/tools execute <tool_name> <params>" => {
    // Parse tool_name and params
    // Call self.client.post("/v1/tools/execute", ...)
}
```

### 4b. Usage in TUI

```bash
# List tools
/tools

# Execute tool
/tools execute agent-browser.automation '{"action":"open","url":"https://example.com"}'

# With deterministic retry
/tools execute agent-browser.automation '{"action":"open","url":"https://example.com"}' --retry 3 --timeout 30000
```

---

## 📝 STEP 5: API INTEGRATION

The API automatically exposes tools via REST endpoints:

### 5a. Existing Endpoints

**Location:** `7-apps/api/src/tools_routes.rs`

```rust
// Already implemented:
// GET /api/v1/tools - List all tools
// POST /api/v1/tools/execute - Execute a tool
// GET /api/v1/tools/:id - Get tool by ID
```

### 5b. Usage via API

```bash
# List tools
curl http://localhost:3000/api/v1/tools

# Execute tool
curl -X POST http://localhost:3000/api/v1/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "agent-browser.automation",
    "parameters": {
      "action": "open",
      "url": "https://example.com"
    }
  }'
```

---

## 📝 STEP 6: GUI INTEGRATION

### 6a. Create React Hook

**Location:** `6-ui/a2r-platform/src/hooks/useTool.ts`

```typescript
// 6-ui/a2r-platform/src/hooks/useTool.ts
import { useState, useCallback } from 'react';

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export function useTool(toolId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (parameters: Record<string, any>): Promise<ToolExecutionResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_name: toolId,
          parameters,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Tool execution failed');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [toolId]);

  return {
    execute,
    isLoading,
    error,
  };
}
```

### 6b. Use in GUI Components

```tsx
// 6-ui/a2r-platform/src/views/browser/BrowserControl.tsx
import { useTool } from '@/hooks/useTool';

export function BrowserControl() {
  const { execute, isLoading, error } = useTool('agent-browser.automation');

  const handleNavigate = async () => {
    const result = await execute({
      action: 'open',
      url: 'https://example.com',
    });

    if (result.success) {
      console.log('Navigation successful', result.data);
    } else {
      console.error('Navigation failed', result.error);
    }
  };

  return (
    <button onClick={handleNavigate} disabled={isLoading}>
      {isLoading ? 'Loading...' : 'Navigate'}
    </button>
  );
}
```

---

## 📝 STEP 7: AGENT INTEGRATION

Agents can use tools in three ways:

### 7a. Direct Tool Execution

**In agent code:**
```typescript
import { executeTool } from '@/lib/agents/toolExecutor';

const result = await executeTool({
  tool_id: 'agent-browser.automation',
  parameters: { action: 'open', url: 'https://example.com' },
});
```

### 7b. Workflow Definitions

**In workflow YAML:**
```yaml
workflow_id: browser-automation
description: Automate browser tasks
nodes:
  - id: navigate
    tool: agent-browser.automation
    parameters:
      action: open
      url: https://example.com
    retry:
      max_attempts: 3
      timeout_ms: 30000
  
  - id: snapshot
    tool: agent-browser.automation
    parameters:
      action: snapshot
    depends_on: [navigate]
```

### 7c. Skill Definitions

**In skill definition:**
```typescript
export const browserSkill = {
  id: 'browser-automation',
  name: 'Browser Automation',
  tools: ['agent-browser.automation'],
  intents: ['navigate', 'screenshot', 'extract-data'],
};
```

---

## 🎯 DETERMINISTIC USAGE PATTERNS

### Pattern 1: Retry with Backoff

```typescript
async function executeWithRetry(toolId: string, params: any, maxRetries = 3) {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await executeTool({ tool_id: toolId, parameters: params });
      
      if (result.success) {
        return result;
      }
      
      lastError = new Error(result.error);
    } catch (error) {
      lastError = error as Error;
    }
    
    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  throw lastError;
}

// Usage
const result = await executeWithRetry(
  'agent-browser.automation',
  { action: 'open', url: 'https://example.com' },
  3
);
```

### Pattern 2: Timeout Wrapper

```typescript
async function executeWithTimeout(toolId: string, params: any, timeoutMs = 30000) {
  return Promise.race([
    executeTool({ tool_id: toolId, parameters: params }),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Tool execution timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

// Usage
const result = await executeWithTimeout(
  'agent-browser.automation',
  { action: 'snapshot' },
  30000
);
```

### Pattern 3: Circuit Breaker

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  async execute(toolId: string, params: any): Promise<any> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime! < 60000) {
        throw new Error('Circuit breaker is open');
      }
      this.state = 'half-open';
    }
    
    try {
      const result = await executeTool({ tool_id: toolId, parameters: params });
      
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= 5) {
        this.state = 'open';
      }
      
      throw error;
    }
  }
}

// Usage
const breaker = new CircuitBreaker();
const result = await breaker.execute('agent-browser.automation', { action: 'open', url: 'https://example.com' });
```

### Pattern 4: Idempotency Key

```typescript
async function executeIdempotent(toolId: string, params: any, idempotencyKey: string) {
  return executeTool({
    tool_id: toolId,
    parameters: {
      ...params,
      __idempotency_key: idempotencyKey,
    },
  });
}

// Usage
const key = `browser-nav-${Date.now()}-${userId}`;
const result = await executeIdempotent(
  'agent-browser.automation',
  { action: 'open', url: 'https://example.com' },
  key
);
```

---

## 📊 COMPLETE EXAMPLE: Agent Browser Integration

### 1. Tool Implementation
```
tools/agent-browser/mod.ts (already created)
```

### 2. Registry Entry
Add to `tools/tool_registry.json`:
```json
{
  "id": "agent-browser.automation",
  "title": "Agent Browser Automation",
  "kind": "write",
  "safety_level": "caution",
  "entrypoint": "tools/agent-browser/mod.ts",
  "inputs_schema": { ... },
  "outputs_schema": { ... },
  "preconditions": ["WIH_VALID", "TASK_RUNNING"],
  "postconditions": ["BROWSER_STATE_UPDATED"]
}
```

### 3. TUI Usage
```bash
# List tools
/tools

# Execute
/tools execute agent-browser.automation '{"action":"open","url":"https://example.com"}'

# With retry
/tools execute agent-browser.automation '{"action":"snapshot"}' --retry 3
```

### 4. API Usage
```bash
curl -X POST http://localhost:3000/api/v1/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"tool_name":"agent-browser.automation","parameters":{"action":"open","url":"https://example.com"}}'
```

### 5. GUI Usage
```tsx
import { useTool } from '@/hooks/useTool';

function BrowserComponent() {
  const { execute } = useTool('agent-browser.automation');
  
  const handleClick = async () => {
    await execute({ action: 'open', url: 'https://example.com' });
  };
  
  return <button onClick={handleClick}>Open Browser</button>;
}
```

### 6. Agent Usage
```typescript
// In agent workflow
await executeTool({
  tool_id: 'agent-browser.automation',
  parameters: { action: 'open', url: 'https://example.com' },
});
```

---

## ✅ VERIFICATION CHECKLIST

- [ ] Tool implementation created (`tools/<name>/mod.ts`)
- [ ] Tool added to `tools/tool_registry.json`
- [ ] Tool Gateway auto-loads at startup
- [ ] TUI can list tool: `/tools`
- [ ] TUI can execute tool: `/tools execute <name> <params>`
- [ ] API endpoint works: `POST /api/v1/tools/execute`
- [ ] GUI hook created: `useTool('<tool-id>')`
- [ ] Agent can call tool via `executeTool()`
- [ ] Deterministic patterns implemented (retry, timeout, circuit breaker)
- [ ] Security policies configured (domain allowlist, action approval)

---

## 🔒 SECURITY BEST PRACTICES

1. **Always use preconditions** - Validate WIH, task state before execution
2. **Configure domain allowlists** - Restrict browser navigation to trusted domains
3. **Gate destructive actions** - Require approval for fill/click actions
4. **Limit output size** - Prevent context flooding with output limits
5. **Use session isolation** - Isolate untrusted code in separate sessions
6. **Log all executions** - Audit trail via history ledger
7. **Enforce timeouts** - Prevent hanging executions
8. **Implement circuit breakers** - Prevent cascade failures

---

**End of Tool Registration Guide**

**Generated:** February 26, 2026  
**Applies to:** All tools in `tools/` directory
