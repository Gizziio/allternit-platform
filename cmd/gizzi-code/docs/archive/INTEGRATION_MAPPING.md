# REPL.tsx Integration Analysis

## Core Issue Discovered

The gizzi-code `src/` directory has a **different API** than what REPL.tsx (from free-code) expects.

### Example: bootstrap/state

**What REPL.tsx expects (from free-code/migration):**
```typescript
- snapshotOutputTokensForTurn(budget: number | null): void
- getCurrentTurnTokenBudget(): number
- getTurnOutputTokens(): number
- getBudgetContinuationCount(): number
- getTotalInputTokens(): number
- updateLastInteractionTime(): void
- getLastInteractionTime(): number
- getProjectRoot(): string
- switchSession(): void
- setCostStateForRestore(): void
- getTurnHookDurationMs(): number
- ... (50+ more functions)
```

**What gizzi-code/src/bootstrap/state.ts actually exports:**
```typescript
- createSession(modelSetting: ModelSetting): SessionId
- getCurrentSession(): SessionState | null
- getSessionId(): SessionId | null
- setSessionId(id: SessionId): void
- updateSessionActivity(): void
- clearSession(): void
- getModelSetting(): ModelSetting | null
- setModelSetting(setting: ModelSetting): void
- subscribeToSession(listener): () => void
- addSlowOperation(description: string, duration: number): void
- setOriginalCwd(cwd: string): void
- getOriginalCwd(): string
- setPermissionMode(mode: PermissionMode): void
- getPermissionMode(): PermissionMode
- ... (much simpler API)
```

## The Mismatch

| Component | REPL.tsx Expects | Gizzi-Code Has | Status |
|-----------|------------------|----------------|--------|
| bootstrap/state | 50+ functions for token tracking, session management, cost tracking | 15 functions, simplified session model | ❌ INCOMPATIBLE |
| utils/array | `count()` function | Basic array utils | ⚠️ Partial |
| utils/format | `formatTokens()`, `truncateToWidth()` | Different formatting utils | ⚠️ Partial |
| services/notifier | `sendNotification()` | Stub (3 lines) | ❌ MISSING |
| context/notifications | `useNotifications()` hook | Full implementation | ✅ EXISTS |
| services/preventSleep | `startPreventSleep()`, `stopPreventSleep()` | Not found | ❌ MISSING |
| types/ids | `asSessionId()`, `asAgentId()` | Different ID types | ⚠️ Partial |
| utils/debug | `logForDebugging()` | Stub (3 lines) | ⚠️ Partial |

## Conclusion

The gizzi-code `src/` directory contains **stubs and redesigned APIs**, not full implementations of the free-code/migration API.

To integrate REPL.tsx, you need to either:

1. **Port full implementations** from `migration/claude/src/` to `src/`, updating to match gizzi-code's architecture
2. **Create adapter layers** that translate between REPL.tsx's expected API and gizzi-code's actual API  
3. **Rewrite REPL.tsx** to use gizzi-code's existing API
4. **Use migration files directly** (but they're not integrated into the main codebase)

## Recommendation

Given the scope of changes needed, the most practical path is:

1. Keep using files from `migration/claude/src/` as the source of truth for full implementations
2. Copy specific files needed by REPL.tsx into the appropriate `src/` locations
3. Update REPL.tsx imports to point to actual locations
4. Install missing npm dependencies (`auto-bind`, `react-reconciler`, `chalk`, etc.)

This is not a simple "diff and map" - it's a substantial API integration effort.
