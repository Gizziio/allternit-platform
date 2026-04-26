# ADR: Provider SDK Fork Strategy

**Date:** [Date]  
**Status:** Proposed  
**Owner:** [Name]  
**Review Date:** [Date + 2 weeks]

---

## Context

We need to decide whether to fork the Anthropic SDK (`@anthropic-ai/sdk`) and/or Claude Code SDK (`@anthropic-ai/claude-code`) for Gizzi-Code.

### Current State

- Gizzi-Code currently imports `@anthropic-ai/sdk` directly in multiple locations
- Provider-specific logic is scattered throughout the codebase
- Difficult to swap providers or add new ones
- Hard to test provider behavior in isolation

### Desired State

- Clean provider abstraction with stable interface
- All provider-specific logic isolated in `runtime/providers/anthropic/`
- Ability to swap SDK implementation without changing runtime code
- Support for multiple providers (Anthropic, OpenAI, Google, etc.) through unified interface

---

## Decision Drivers

### Forces

1. **Product Identity:** Provider integration is core to Gizzi-Code's value proposition
2. **Control:** Need guarantees around auth flow, error handling, and streaming behavior
3. **Maintenance:** Forking creates ongoing maintenance burden
4. **Upstream Compatibility:** Need to stay compatible with Anthropic API changes
5. **Dependency Size:** SDK transitive dependencies may be bloating bundle
6. **Testing:** Need to test provider behavior without calling real APIs

### Constraints

- Limited engineering bandwidth for maintaining forks
- Anthropic API may change, requiring SDK updates
- Need to support multiple auth modes (API key, enterprise, etc.)
- Must maintain streaming performance

---

## Options Considered

### Option 1: Wrap Only (Level 1 — Soft Fork)

**Approach:**
- Keep `@anthropic-ai/sdk` as external dependency
- Create `ProviderAdapter` interface in `runtime/providers/types.ts`
- Implement `AnthropicAdapter` in `runtime/providers/anthropic/adapter.ts`
- All SDK imports confined to `runtime/providers/anthropic/` directory
- No modifications to SDK itself

**Pros:**
- ✅ Minimal maintenance burden
- ✅ Automatic upstream updates
- ✅ Fast to implement (1-2 days)
- ✅ Low risk

**Cons:**
- ❌ Cannot fix SDK bugs
- ❌ Cannot add Allternit-specific helpers
- ❌ Still dependent on SDK API surface
- ❌ Cannot remove unused SDK features

**When to Choose:**
- SDK is stable and well-maintained
- SDK API surface is acceptable
- No need for custom auth flows
- Team bandwidth is limited

### Option 2: Maintained Mirror (Level 2 — Fork)

**Approach:**
- Fork `@anthropic-ai/sdk` to `@allternit/anthropic-sdk`
- Keep fork close to upstream (sync monthly or as needed)
- Remove unused surfaces (e.g., legacy APIs, unused helpers)
- Add Allternit-specific entrypoints (e.g., `createAllternitClient()`)
- Add normalized event stream helpers
- Publish to private npm registry or use Git dependency

**Pros:**
- ✅ Can remove unused code (reduce bundle size)
- ✅ Can add Allternit-specific helpers
- ✅ Can fix SDK bugs if needed
- ✅ More control over API surface
- ✅ Can optimize for Gizzi-Code use cases

**Cons:**
- ⚠️ Ongoing maintenance burden (sync with upstream)
- ⚠️ Risk of drift from upstream
- ⚠️ Need to monitor upstream for security patches
- ⚠️ Additional CI/CD complexity

**When to Choose:**
- SDK has features you don't need (bloat)
- Need custom auth flows or helpers
- SDK bugs block your use cases
- Team has bandwidth for maintenance

### Option 3: Full Internal Rewrite (Level 3 — Replace)

**Approach:**
- Replace `@anthropic-ai/sdk` with custom implementation
- Use raw `fetch()` or `undici` for HTTP calls
- Implement only the API methods you use:
  - `messages.create()`
  - `messages.stream()`
  - Tool call helpers
- Own the entire provider stack

**Pros:**
- ✅ Maximum control
- ✅ Minimal dependencies
- ✅ Can optimize for exact use cases
- ✅ No upstream dependency
- ✅ Can guarantee behavior

**Cons:**
- ❌ High implementation effort (2-4 weeks)
- ❌ Ongoing maintenance (API changes, new features)
- ❌ Risk of breaking changes from Anthropic
- ❌ Need to implement streaming, retries, error handling
- ❌ Team becomes responsible for protocol correctness

**When to Choose:**
- SDK is fundamentally incompatible with your architecture
- Need radical different behavior
- SDK is abandoned or poorly maintained
- Team has significant bandwidth
- Provider integration is core competitive advantage

---

## Decision

**Selected Approach:** **Option 1 (Wrap Only)** for now, with clear migration path to Option 2 if needed.

### Rationale

1. **Speed:** Can implement in 1-2 days vs 2-4 weeks
2. **Risk:** Low risk, easy to revert or change later
3. **Maintenance:** Minimal ongoing burden
4. **Flexibility:** Can upgrade to Option 2 if wrapper proves insufficient
5. **Focus:** Team can focus on building Allternit-native features, not maintaining SDK fork

### Conditions for Re-evaluation

We will re-evaluate and consider Option 2 if:

- SDK bugs block critical features
- Bundle size becomes a problem (>50MB transitive from SDK)
- Need custom auth flows not supported by SDK
- SDK API changes break our adapter frequently
- Team gains bandwidth for maintenance

---

## Implementation Plan

### Phase 1: Create ProviderAdapter Interface (Day 1)

**File:** `cmd/gizzi-code/src/runtime/providers/types.ts`

```typescript
export interface ProviderAdapter {
  id: "anthropic" | "openai" | "google" | "qwen" | "kimi";
  
  auth: {
    connect(input?: unknown): Promise<void>;
    status(): Promise<AuthStatus>;
    refresh(): Promise<void>;
    disconnect(): Promise<void>;
  };
  
  models: {
    list(): Promise<DiscoveredModel[]>;
    getCanonicalId(providerModelId: string): string;
  };
  
  chat: {
    stream(req: ChatRequest): AsyncIterable<ProviderEvent>;
    complete(req: ChatRequest): Promise<ChatResponse>;
  };
}

export interface AuthStatus {
  authenticated: boolean;
  type?: "api-key" | "oauth" | "service-account";
  expiresAt?: Date;
  scopes?: string[];
}

export interface DiscoveredModel {
  id: string;
  canonicalId: string;
  name: string;
  capabilities: ModelCapabilities;
  contextWindow: number;
  pricing?: ModelPricing;
}

export interface ChatRequest {
  model: string;
  messages: Message[];
  tools?: Tool[];
  maxTokens?: number;
  temperature?: number;
  // ... other fields
}

export type ProviderEvent = 
  | { type: "text-delta"; textDelta: string }
  | { type: "tool-call"; toolCallId: string; name: string; args: unknown }
  | { type: "finish"; usage: TokenUsage }
  | { type: "error"; error: Error };
```

### Phase 2: Implement AnthropicAdapter (Day 2-3)

**File:** `cmd/gizzi-code/src/runtime/providers/anthropic/adapter.ts`

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { ProviderAdapter, ChatRequest, ProviderEvent } from "../types";
import { AuthStore } from "@/runtime/auth/store";

export class AnthropicAdapter implements ProviderAdapter {
  id = "anthropic" as const;
  
  constructor(private authStore: AuthStore) {}
  
  private async getClient(): Promise<Anthropic> {
    const credentials = await this.authStore.getCredentials("anthropic");
    return new Anthropic({ apiKey: credentials.apiKey });
  }
  
  auth = {
    connect: async (input?: { apiKey?: string }) => {
      const apiKey = input?.apiKey ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("API key required");
      await this.authStore.setCredentials("anthropic", { apiKey });
    },
    status: async () => {
      const credentials = await this.authStore.getCredentials("anthropic");
      return {
        authenticated: !!credentials?.apiKey,
        type: "api-key",
      };
    },
    refresh: async () => {
      // API keys don't expire, but could re-validate
    },
    disconnect: async () => {
      await this.authStore.clearCredentials("anthropic");
    },
  };
  
  models = {
    list: async () => {
      const client = await this.getClient();
      // Use SDK to fetch models
      const models = await client.models.list();
      return models.data.map(m => ({
        id: m.id,
        canonicalId: this.models.getCanonicalId(m.id),
        name: m.display_name || m.id,
        capabilities: { /* map capabilities */ },
        contextWindow: m.context_window,
        pricing: { /* map pricing */ },
      }));
    },
    getCanonicalId: (providerModelId: string) => {
      // Map "claude-sonnet-4-20250514" → "gizzi.anthropic.sonnet"
      const mapping: Record<string, string> = {
        "claude-sonnet": "gizzi.anthropic.sonnet",
        "claude-opus": "gizzi.anthropic.opus",
        "claude-haiku": "gizzi.anthropic.haiku",
      };
      for (const [key, canonical] of Object.entries(mapping)) {
        if (providerModelId.includes(key)) return canonical;
      }
      return `gizzi.anthropic.${providerModelId}`;
    },
  };
  
  chat = {
    stream: async function* (req: ChatRequest): AsyncIterable<ProviderEvent> {
      const client = await this.getClient();
      
      const stream = client.messages.stream({
        model: req.model,
        messages: req.messages as any,
        tools: req.tools as any,
        max_tokens: req.maxTokens ?? 4096,
      });
      
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "text-delta", textDelta: event.delta.text };
        } else if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          yield {
            type: "tool-call",
            toolCallId: event.content_block.id,
            name: event.content_block.name,
            args: event.content_block.input,
          };
        } else if (event.type === "message_delta") {
          yield {
            type: "finish",
            usage: {
              promptTokens: event.usage?.input_tokens ?? 0,
              completionTokens: event.usage?.output_tokens ?? 0,
            },
          };
        }
      }
    },
    complete: async (req: ChatRequest) => {
      const client = await this.getClient();
      const response = await client.messages.create({
        model: req.model,
        messages: req.messages as any,
        tools: req.tools as any,
        max_tokens: req.maxTokens ?? 4096,
      });
      return {
        text: response.content.find(c => c.type === "text")?.text ?? "",
        toolCalls: response.content.filter(c => c.type === "tool_use").map(c => ({
          id: c.id,
          name: c.name,
          args: c.input,
        })),
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
        },
      };
    },
  };
}
```

### Phase 3: Lock All Anthropic Imports (Day 4)

**Rule:** Only `runtime/providers/anthropic/*` can import from `@anthropic-ai/sdk`

**ESLint Rule:** Add to `.eslintrc.json`:

```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "paths": [
          {
            "name": "@anthropic-ai/sdk",
            "message": "Import from @/runtime/providers/anthropic/ instead"
          }
        ],
        "patterns": [
          {
            "group": ["@anthropic-ai/*"],
            "message": "Import from @/runtime/providers/anthropic/ instead"
          }
        ]
      }
    ]
  }
}
```

### Phase 4: Update Runtime to Use Adapter (Day 5)

**Before:**
```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey });
const response = await client.messages.create({ /* ... */ });
```

**After:**
```typescript
import { ProviderRegistry } from "@/runtime/providers/registry";

const provider = await ProviderRegistry.get("anthropic");
const stream = provider.chat.stream({ /* ... */ });
```

### Phase 5: Add Architecture Tests (Day 6-7)

**File:** `test/architecture/provider-boundaries.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { parse } from "@swc/core";

describe("Provider Boundaries", () => {
  test("no @anthropic-ai/sdk imports outside runtime/providers/anthropic/", async () => {
    const files = await glob("src/**/*.ts");
    const violations: string[] = [];
    
    for (const file of files) {
      if (file.includes("runtime/providers/anthropic/")) continue;
      
      const content = await Bun.file(file).text();
      if (content.includes('@anthropic-ai/sdk')) {
        violations.push(file);
      }
    }
    
    if (violations.length > 0) {
      throw new Error(
        `Found @anthropic-ai/sdk imports outside allowed directory:\n` +
        violations.join("\n")
      );
    }
  });
});
```

---

## Consequences

### Positive

- Clean provider abstraction
- Easy to add new providers (OpenAI, Google, etc.)
- Testable in isolation
- Can swap SDK implementation later without changing runtime

### Negative

- Slight increase in code complexity (adapter layer)
- Need to maintain adapter as SDK evolves
- Small performance overhead (negligible)

### Risks

- **SDK Breaking Changes:** If Anthropic changes SDK API, adapter needs updates
  - **Mitigation:** Pin SDK version, test adapter on SDK updates
- **Adapter Drift:** Adapter may not expose all SDK features
  - **Mitigation:** Document which SDK features are used, add passthrough for advanced use cases

---

## Success Metrics

- [ ] All Anthropic SDK imports are inside `runtime/providers/anthropic/`
- [ ] Architecture tests pass
- [ ] Can add new provider (e.g., OpenAI) without changing runtime code
- [ ] No regression in streaming performance
- [ ] No increase in bundle size from adapter layer

---

## Review Date

This ADR will be reviewed on **[Date + 2 weeks]** to assess:

1. Is the wrapper sufficient?
2. Are there any blockers requiring a fork?
3. Should we upgrade to Option 2 (Maintained Mirror)?

---

## References

- Anthropic SDK Docs: https://docs.anthropic.com/claude/reference/client-sdks
- Claude Code SDK: https://github.com/anthropics/claude-code
- Vercel AI SDK: https://sdk.vercel.ai/docs

---

**Approved By:** [Name]  
**Approval Date:** [Date]  
**Next Review:** [Date + 2 weeks]
