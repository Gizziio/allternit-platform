# GUI Tool Hook Documentation

**Location:** `6-ui/allternit-platform/src/hooks/useTool.ts`

---

## 📋 OVERVIEW

The `useTool` hook provides deterministic tool execution for React components with built-in:
- ✅ Retry logic with exponential backoff
- ✅ Timeout handling
- ✅ Abort/cancel support
- ✅ Error handling
- ✅ Idempotency support
- ✅ Success/error callbacks

---

## 🚀 QUICK START

### Basic Usage

```tsx
import { useTool } from '@/hooks/useTool';

function MyComponent() {
  const { execute, isLoading, error, lastResult } = useTool('agent-browser.automation');

  const handleClick = async () => {
    const result = await execute({
      action: 'open',
      url: 'https://example.com',
    });

    if (result.success) {
      console.log('Success!', result.data);
    } else {
      console.error('Failed:', result.error);
    }
  };

  return (
    <button onClick={handleClick} disabled={isLoading}>
      {isLoading ? 'Loading...' : 'Open Browser'}
    </button>
  );
}
```

---

## 📖 API REFERENCE

### `useTool(toolId: string)`

**Returns:**
```typescript
{
  execute: (params, options) => Promise<ToolExecutionResult>,
  cancel: () => void,
  reset: () => void,
  isLoading: boolean,
  error: string | null,
  lastResult: ToolExecutionResult | null,
}
```

### `execute(params, options)`

**Parameters:**
- `params: Record<string, any>` - Tool parameters
- `options: ToolExecutionOptions` (optional)

**Options:**
```typescript
interface ToolExecutionOptions {
  retry?: number;              // Max retry attempts (default: 0)
  retryDelay?: number;         // Base retry delay in ms (default: 1000)
  timeout?: number;            // Timeout in ms (default: 30000)
  backoff?: boolean;           // Exponential backoff (default: true)
  idempotencyKey?: string;     // Idempotency key for deduplication
  onSuccess?: (result) => void; // Callback on success
  onError?: (error) => void;    // Callback on error
}
```

**Returns:** `Promise<ToolExecutionResult>`

```typescript
interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  screenshot?: string;       // Base64 screenshot (if applicable)
  snapshot?: any;            // Element snapshot (if applicable)
  execution_time_ms?: number;
}
```

---

## 💡 USAGE EXAMPLES

### Example 1: Basic Execution

```tsx
import { useTool } from '@/hooks/useTool';

function NavigateButton() {
  const { execute, isLoading, error } = useTool('agent-browser.automation');

  const handleNavigate = async () => {
    const result = await execute({
      action: 'open',
      url: 'https://example.com',
    });

    if (result.success) {
      alert('Navigation successful!');
    } else {
      alert(`Failed: ${result.error}`);
    }
  };

  return (
    <button onClick={handleNavigate} disabled={isLoading}>
      {isLoading ? 'Loading...' : 'Navigate'}
    </button>
  );
}
```

### Example 2: With Retry

```tsx
import { useToolWithRetry } from '@/hooks/useTool';

function ReliableButton() {
  // Automatically retry up to 3 times on failure
  const { execute } = useToolWithRetry('agent-browser.automation', 3);

  const handleClick = async () => {
    const result = await execute({
      action: 'snapshot',
    });
    console.log('Snapshot:', result.snapshot);
  };

  return <button onClick={handleClick}>Get Snapshot</button>;
}
```

### Example 3: With Timeout

```tsx
import { useToolWithTimeout } from '@/hooks/useTool';

function TimedButton() {
  // Timeout after 60 seconds
  const { execute } = useToolWithTimeout('agent-browser.automation', 60000);

  const handleClick = async () => {
    try {
      const result = await execute({
        action: 'screenshot',
        path: '/tmp/screen.png',
      });
      console.log('Screenshot taken');
    } catch (error) {
      console.error('Timeout or error:', error);
    }
  };

  return <button onClick={handleClick}>Take Screenshot</button>;
}
```

### Example 4: With Retry and Timeout

```tsx
import { useToolWithRetryAndTimeout } from '@/hooks/useTool';

function RobustButton() {
  // Retry 3 times with 30s timeout per attempt
  const { execute, isLoading, error } = useToolWithRetryAndTimeout(
    'agent-browser.automation',
    3,  // retries
    30000  // timeout
  );

  const handleClick = async () => {
    const result = await execute({
      action: 'click',
      selector: '@e2',
    });

    if (result.success) {
      console.log('Clicked successfully');
    }
  };

  return (
    <div>
      <button onClick={handleClick} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Click Element'}
      </button>
      {error && <div className="error">Error: {error}</div>}
    </div>
  );
}
```

### Example 5: With Custom Options

```tsx
import { useTool } from '@/hooks/useTool';

function AdvancedButton() {
  const { execute, cancel, reset, lastResult } = useTool('agent-browser.automation');

  const handleClick = async () => {
    const result = await execute(
      {
        action: 'open',
        url: 'https://example.com',
      },
      {
        retry: 3,
        retryDelay: 2000,
        timeout: 60000,
        backoff: true,
        idempotencyKey: `nav-${Date.now()}`,
        onSuccess: (result) => {
          console.log('Success callback:', result);
        },
        onError: (error) => {
          console.error('Error callback:', error);
        },
      }
    );
  };

  return (
    <div>
      <button onClick={handleClick}>Navigate</button>
      <button onClick={cancel}>Cancel</button>
      <button onClick={reset}>Reset</button>
      {lastResult && <pre>{JSON.stringify(lastResult, null, 2)}</pre>}
    </div>
  );
}
```

### Example 6: Cancel Long-Running Operation

```tsx
import { useTool } from '@/hooks/useTool';

function CancelableButton() {
  const { execute, cancel, isLoading } = useTool('agent-browser.automation');

  const handleLongOperation = async () => {
    try {
      const result = await execute({
        action: 'wait',
        timeout: 60000,  // Wait up to 60s
      }, {
        timeout: 120000,  // Overall timeout 2 minutes
      });
      console.log('Operation complete');
    } catch (error) {
      if (error.message === 'Tool execution aborted') {
        console.log('Operation cancelled by user');
      }
    }
  };

  return (
    <div>
      <button onClick={handleLongOperation} disabled={isLoading}>
        Start Operation
      </button>
      {isLoading && (
        <button onClick={cancel}>Cancel</button>
      )}
    </div>
  );
}
```

### Example 7: Form with Tool Execution

```tsx
import { useState } from 'react';
import { useToolWithRetryAndTimeout } from '@/hooks/useTool';

function BrowserForm() {
  const [url, setUrl] = useState('https://example.com');
  const { execute, isLoading, error, lastResult } = useToolWithRetryAndTimeout(
    'agent-browser.automation',
    3,
    30000
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await execute({
      action: 'open',
      url,
    });

    if (result.success) {
      console.log('Navigated to:', url);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter URL"
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Navigate'}
      </button>
      {error && <div className="error">{error}</div>}
      {lastResult?.success && (
        <div className="success">✓ Success ({lastResult.execution_time_ms}ms)</div>
      )}
    </form>
  );
}
```

---

## 🎯 DETERMINISTIC PATTERNS

### Pattern 1: Exponential Backoff

```typescript
const { execute } = useTool('agent-browser.automation');

// Will retry with delays: 1s, 2s, 4s, 8s (capped at 10s)
await execute(params, {
  retry: 4,
  retryDelay: 1000,
  backoff: true,  // Exponential backoff enabled
});
```

### Pattern 2: Idempotent Execution

```typescript
const { execute } = useTool('agent-browser.automation');

// Same idempotency key ensures only one execution
const key = `browser-nav-${userId}-${Date.now()}`;

await execute({
  action: 'open',
  url: 'https://example.com',
  __idempotency_key: key,
});
```

### Pattern 3: Timeout with Fallback

```typescript
const { execute } = useTool('agent-browser.automation');

try {
  const result = await execute(params, { timeout: 5000 });
  console.log('Fast execution succeeded');
} catch (error) {
  // Fallback to longer timeout
  const result = await execute(params, { timeout: 30000 });
  console.log('Slow execution succeeded');
}
```

### Pattern 4: Progress Tracking

```typescript
const { execute, isLoading, lastResult } = useTool('agent-browser.automation');

// Track progress via execution time
const progress = lastResult?.execution_time_ms
  ? Math.min((lastResult.execution_time_ms / 30000) * 100, 100)
  : 0;

return (
  <div>
    <progress value={progress} max={100} />
    {isLoading ? `${progress.toFixed(0)}%` : 'Ready'}
  </div>
);
```

---

## 🔥 BEST PRACTICES

### 1. Always Handle Errors

```tsx
const { execute, error } = useTool('agent-browser.automation');

const handleClick = async () => {
  const result = await execute(params);
  
  if (!result.success) {
    // Always check and handle errors
    console.error('Tool failed:', result.error);
    // Show error to user
  }
};
```

### 2. Use Retry for Flaky Operations

```tsx
// Browser operations can be flaky - use retry
const { execute } = useToolWithRetry('agent-browser.automation', 3);
```

### 3. Set Reasonable Timeouts

```tsx
// Don't wait forever - set appropriate timeouts
const { execute } = useToolWithTimeout('agent-browser.automation', 30000);
```

### 4. Cancel on Unmount

```tsx
import { useEffect } from 'react';
import { useTool } from '@/hooks/useTool';

function MyComponent() {
  const { execute, cancel } = useTool('agent-browser.automation');

  useEffect(() => {
    return () => {
      // Cancel in-progress operations on unmount
      cancel();
    };
  }, []);

  return <button onClick={() => execute(params)}>Execute</button>;
}
```

### 5. Use Idempotency for Critical Operations

```tsx
// For operations that must not duplicate
const { execute } = useTool('agent-browser.automation');

const key = `payment-${transactionId}`;
await execute({
  action: 'submit',
  transactionId,
}, {
  idempotencyKey: key,
});
```

---

## 📊 COMPARISON: Hook Variants

| Hook | Retry | Timeout | Use Case |
|------|-------|---------|----------|
| `useTool` | Manual | Manual | Full control |
| `useToolWithRetry` | ✅ Auto | Manual | Flaky operations |
| `useToolWithTimeout` | Manual | ✅ Auto | Slow operations |
| `useToolWithRetryAndTimeout` | ✅ Auto | ✅ Auto | Production use |

**Recommendation:** Use `useToolWithRetryAndTimeout` for most cases.

---

## 🐛 TROUBLESHOOTING

### "Tool execution timeout"

```typescript
// Increase timeout
const { execute } = useToolWithTimeout('agent-browser.automation', 120000);
```

### "Max retries exceeded"

```typescript
// Increase retry count or delay
const { execute } = useToolWithRetryAndTimeout('agent-browser.automation', 5, 60000);
```

### "Tool execution aborted"

```typescript
// Check if cancel() was called or component unmounted
// Handle gracefully
try {
  await execute(params);
} catch (error) {
  if (error.message === 'Tool execution aborted') {
    console.log('Operation cancelled');
  }
}
```

---

## 📚 RELATED

- **Tool Implementation:** `tools/agent-browser/mod.ts`
- **Tool Registry:** `tools/tool_registry.json`
- **API Endpoint:** `POST /api/v1/tools/execute`
- **Example Component:** `components/browser/BrowserControl.tsx`

---

**Generated:** February 26, 2026  
**Module:** `@/hooks/useTool`
