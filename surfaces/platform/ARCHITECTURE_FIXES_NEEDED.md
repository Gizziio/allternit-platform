# Shell UI Architecture Fixes Needed

## Current State
The Shell UI has accumulated technical debt where server-side code (Node.js built-ins, database clients) is being imported into client components. This causes webpack bundling failures.

## Fixes Applied (Workarounds)
1. **kernel/chat.ts** - Removed kernel bridge fallback, uses API client directly
2. **kernel/projects.ts** - Replaced kernel calls with API client calls
3. **kernel/workflows.ts** - Replaced kernel calls with API client calls
4. **mcp-oauth-provider.ts** - Replaced `node:crypto` with Web Crypto API
5. **next.config.ts** - Clean configuration without fallbacks
6. **not-found.tsx** - Uses Link component (no client-side JS needed)

## Remaining Issues
The `mcp-client.ts` imports database code which imports `postgres` npm package. This is a server-only dependency being pulled into client bundles.

## Proper Fixes Required

### 1. Separate Server/Client Code (High Priority)
Move all database-dependent code to API routes:

```
Current (broken):
  AgentDashboard (client) → mcp-client → mcp-queries → postgres

Proper:
  AgentDashboard (client) → API route /api/mcp/... → mcp-queries → postgres
```

Files to refactor:
- `src/lib/ai/mcp/mcp-client.ts` - Split into client-safe and server-only parts
- `src/lib/ai/mcp/mcp-oauth-provider.ts` - Move DB calls to API routes
- `src/components/AgentDashboard/index.tsx` - Use API routes instead of direct imports

### 2. Create MCP API Routes
Create proper Next.js API routes for MCP operations:
- `app/api/mcp/connect/route.ts`
- `app/api/mcp/oauth/callback/route.ts`
- `app/api/mcp/tools/list/route.ts`

### 3. Client-Safe MCP Client
Create a browser-compatible MCP client that:
- Uses fetch() to call API routes
- No direct database access
- No Node.js built-in imports

### 4. Remove Kernel Imports
The kernel integration files should be server-only:
- Mark `src/integration/kernel/` as server-only
- Create `src/integration/kernel/index.server.ts` for server imports
- Client code should use `api-client.ts` exclusively

## Verification
Once proper fixes are in place:
1. Remove all Node.js fallbacks from next.config.ts
2. Verify `npm run build` succeeds
3. Verify no "node:" imports in client bundle
4. Run full test suite

## Migration Path
1. Create API routes for MCP operations
2. Update AgentDashboard to use API routes
3. Mark server-only files with "server-only" package
4. Remove dynamic imports that pull in server code
5. Test in production build
