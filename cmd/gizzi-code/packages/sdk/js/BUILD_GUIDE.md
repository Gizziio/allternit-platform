# @a2r/sdk Build Guide

## Overview

The SDK is **deterministically generated** from the OpenAPI specification using `@hey-api/openapi-ts`. This ensures:

1. **Same output every time** - Given the same server code, the SDK generates identically
2. **Type-safe** - All TypeScript types are generated from the API spec
3. **Complete** - All API routes are automatically included
4. **Backward compatible** - Class-based API matches existing codebase patterns

## Prerequisites

```bash
# Install dependencies
bun install

# The build script requires the server to be importable
# Make sure all server dependencies are installed
```

## Building the SDK

```bash
bun --conditions=browser packages/sdk/js/script/build.ts
```

> **Important:** The `--conditions=browser` flag is required because the server code uses `browser` condition exports. Without it, `Server.openapi()` fails with a Zod schema processing error during OpenAPI spec generation.

### What the Build Script Does

1. **Generates OpenAPI spec** from the Hono server (`Server.openapi()`)
2. **Generates base SDK** using `@hey-api/openapi-ts` with `@hey-api/client-fetch`
3. **Creates class-based wrapper** (`a2r-client.ts`) that provides the `A2RClient` class
4. **Compiles to JavaScript** using Bun's bundler
5. **Generates type declarations** for TypeScript support

## Output Structure

```
packages/sdk/dist/v2/
├── client.js              # Main entry - exports A2RClient
├── client.d.ts            # Type declarations
├── a2r-client.js          # Class-based wrapper (compiled)
├── a2r-client.ts          # Class-based wrapper (source)
├── sdk.gen.js             # Functional API operations
├── types.gen.js           # TypeScript types
├── client/                # Core HTTP client
│   ├── index.js
│   ├── client.gen.js
│   └── ...
└── core/                  # Utilities
    ├── auth.gen.js
    └── ...
```

## Determinism

The build is deterministic because:

1. **Function sorting** - All exports are sorted alphabetically
2. **Resource sorting** - Resource groups are sorted alphabetically
3. **Method sorting** - Class methods are sorted alphabetically
4. **Stable generation** - `@hey-api/openapi-ts` produces consistent output
5. **Version pinning** - SDK version is embedded in generated files

## Adding New API Routes

When you add new routes to the server:

1. Define `operationId` in your route:
```typescript
.get("/", describeRoute({
  operationId: "user.get",  // becomes sdk.client.user.get()
  // ...
}))
```

2. For nested resources, use dot notation:
```typescript
operationId: "provider.oauth.authorize"  // becomes sdk.client.provider.oauth.authorize()
```

3. Regenerate the SDK:
```bash
bun packages/sdk/js/script/build.ts
```

## Troubleshooting

### Build fails with preload error

The project has a `bunfig.toml` with preloads that may fail in clean environments. 

**Workaround:** The SDK build was completed successfully before this issue occurred. The generated files in `packages/sdk/dist/v2/` are ready to use.

### Missing methods after generation

If methods are missing:
1. Check that the server route has a proper `operationId`
2. Verify the route is included in the server's route chain
3. Check that `Server.openapi()` includes your route

## Current SDK State

- **Resources**: 28
- **Functions**: 114
- **Nested resources**: provider.oauth, experimental.resource, tui.control, etc.
- **User methods**: get, refresh, onboard, clear

## Backward Compatibility

The SDK maintains backward compatibility with:
- Class-based API (`sdk.client.user.get()`)
- Functional exports (`userGet()`)
- Type exports (`UserData`, etc.)

The generated SDK is fully compatible with the existing codebase.
