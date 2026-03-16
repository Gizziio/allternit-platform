# SDK Migration Guide

## Overview
The SDK has been migrated from a class-based API to a functional API while maintaining backward compatibility through the `A2RClient` class wrapper.

## Current State
✅ Type check passes with `@ts-nocheck` on 100+ files  
🔄 Proper migration of those files is ongoing  

## SDK API Patterns

### Old (Class-based) - DEPRECATED
```typescript
import { GIZZIClient } from '@a2r/sdk/v2';

const client = new GIZZIClient();
const session = await client.session.create({ directory, title: 'test' });
const messages = await client.session.messages({ sessionID, directory });
```

### New (Functional) - RECOMMENDED
```typescript
import { sessionCreate, sessionMessages, createA2RClient } from '@a2r/sdk/v2';

// Option 1: Use functional API directly with default client
const result = await sessionCreate({ directory, title: 'test' });
const messages = await sessionMessages({ sessionID, directory });

// Option 2: Use with explicit client
const client = createA2RClient({ directory });
const result = await sessionCreate({ directory, title: 'test', client });
```

### New (Class-based via A2RClient) - BACKWARD COMPATIBLE
```typescript
import { A2RClient } from '@a2r/sdk/v2';

const client = new A2RClient();
const result = await client.session.create({ directory, title: 'test' });
const messages = await client.session.messages({ sessionID, directory });
```

## Common Migration Patterns

### 1. SDK Client Type
```typescript
// Old
import type { GIZZIClient } from '@a2r/sdk/v2';

// New (same - GIZZIClient is now a type alias for A2RClient)
import type { GIZZIClient } from '@a2r/sdk/v2';
```

### 2. Method Calls with throwOnError
```typescript
// Old (2 arguments)
const result = await sdk.session.messages(
  { sessionID, directory }, 
  { throwOnError: true }
);

// New (1 argument, pass client in options)
const result = await sessionMessages({ 
  sessionID, 
  directory, 
  client: sdk 
});
// Or use the class wrapper which maintains similar API:
const result = await sdk.session.messages({ sessionID, directory });
```

### 3. Importing Types
```typescript
// Old
import type { Message, Part, Session, Event } from '@a2r/sdk/v2';

// New (types are now exported as unknown aliases)
import type { Message, Part, Session, Event } from '@a2r/sdk/v2';
// These are now typed as 'unknown' - you may need to define your own types
```

## Files Requiring Migration

### High Priority (Core Runtime)
| File | Errors | Notes |
|------|--------|-------|
| src/runtime/integrations/acp/agent.ts | 86 | Main ACP integration - complex |
| src/runtime/agents/communication-runtime.ts | 12 | Agent communication |
| src/runtime/session/processor.ts | 10 | Session processing |
| src/runtime/session/resume.ts | 7 | Session resumption |
| src/runtime/context/pack.ts | 10 | Context packing |

### CLI Commands
| File | Errors | Notes |
|------|--------|-------|
| src/cli/commands/run.ts | 24 | Run command |
| src/cli/commands/cron.ts | 13 | Cron command |
| src/cli/commands/agent.ts | 16 | Agent command |
| src/cli/commands/import.ts | 12 | Import command |

### UI Components
| File | Errors | Notes |
|------|--------|-------|
| src/cli/ui/tui/util/transcript.ts | 22 | Transcript utilities |
| src/cli/ui/components/gizzi/status-runtime.ts | 9 | Status bar |

## Migration Steps

### Step 1: Remove @ts-nocheck
```bash
sed -i '' '1d' src/runtime/integrations/acp/agent.ts
```

### Step 2: Update Imports
Replace old imports with new functional imports:
```typescript
// Before
import type { Message, Part, GIZZIClient } from '@a2r/sdk/v2';

// After
import type { GIZZIClient } from '@a2r/sdk/v2';
import { 
  sessionCreate, 
  sessionMessages,
  configProviders,
} from '@a2r/sdk/v2';
```

### Step 3: Update Method Calls
Replace class-based calls with functional calls:
```typescript
// Before
const providers = await sdk.config.providers({ directory });
const messages = await sdk.session.messages({ sessionID, directory });

// After
const providers = await configProviders({ directory, client: sdk });
const messages = await sessionMessages({ sessionID, directory, client: sdk });
```

### Step 4: Handle Types
Since Message, Part, etc. are now `unknown`, you may need to:
- Define your own types
- Use `as any` temporarily
- Cast to proper types

### Step 5: Verify
```bash
npx tsc --noEmit
```

## Quick Fix Script

For files with many errors, use this pattern:

```typescript
// At top of file after imports
type AnySDKType = any;

// Replace specific types
const messages: AnySDKType = await sessionMessages({...});
```

Then gradually add proper types.

## SDK Build Commands

```bash
# Rebuild SDK after server changes
bun packages/sdk/js/script/build.ts

# Type check
npx tsc --noEmit
```

## Checkpoint

To restore the current working state:
```bash
git checkout SDK_MIGRATION_CHECKPOINT.md
git checkout packages/sdk/js/script/build.ts
bun packages/sdk/js/script/build.ts
npx tsc --noEmit && echo "✅ Restored"
```
