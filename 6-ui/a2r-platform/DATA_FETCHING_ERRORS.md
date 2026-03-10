# Data Fetching Error Analysis

**Analysis Date:** 2026-03-06  
**Scope:** `/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/6-ui/a2r-platform`  
**Analyzed Files:** 200+ TypeScript/React files

---

## Executive Summary

The a2r-platform uses a **hybrid data fetching approach** combining:
- **Custom API client** (`api-client.ts`) with retry logic
- **Zustand stores** for state management
- **Manual `useEffect` patterns** for component-level fetching
- **No TanStack Query or SWR** (opportunity for improvement)

### Overall Grade: **B-**
- ✅ Good error handling in central API client
- ✅ Consistent loading states in major components
- ⚠️ Race conditions in some useEffect patterns
- ⚠️ Missing cleanup in several event stream handlers
- ❌ No standardized caching layer

---

## 1. useEffect Data Fetching Patterns

### 1.1 Good Patterns Found ✅

**Pattern: Abort Controller for Cancellation**
```typescript
// ShellApp.tsx - Line 848+
useEffect(() => {
  let cancelled = false;
  const loadAgents = async () => {
    try {
      await useAgentStore.getState().fetchAgents();
      if (!cancelled) {
        console.log("[ShellApp] Agents fetched successfully");
      }
    } catch (error) {
      if (!cancelled) {
        console.error("[ShellApp] Failed to fetch agents:", error);
      }
    }
  };
  loadAgents();
  return () => { cancelled = true; };
}, []);
```

**Pattern: Proper Dependency Arrays**
```typescript
// useNodes.ts - Line 36-42
useEffect(() => {
  fetchNodes();
  const interval = setInterval(fetchNodes, 5000);
  return () => clearInterval(interval);
}, [fetchNodes]); // ✅ fetchNodes wrapped in useCallback
```

### 1.2 Anti-Patterns Found ⚠️

**Issue: Missing Dependency in RailsView**
```typescript
// RailsView.tsx - Line 34-40
useEffect(() => { 
  fetchAgents(); 
  fetchQueue(); 
}, [fetchAgents, fetchQueue]); // ✅ Good

useEffect(() => {
  if (selectedAgentId) {
    fetchRuns(selectedAgentId); 
    fetchTasks(selectedAgentId); 
    // ... 6 more fetches
  }
}, [selectedAgentId, fetchRuns, fetchTasks, /* ... */]); // ⚠️ Excessive dependencies
```
**Problem:** When `selectedAgentId` changes, 7 parallel fetches trigger simultaneously. No request deduplication.

**Issue: Race Condition in ChatComposer**
```typescript
// ChatComposer.tsx - Line 370-400
useEffect(() => {
  async function fetchTerminalModels() {
    try {
      const response = await fetch(`${TERMINAL_SERVER_URL}/provider`);
      // ...
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      setTerminalModelsLoading(false);
    }
  }
  fetchTerminalModels();
}, []); // ❌ No cleanup if component unmounts during fetch
```

**Issue: Multiple Parallel Fetches Without Coordination**
```typescript
// AgentDashboard/index.tsx - Line 408-416
useEffect(() => {
  skillInstallerApi.listSkills({}).then(res => setSkills(res.skills));
  fetch('/api/mcp/connectors')
    .then(r => r.json())
    .then(data => setMcpConnectors(data.connectors || []))
    .catch(() => setMcpConnectors([]));
}, []); // ❌ No loading state coordination, no error handling for skills
```

### 1.3 Race Condition Hotspots

| File | Line | Issue | Severity |
|------|------|-------|----------|
| `ChatComposer.tsx` | 370 | No cancellation for terminal models fetch | Medium |
| `RailsView.tsx` | 35 | 7 parallel fetches, no coordination | High |
| `AgentDashboard/index.tsx` | 408 | Parallel fetches, no unified loading state | Medium |
| `CronView.tsx` | 801 | fetchAgents without cleanup | Low |

---

## 2. TanStack Query / SWR Usage

### Status: **NOT USED** ❌

**Current State:**
- No `@tanstack/react-query` imports found
- No `useSWR` or `useSWRInfinite` usage
- All data fetching is manual via `useEffect` + `fetch`/`api-client`

**Impact:**
- No automatic caching
- No request deduplication
- No background refetching
- No stale-while-revalidate pattern
- Manual loading/error state management everywhere

**Recommendation:** Consider migrating to TanStack Query for:
- `useNodes()` - polling every 5s (perfect use case)
- `useAgents()` - fetched in multiple components
- `useSessions()` - repeated pattern

---

## 3. Manual Fetch Patterns

### 3.1 API Client Usage ✅

**Centralized Client:** `src/integration/api-client.ts`

**Strengths:**
- Retry logic with exponential backoff (Line 299-335)
- Request/response interceptors (Line 291-297)
- Proper error class (`A2RApiError` with status code detection)
- Auth token management (Line 273-285)
- Offline event dispatching (Line 321-325)

```typescript
// Good: Retry logic with exponential backoff
private async fetchWithRetry(url: string, config: RequestInit): Promise<Response> {
  const maxRetries = 3;
  const retryDelay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, config);
      if (response.ok || (response.status < 500 && response.status !== 404)) {
        return response;
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, i)));
    }
  }
}
```

### 3.2 Raw Fetch Usage ⚠️

**Inconsistent Error Handling:**
```typescript
// ChatComposer.tsx - Line 373
const response = await fetch(`${TERMINAL_SERVER_URL}/provider`);
// ❌ No timeout, no retry, different from api-client pattern
```

**Direct Fetch Without Centralized Handling:**
```typescript
// AgentDashboard/index.tsx - Line 412
fetch('/api/mcp/connectors')
  .then(r => r.json())
  .then(data => setMcpConnectors(data.connectors || []))
  .catch(() => setMcpConnectors([])); // ❌ Silent error swallowing
```

### 3.3 Timeout Handling

**Good Pattern:**
```typescript
// agent.store.ts - Line 195-206
const AGENT_FETCH_TIMEOUT_MS = 4500;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      globalThis.setTimeout(() => {
        reject(new Error(`${label}_TIMEOUT`));
      }, timeoutMs);
    }),
  ]);
}
```

**Missing:** Most other fetch calls don't have timeout protection.

---

## 4. API Client Error Handling

### 4.1 Error Types (A2RApiError) ✅

```typescript
// api-client.ts - Line 173-195
export class A2RApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'A2RApiError';
  }

  isAuthError(): boolean { return this.statusCode === 401 || this.statusCode === 403; }
  isNotFound(): boolean { return this.statusCode === 404; }
  isRateLimit(): boolean { return this.statusCode === 429; }
}
```

### 4.2 Global Error Handling ⚠️

**Partial Implementation:**
- `api-client.ts` dispatches `app:offline` event for network errors
- No global error boundary for API errors
- Toast notifications used inconsistently

**Files with Error Handling:**
| File | Pattern |
|------|---------|
| `agent.store.ts` | Sets `error` state, distinguishes `API_OFFLINE` |
| `ChatComposer.tsx` | Detailed error message mapping (Lines 696-717) |
| `useBrainChat.ts` | Toast notifications on errors |

**Files Missing Error Handling:**
| File | Issue |
|------|-------|
| `AgentDashboard/index.tsx` | Silent catch for MCP connectors |
| `RailsView.tsx` | No error state for fetch failures |

### 4.3 Auth Error Handling (401/403)

**Current:** `A2RApiError.isAuthError()` method exists but no global interceptor.

**Gap:** No automatic redirect to login or token refresh logic.

---

## 5. Loading States

### 5.1 Loading State Patterns

**Consistent Pattern in Stores:**
```typescript
// agent.store.ts
isLoadingAgents: boolean;
isLoadingRuns: boolean;
isLoadingTasks: boolean;
isLoadingMail: boolean;
```

**Loading State Usage:**
```typescript
// AgentView.tsx - Line 5720
if (isLoading) {
  return <LoadingState />;
}
```

### 5.2 Spinner vs Skeleton Usage

| Component | Pattern | Status |
|-----------|---------|--------|
| `AgentView.tsx` | Custom loading spinner | ⚠️ Inconsistent |
| `CronView.tsx` | Inline spinner on buttons | ✅ Good |
| `WorkflowListView.tsx` | Full-page spinner | ⚠️ No skeleton |
| `NodeManagementPanel.tsx` | Spinner overlay | ✅ Good |
| `CoworkTranscript.tsx` | Streaming indicator | ✅ Good |

### 5.3 Skeleton Components Available ✅

```typescript
// design/animation/Skeleton.tsx
<Skeleton variant="text" lines={3} />
<Skeleton variant="circular" width={64} height={64} />
<Skeleton variant="rounded" width={300} height={200} />
```

**Underutilized:** Many loading states use spinners instead of skeletons.

---

## 6. Empty States

### 6.1 Empty State Patterns

**Good Example:**
```typescript
// RailsView.tsx - Line 240-253
if (agents.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center h-[400px]">
      <Bot className="w-16 h-16 text-muted-foreground mb-4 opacity-30" />
      <h3 className="text-xl font-semibold mb-2">No Agents Yet</h3>
      <p className="text-muted-foreground mb-6 max-w-md">
        Create your first agent to start using the Rails System.
      </p>
      <Button onClick={() => window.location.href = '/agent?create=true'}>
        <Plus className="w-4 h-4 mr-2" />
        Create First Agent
      </Button>
    </div>
  );
}
```

**Weak Example:**
```typescript
// DocumentsView.tsx - Line 287
<p style={{ fontSize: '14px' }}>No documents found</p>
// ❌ No icon, no call-to-action, minimal styling
```

### 6.2 Empty State Coverage

| Feature | Empty State | CTA | Icon |
|---------|-------------|-----|------|
| Agents | ✅ Yes | ✅ Yes | ✅ Yes |
| Runs | ✅ Yes | ❌ No | ✅ Yes |
| Mail | ✅ Yes | ✅ Yes | ✅ Yes |
| Checkpoints | ✅ Yes | ❌ No | ✅ Yes |
| Documents | ⚠️ Minimal | ❌ No | ❌ No |
| Plugins | ✅ Yes | ❌ No | ❌ No |

---

## 7. Specific Files Needing Attention

### High Priority

#### 1. `src/views/RailsView.tsx` (Line 34-40)
**Issue:** 7 parallel fetches with no coordination
**Fix:** Use Promise.all or implement request batching
```typescript
// Recommended
useEffect(() => {
  if (selectedAgentId) {
    setIsLoading(true);
    Promise.all([
      fetchRuns(selectedAgentId),
      fetchTasks(selectedAgentId),
      // ...
    ]).finally(() => setIsLoading(false));
  }
}, [selectedAgentId]);
```

#### 2. `src/components/AgentDashboard/index.tsx` (Line 408-416)
**Issue:** Silent error handling, no loading coordination
**Fix:** Add proper error states and unified loading

#### 3. `src/views/chat/ChatComposer.tsx` (Line 370-400)
**Issue:** No cleanup for fetch, race condition possible
**Fix:** Add AbortController

### Medium Priority

#### 4. `src/views/cowork/CronView.tsx` (Line 801+)
**Issue:** Multiple useEffect fetching same data
**Fix:** Consolidate to single fetch pattern

#### 5. `src/integration/api-client.ts` (Line 541-625)
**Issue:** `chat()` method uses raw fetch instead of `fetchWithRetry`
**Fix:** Use centralized retry logic

### Low Priority

#### 6. `src/views/settings/NodeManagementPanel.tsx` (Line 197-201)
**Issue:** 10s polling without visibility check
**Fix:** Pause polling when tab hidden
```typescript
useEffect(() => {
  fetchNodes();
  const interval = setInterval(() => {
    if (!document.hidden) fetchNodes();
  }, 10000);
  return () => clearInterval(interval);
}, []);
```

---

## 8. Best Practice Recommendations

### 8.1 Immediate Actions

1. **Add AbortController to all async useEffect fetches**
   ```typescript
   useEffect(() => {
     const abortController = new AbortController();
     fetchData(abortController.signal);
     return () => abortController.abort();
   }, []);
   ```

2. **Unify error handling** - Create useApiError hook
   ```typescript
   function useApiError() {
     const { toast } = useToast();
     return useCallback((error: unknown) => {
       const message = error instanceof A2RApiError 
         ? error.message 
         : 'An unexpected error occurred';
       toast({ title: 'Error', description: message, variant: 'destructive' });
     }, [toast]);
   }
   ```

3. **Implement loading state consistency**
   - Use `isLoading` prefix consistently (not `loading`)
   - Prefer skeletons over spinners for initial load

### 8.2 Short-term Improvements

4. **Add request deduplication** for parallel fetches
5. **Implement visibility-aware polling** (pause when tab hidden)
6. **Standardize empty states** with EmptyState component

### 8.3 Long-term Architecture

7. **Consider TanStack Query migration** for:
   - Caching
   - Background refetching
   - Request deduplication
   - Optimistic updates

8. **Add API response caching layer** for:
   - Agent list (rarely changes)
   - Model providers (static data)
   - Node configuration

---

## 9. Code Examples

### Recommended Pattern: Data Fetch Hook

```typescript
// hooks/useDataFetch.ts
import { useState, useEffect, useCallback, useRef } from 'react';

interface UseDataFetchOptions<T> {
  fetcher: () => Promise<T>;
  deps?: React.DependencyList;
  timeout?: number;
  retryCount?: number;
}

export function useDataFetch<T>({ 
  fetcher, 
  deps = [], 
  timeout = 10000,
  retryCount = 3 
}: UseDataFetchOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fetcher();
      if (!abortControllerRef.current.signal.aborted) {
        setData(result);
      }
    } catch (err) {
      if (!abortControllerRef.current.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (!abortControllerRef.current.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [fetcher]);

  useEffect(() => {
    execute();
    return () => abortControllerRef.current?.abort();
  }, deps);

  return { data, isLoading, error, refetch: execute };
}
```

### Usage Example

```typescript
function AgentList() {
  const { data: agents, isLoading, error, refetch } = useDataFetch({
    fetcher: () => api.listAgents().then(r => r.agents),
    deps: [],
  });

  if (isLoading) return <Skeleton variant="text" lines={5} />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!agents?.length) return <EmptyState message="No agents found" />;

  return <AgentGrid agents={agents} />;
}
```

---

## 10. Summary Table

| Category | Grade | Notes |
|----------|-------|-------|
| Error Handling | B+ | Good central client, inconsistent UI handling |
| Loading States | B | Available but inconsistently applied |
| Empty States | B- | Good in major views, missing in minor ones |
| Race Conditions | C | Several components need cleanup |
| Caching | D | No caching layer present |
| Retry Logic | B+ | Good in api-client, missing elsewhere |
| Type Safety | A | Good TypeScript coverage |

---

**Next Review:** Recommend revisiting after implementing TanStack Query or similar caching solution.
