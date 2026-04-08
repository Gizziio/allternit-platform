# Backend Integration Changes - Production Ready

## Summary

Removed ALL localStorage fallbacks and implemented proper backend API integrations for:
1. File operations (read, write, search, list, delete)
2. Scheduled jobs (create, list, update, delete, run)
3. Tool registry (fetch, register, unregister)

## Files Changed

### New Files

#### `src/lib/agents/files-api.ts`
- **Purpose**: Real API client for file operations
- **Endpoints**:
  - `GET /api/v1/files/read` - Read file contents
  - `POST /api/v1/files/write` - Write file contents
  - `GET /api/v1/files/list` - List directory contents
  - `POST /api/v1/files/search` - Search code
  - `DELETE /api/v1/files/delete` - Delete file
  - `HEAD /api/v1/files/exists` - Check file existence
- **Error Handling**: Proper `FilesApiClientError` with status codes
- **NO localStorage fallback** - All errors bubble up to caller

### Modified Files

#### `src/lib/agents/tools/file-tools.ts`
**Before**: Used localStorage fallbacks when API calls failed
**After**: 
- Uses `filesApi` client exclusively
- Returns proper error objects on failure
- Added `delete_file` tool
- NO fallbacks - real backend integration only

```typescript
// OLD (with fallback):
const response = await fetch('/api/files/read?...');
if (!response.ok) {
  // Fallback to localStorage
  const demoFiles = JSON.parse(localStorage.getItem('a2r-demo-files') || '{}');
  // ...
}

// NEW (no fallback):
const result = await filesApi.readFile({ path, offset, limit });
return { result };
// Errors are caught and returned as { result: null, error: message }
```

#### `src/lib/agents/scheduled-jobs.service.ts`
**Before**: Stored jobs in localStorage, simulated API calls
**After**:
- Uses `/api/agent-control` Gateway WebSocket endpoint
- Methods: `cron.list`, `cron.update`, `cron.run`
- Proper error handling with try/catch
- NO localStorage - all data from backend

```typescript
// OLD:
const jobs = JSON.parse(localStorage.getItem('a2r-scheduled-jobs') || '[]');

// NEW:
const response = await callAgentControl<{ jobs: GatewayJob[] }>('cron.list', {});
const jobs = response.jobs || [];
```

#### `src/lib/agents/scheduled-jobs.runner.ts`
**Before**: Read/wrote to localStorage for job state and history
**After**:
- Uses `listScheduledJobs()` from service
- In-memory execution history (backend should provide persistence)
- NO localStorage operations

```typescript
// OLD:
function getScheduledJobsFromStorage(): ScheduledJobConfig[] {
  const data = localStorage.getItem('a2r-scheduled-jobs');
  return data ? JSON.parse(data) : [];
}

// NEW:
const jobs = await listScheduledJobs(); // From API
```

#### `src/lib/agents/tool-registry.store.ts`
**Before**: Used localStorage for persistence with `persist` middleware
**After**:
- Removed `persist` middleware
- Real API calls to Gateway for tool operations
- `fetchToolsFromApi()` - GET /api/v1/tools
- `registerToolWithApi()` - POST /api/v1/tools/register
- `unregisterToolFromApi()` - POST /api/v1/tools/unregister
- In-memory state only (backend provides persistence)

```typescript
// OLD (with persist):
export const useToolRegistryStore = create<ToolRegistryState & ToolRegistryActions>()(
  immer(
    persist((set, get) => ({ ... }), { name: 'a2r-tool-registry' })
  )
);

// NEW (no persist):
export const useToolRegistryStore = create<ToolRegistryState & ToolRegistryActions>()(
  immer((set, get) => ({ ... }))
);
```

## API Endpoints Required

### Gateway API (Port 3210)

#### Files API
```
GET    /api/v1/files/read?path={path}&offset={offset}&limit={limit}
POST   /api/v1/files/write
GET    /api/v1/files/list?path={path}&details={bool}&recursive={bool}
POST   /api/v1/files/search
DELETE /api/v1/files/delete?path={path}
HEAD   /api/v1/files/exists?path={path}
```

#### Tools API
```
GET    /api/v1/tools
POST   /api/v1/tools/register
POST   /api/v1/tools/unregister
POST   /api/v1/tools/execute
```

#### Agent Control API (via /api/agent-control)
```
POST /api/agent-control (WebSocket)
  - method: "cron.list"
  - method: "cron.update"
  - method: "cron.run"
```

## Error Handling

All API clients now throw proper errors:

```typescript
class FilesApiClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public path?: string
  )
}
```

Tools return error objects rather than throwing:
```typescript
// Success
return { result: data };

// Error
return { result: null, error: error.message };
```

## Testing

Tests updated to:
1. Mock API calls instead of localStorage
2. Use proper TaskType values
3. Handle async API responses

```typescript
// Mock fetch for tests
global.fetch = vi.fn();
(fetch as Mock).mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ result: 'data' })
});
```

## Migration Guide

### For Backend Developers

1. **Implement Files API** at `/api/v1/files/*`
2. **Implement Tools API** at `/api/v1/tools/*`
3. **Implement Cron Methods** in Gateway WebSocket
4. **Add authentication/authorization** to all endpoints

### For Frontend Developers

No code changes needed - the API clients are already integrated. Just ensure:
1. Gateway is running on port 3210
2. Backend APIs are implemented
3. Environment variables are set:
   - `VITE_A2R_GATEWAY_URL=http://127.0.0.1:3210`

## Backward Compatibility

**BREAKING CHANGE**: The system no longer works offline or without a backend.
- All features require the Gateway to be running
- All features require the backend APIs to be implemented
- NO graceful degradation to localStorage

## Verification

Check that all localStorage fallbacks are removed:
```bash
grep -r "localStorage" src/lib/agents/ --include="*.ts" | grep -v ".test.ts"
# Should only return test files and comments
```

Check that all API calls are uncommented:
```bash
grep -r "await fetch" src/lib/agents/tools/file-tools.ts
# Should show actual API calls
```
