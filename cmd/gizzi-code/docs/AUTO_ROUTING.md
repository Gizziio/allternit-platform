# Smart Model Auto-Routing

Gizzi automatically routes each request to the cheapest model capable of handling it. No configuration is required — connect a provider and routing happens transparently.

## How it works

Every conversation turn is scored across multiple dimensions (token count, code density, conditional logic, keyword signals, tool count, conversation depth). The score maps to one of four complexity tiers, and the cheapest model for that tier is selected from whichever providers are authenticated.

```
Request → Score (< 2ms) → Tier → Pick cheapest capable model → Dispatch
```

### Tiers

| Tier | Score range | What it handles |
|---|---|---|
| `simple` | < -0.1 | Greetings, definitions, yes/no |
| `standard` | -0.1 – 0.08 | General Q&A, moderate tasks |
| `complex` | 0.08 – 0.35 | Implementation, refactoring, architecture |
| `reasoning` | ≥ 0.35 | Formal proofs, deep analysis, theorem work |

### Default model assignment per provider

| Tier | Anthropic | OpenAI | Google |
|---|---|---|---|
| simple | claude-haiku-4-5 | gpt-4o-mini | gemini-2.0-flash-lite |
| standard | claude-haiku-4-5 | gpt-4o-mini | gemini-2.5-flash |
| complex | claude-sonnet-4-6 | gpt-4.1 | gemini-2.5-pro |
| reasoning | claude-opus-4-7 | o4-mini | gemini-2.5-pro |

When multiple providers are authenticated, the router picks across providers by cost — e.g. simple tasks prefer OpenAI's `gpt-4o-mini`, complex tasks prefer Anthropic's `claude-sonnet-4-6`.

### Momentum

Short follow-up messages inherit context from the previous turn's tier. A one-word reply after a complex refactor stays on the complex model rather than dropping to simple, preventing mid-conversation model thrashing. The last 5 tiers per session are tracked.

### Auto-discovery

When a new provider key is added, the tier map cache is invalidated and rebuilt on the next request. No restart required.

## Configuration (optional)

To pin specific models to tiers instead of using auto-detection, add a `routing` block to `gizzi.json`:

```json
{
  "routing": {
    "tiers": {
      "simple":    "anthropic/claude-haiku-4-5-20251001",
      "standard":  "anthropic/claude-haiku-4-5-20251001",
      "complex":   "anthropic/claude-sonnet-4-6",
      "reasoning": "anthropic/claude-opus-4-7"
    }
  }
}
```

When this block is present, auto-detection is bypassed entirely and the pinned models are used for all sessions.

## Architecture

### Scoring (`src/runtime/providers/provider.ts` → `resolveAuto`)

Called at dispatch time in `src/runtime/session/prompt.ts` whenever the session model is `auto/auto`. Uses `@allternit/request-scorer` (extracted from Manifest, zero dependencies, < 2ms) to score the last 3 user messages.

### Tier map (`buildAutoTiers`)

Scans all authenticated providers via `Provider.list()`, buckets their models by cost into percentiles, and assigns one model per tier. The result is cached by the sorted list of provider IDs — cache is invalidated automatically when authentication changes.

### SDK layer (`packages/sdk/src/harness/router.ts`)

The `AllternitHarness` SDK has its own lightweight router for BYOK mode. Pass `provider: "auto"` (or omit `provider` entirely) in a `StreamRequest` and the harness scores the messages and picks from the tier map built from `BYOKConfig.keys`.

```ts
const harness = new AllternitHarness({
  mode: 'byok',
  byok: { keys: { anthropic: '...', openai: '...' } },
});

// provider omitted — routes automatically
for await (const chunk of harness.stream({ messages })) { ... }
```

### `@allternit/request-scorer` package

Located at `packages/@allternit/request-scorer/`. Zero runtime dependencies. Exports a single function:

```ts
import { scoreRequest } from '@allternit/request-scorer'

const result = scoreRequest(
  { messages, tools, tool_choice },
  undefined,          // optional config overrides
  { recentTiers },    // optional momentum state
)
// result.tier: 'simple' | 'standard' | 'complex' | 'reasoning'
// result.score: number
// result.confidence: number
// result.reason: string
```

## Adding a new model

Edit `PROVIDER_LADDERS` in `packages/sdk/src/harness/router.ts` to update the SDK tier assignments. For the Gizzi runtime, `buildAutoTiers()` in `provider.ts` picks models dynamically by cost — no code change needed when a provider adds a new model to their API, only when you want to change the cost-bucketing logic.

## Disabling auto-routing

Set an explicit model in `gizzi.json`:

```json
{
  "model": "anthropic/claude-sonnet-4-6"
}
```

This bypasses `auto/auto` entirely and all sessions use the pinned model.
