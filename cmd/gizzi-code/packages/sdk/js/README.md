# @a2r/sdk Build Process

This SDK is auto-generated from the OpenAPI specification using `@hey-api/openapi-ts`.

## Build Script

```bash
bun packages/sdk/js/script/build.ts
```

## How It Works

1. **Generate OpenAPI Spec**: The script calls `Server.openapi()` to generate the OpenAPI 3.1 spec from the Hono server routes.

2. **Generate Base SDK**: Uses `@hey-api/openapi-ts` with `@hey-api/client-fetch` to generate:
   - `sdk.gen.ts` - Functional API operations
   - `types.gen.ts` - TypeScript types
   - `client/` - Core HTTP client
   - `core/` - Utility functions

3. **Generate Class Wrapper**: Creates `a2r-client.ts` that wraps functional exports in a class-based API matching the existing `A2RClient` interface.

4. **Compile**: Uses Bun to compile TypeScript to JavaScript.

## Deterministic Output

The build is deterministic because:
- OpenAPI spec is generated from the same server code
- Function exports are sorted alphabetically
- Resource groups are sorted alphabetically
- Class methods are sorted alphabetically

## Adding New Routes

When you add new routes to the server:

1. Define `operationId` in your route's `describeRoute()`
2. Run `bun packages/sdk/js/script/build.ts`
3. The SDK will include the new methods automatically

Example:
```typescript
.get("/", describeRoute({
  operationId: "user.get",  // becomes sdk.client.user.get()
  ...
}))
```

## Output Structure

```
packages/sdk/dist/v2/
├── client.js          # Main entry (re-exports from a2r-client.js)
├── client.d.ts        # Type declarations
├── a2r-client.js      # Class-based wrapper
├── a2r-client.ts      # Source for wrapper
├── sdk.gen.js         # Functional API operations
├── types.gen.js       # Type exports
├── client/            # Core HTTP client
└── core/              # Utilities
```

## Usage

```typescript
import { createA2RClient } from "@a2r/sdk/v2/client";

const sdk = createA2RClient({ baseUrl: "http://localhost:4096" });

// Use the class-based API
const sessions = await sdk.client.session.list();
const user = await sdk.client.user.get();
```
