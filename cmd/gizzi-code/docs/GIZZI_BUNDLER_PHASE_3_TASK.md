---
topic: gizzi_bundler
phase: 3
status: ready
---

# Phase 3 — Break the auth/oauth circular dependency that stalled Phase 2

## Current state

- Phase 2 executor ran for >1h without finishing. The build still fails at `.build/gizzi-code-bundle.js:18208` with:
  - `var init_auth10=__esm(()=>{await init_auth11()})`
  - `error: "await" can only be used inside an "async" function`
- I (the orchestrator) already removed the static `getOauthProfileFromOauthToken` import from both copies of `utils/auth.ts` and replaced it with a dynamic import inside the async `validateForceLoginOrg` function.
- The remaining problem is a static import cycle between `utils/auth.ts` and `services/oauth/client.ts`, plus `services/oauth/getOauthProfile.ts` still statically importing `utils/auth.ts`.

## Cycle map

In **both** the `src/cli/ui/ink-app/...` tree and the `src/shared/...` tree:

1. `utils/auth.ts` statically imports from `services/oauth/client.ts`:
   - `isOAuthTokenExpired`
   - `refreshOAuthToken`
   - `shouldUseClaudeAIAuth`
2. `services/oauth/client.ts` statically imports from `utils/auth.ts`:
   - `checkAndRefreshOAuthTokenIfNeeded`
   - `getClaudeAIOAuthTokens`
   - `hasProfileScope`
   - `isClaudeAISubscriber`
   - `saveApiKey`
3. `services/oauth/getOauthProfile.ts` statically imports `getAllternitApiKey` from `utils/auth.ts`.
4. `services/oauth/client.ts` statically imports `getOauthProfileFromOauthToken` from `services/oauth/getOauthProfile.ts`.

This creates `utils/auth.ts` <-> `services/oauth/client.ts` and a larger ring through `getOauthProfile.ts`.

## Exact scope

Make `bun run build` pass, then `bun run typecheck` pass, by breaking the cycles above with **only** these source changes:

### 1. Create leaf `services/oauth/scopes.ts` in both trees

Create:
- `src/cli/ui/ink-app/services/oauth/scopes.ts`
- `src/shared/runtime/services/oauth/scopes.ts`

Move these two pure functions into each file (copy the existing implementations exactly):

```ts
// @ts-nocheck
import { CLAUDE_AI_INFERENCE_SCOPE } from '../../constants/oauth.js'

export function shouldUseClaudeAIAuth(scopes: string[] | undefined): boolean {
  return Boolean(scopes?.includes(CLAUDE_AI_INFERENCE_SCOPE))
}

export function isOAuthTokenExpired(expiresAt: number | null): boolean {
  if (expiresAt === null) {
    return false
  }

  const bufferTime = 5 * 60 * 1000
  const now = Date.now()
  const expiresWithBuffer = now + bufferTime
  return expiresWithBuffer >= expiresAt
}
```

### 2. Re-export from `services/oauth/client.ts` so other importers keep working

In both `client.ts` files:
- Remove the definitions of `shouldUseClaudeAIAuth` and `isOAuthTokenExpired`.
- Add a re-export at the top of the file:
  ```ts
  export { isOAuthTokenExpired, shouldUseClaudeAIAuth } from './scopes.js'
  ```
- Keep the existing `import { CLAUDE_AI_INFERENCE_SCOPE, ... }` if still needed for other things.

### 3. Point `utils/auth.ts` at the leaf instead of `client.ts`

In both `utils/auth.ts` files:
- Remove `shouldUseClaudeAIAuth` and `isOAuthTokenExpired` from the `services/oauth/client.js` import block.
- Add a static import from the new leaf:
  ```ts
  import { isOAuthTokenExpired, shouldUseClaudeAIAuth } from '../services/oauth/scopes.js'
  ```
  (for the shared copy use the correct relative path `../../runtime/services/oauth/scopes.js`).
- Leave `refreshOAuthToken` imported from `client.js` for now, but see step 5.

### 4. Break `services/oauth/getOauthProfile.ts` -> `utils/auth.ts`

In both `getOauthProfile.ts` files:
- Remove the static import of `getAllternitApiKey` from `utils/auth.ts`/`../../utils/auth.ts`.
- Inside the async function `getOauthProfileFromApiKey`, dynamically import it:
  ```ts
  const { getAllternitApiKey } = await import('../../utils/auth.js')
  ```
  (use the correct relative path for each copy).

### 5. Break `utils/auth.ts` -> `services/oauth/client.ts` entirely

In both `utils/auth.ts` files:
- Keep the import from `scopes.js`.
- Remove `refreshOAuthToken` from the `client.js` import block.
- In the only async function that uses `refreshOAuthToken` (`checkAndRefreshOAuthTokenIfNeededImpl`), dynamically import it at the call site:
  ```ts
  const { refreshOAuthToken } = await import('../services/oauth/client.js')
  ```
  (shared copy: `../../runtime/services/oauth/client.js`).

After these changes, `utils/auth.ts` should have **no** static import from `services/oauth/client.js`. `services/oauth/client.ts` still imports from `utils/auth.ts`, but that is fine because `utils/auth.ts` no longer imports `client.ts`.

## Iteration

1. Run `cd /Users/joe/Desktop/allternit-workspace/allternit/cmd/gizzi-code && bun run build 2>&1 | tail -80`.
2. If it still fails with a new `"await" can only be used inside an "async" function` error, read the bundled line, identify the `init_*` pair, map it back to source modules, and break that cycle by either:
   - Extracting pure leaf exports to a new file, OR
   - Replacing a static import with a dynamic import inside an async function.
3. Repeat until `bun run build` exits 0.

## Typecheck

Run `cd /Users/joe/Desktop/allternit-workspace/allternit/cmd/gizzi-code && bun run typecheck`. Fix any type errors introduced by the moves. Do not suppress errors with `@ts-ignore` unless the original code already used it. Do not change unrelated types.

## Constraints

- Do NOT start any dev servers.
- Do NOT run git operations.
- Do NOT modify unrelated UI, features, or build config.
- Preserve all existing runtime behavior; only move/repoint imports.
- Use `.js` extensions in imports, matching the repo convention.
- Do NOT delete my existing dynamic-import changes in `utils/auth.ts` for `getOauthProfileFromOauthToken`.

## Deliverable

When finished, write `docs/GIZZI_BUNDLER_PHASE_3_NOTES.md` starting with this exact YAML frontmatter:

```yaml
---
status: done
files_changed:
  - src/cli/ui/ink-app/services/oauth/scopes.ts
  - src/cli/ui/ink-app/services/oauth/client.ts
  - src/cli/ui/ink-app/services/oauth/getOauthProfile.ts
  - src/cli/ui/ink-app/utils/auth.ts
  - src/shared/runtime/services/oauth/scopes.ts
  - src/shared/runtime/services/oauth/client.ts
  - src/shared/runtime/services/oauth/getOauthProfile.ts
  - src/shared/utils/auth.ts
build_status: pass
typecheck_status: pass
deviations: []
remaining: []
---
```

Then add prose notes describing every cycle you broke and the final build/typecheck output.

Also create a sentinel file:

```bash
touch docs/GIZZI_BUNDLER_PHASE_3_NOTES.sentinel
```

The sentinel file tells the orchestrator you are done.
