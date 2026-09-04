# Allternit Platform: Harness Implementation Plan

**Document Purpose:** Reference guide for implementing the Allternit AI Harness - a unified SDK that enables BYOK, Cloud, and Enterprise modes while maintaining control over system prompts, routing, and observability.

**Last Updated:** 2026-04-02

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ALLTERNIT PLATFORM                              │
├─────────────────────────────────────────────────────────────────────────┤
│  USER FACING                                                            │
│  ├── Gizzi CLI (Terminal)                                               │
│  ├── Web IDE (Browser)                                                  │
│  └── VS Code Extension                                                  │
│                              ↓                                          │
│  @allternit/sdk (Unified SDK)                                           │
│  ├── /core (HTTP client)                                                │
│  ├── /harness (AI logic + 4 modes)                                      │
│  └── /providers (Forked SDKs)                                           │
│                              ↓                                          │
│  ┌──────────────┬──────────────┬──────────────┐                        │
│  │   BYOK Mode  │  Cloud Mode  │ Local Mode   │                        │
│  │   (Free)     │  (Pro)       │ (Enterprise) │                        │
│  └──────────────┴──────────────┴──────────────┘                        │
│                              ↓                                          │
│  Providers: Anthropic, OpenAI, Google, Ollama, etc.                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Four Modes of Operation

### 1. BYOK Mode (Bring Your Own Key) - FREE TIER
**User provides their own API keys:**
```bash
gizzi auth add anthropic --key $ANTHROPIC_API_KEY
gizzi auth add openai --key $OPENAI_API_KEY
```

**Flow:**
1. User API keys stored locally (`~/.config/gizzi/auth.json`)
2. System prompts injected LOCALLY by harness
3. Direct API calls to providers (Anthropic, OpenAI, etc.)
4. Optional async telemetry to Allternit backend

**Control Points:**
- ✅ System prompts injected locally
- ✅ Local caching
- ✅ Unified interface
- ❌ No billing (user pays provider directly)
- ❌ Limited analytics (opt-in only)

---

### 2. Cloud Mode (Managed) - PRO TIER
**User authenticates with Allternit OAuth:**
```bash
gizzi auth login
```

**Flow:**
1. OAuth to `allternit.com`
2. Access token stored locally
3. ALL calls route through `api.allternit.com/v1/ai/*`
4. Backend injects prompts, routes to providers, tracks usage

**Control Points:**
- ✅ Full system prompt control
- ✅ Usage tracking & billing
- ✅ Rate limiting per tier
- ✅ Feature gating (models, tools)
- ✅ Centralized caching
- ✅ Fallback routing

---

### 3. Local Mode (Self-Hosted Models)
**User runs local models:**
```bash
gizzi provider add ollama --url http://localhost:11434
```

**Flow:**
1. Connect to local Ollama/LM Studio
2. System prompts injected locally
3. No cloud dependency
4. Optional license check for enterprise

**Control Points:**
- ✅ System prompts injected locally
- ✅ Local caching
- ❌ No cloud billing
- Optional: License validation

---

### 4. Subprocess Mode (CLI Tools)
**Use other CLI tools as backends:**
```bash
gizzi provider add claude-cli --command "claude -p"
gizzi provider add kimi-cli --command "kimi"
```

**Flow:**
1. Spawn subprocess (e.g., `claude -p`)
2. Write prompt via stdin
3. Read stdout/stderr
4. Parse and stream response

**Control Points:**
- ✅ System prompts prepended
- ⚠️ Limited control (depends on CLI tool)

---

## Directory Structure

```
packages/sdk/
├── src/
│   ├── core/
│   │   ├── client.ts          # Universal HTTP client
│   │   ├── auth.ts            # Auth token management
│   │   ├── errors.ts          # Error types
│   │   └── types.ts           # Shared types
│   │
│   ├── harness/
│   │   ├── index.ts           # AllternitHarness class
│   │   ├── types.ts           # Harness interfaces
│   │   ├── prompts.ts         # System prompt injection
│   │   ├── cache.ts           # Local caching
│   │   └── modes/
│   │       ├── byok.ts        # BYOK implementation
│   │       ├── cloud.ts       # Cloud gateway client
│   │       ├── local.ts       # Ollama/LM Studio
│   │       └── subprocess.ts  # CLI subprocess wrapper
│   │
│   ├── providers/
│   │   ├── anthropic/         # FORKED from @anthropic-ai/sdk
│   │   │   ├── index.ts       # AllternitAI client
│   │   │   ├── resources/
│   │   │   │   └── messages.ts
│   │   │   ├── streaming.ts   # SSE parsing
│   │   │   └── types.ts       # API types
│   │   │
│   │   ├── openai/            # FORKED from openai package
│   │   │   ├── index.ts       # AllternitOpenAI client
│   │   │   └── ...
│   │   │
│   │   ├── google/            # FORKED from @google/genai
│   │   │   ├── index.ts
│   │   │   └── ...
│   │   │
│   │   └── ollama/            # Native implementation
│   │       ├── index.ts
│   │       └── types.ts
│   │
│   └── index.ts               # Main exports
│
├── package.json
└── tsconfig.json
```

---

## Key Classes & Interfaces

### AllternitHarness (Main Entry Point)

```typescript
export class AllternitHarness {
  constructor(config: HarnessConfig);
  
  // Main streaming interface
  async *stream(request: StreamRequest): AsyncGenerator<HarnessStreamChunk>;
  
  // Non-streaming
  async complete(request: StreamRequest): Promise<HarnessResponse>;
  
  // Provider management
  async listProviders(): Promise<ProviderInfo[]>;
  async listModels(provider: string): Promise<ModelInfo[]>;
}

export interface HarnessConfig {
  mode: 'byok' | 'cloud' | 'local' | 'subprocess';
  byok?: BYOKConfig;
  cloud?: CloudConfig;
  local?: LocalConfig;
  subprocess?: SubprocessConfig;
}

export interface StreamRequest {
  provider: string;           // 'anthropic', 'openai', 'ollama', etc.
  model: string;              // 'claude-3-7-sonnet-20250219'
  messages: Message[];        // User messages
  temperature?: number;       // 0.0 - 1.0
  maxTokens?: number;         // Max output tokens
  tools?: Tool[];             // Available tools
  signal?: AbortSignal;       // Cancellation
}

export type HarnessStreamChunk =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; name: string; arguments: Record<string, unknown> }
  | { type: 'tool_result'; content: string }
  | { type: 'error'; error: AllternitError }
  | { type: 'done' };
```

### Forked Provider SDKs

```typescript
// All providers follow same pattern (rebranded)

export class AllternitAI {  // Was Anthropic
  constructor(opts: { apiKey: string; baseURL?: string });
  messages: {
    create(params: MessageParams): Promise<Message>;
    stream(params: MessageParams): AsyncGenerator<StreamEvent>;
  };
}

export class AllternitOpenAI {  // Was OpenAI
  constructor(opts: { apiKey: string; baseURL?: string });
  chat: {
    completions: {
      create(params: ChatParams): Promise<ChatCompletion>;
      stream(params: ChatParams): AsyncGenerator<ChatChunk>;
    };
  };
}
```

---

## System Prompt Injection

**This is the CRITICAL control point.** All modes inject Allternit's system prompts.

```typescript
// harness/prompts.ts

export const ALLTERNIT_SYSTEM_PROMPT = `You are Allternit, an advanced AI assistant integrated into the Allternit development platform.

CAPABILITIES:
- Write, edit, and analyze code across all major languages
- Execute terminal commands safely with user approval
- Manage files and projects intelligently
- Use tools to extend your capabilities

PERSONALITY:
- Direct and technical - get to the solution quickly
- Ask clarifying questions when requirements are ambiguous
- Always explain your reasoning for complex decisions
- Use markdown formatting for code and structured data

SAFETY:
- Never execute destructive commands without explicit approval
- Respect .gitignore and sensitive file patterns
- Warn about potential security issues in code

CONTEXT:
- You have access to the current working directory
- You can read files, execute commands, and edit code
- Sessions persist across conversations`;

export function injectSystemPrompt(
  messages: Message[],
  userId?: string
): Message[] {
  // Check for existing system message
  const hasSystem = messages.some(m => m.role === 'system');
  
  if (hasSystem) {
    // Augment existing system prompt
    return messages.map(m =>
      m.role === 'system'
        ? { ...m, content: `${ALLTERNIT_SYSTEM_PROMPT}\n\n${m.content}` }
        : m
    );
  }
  
  // Prepend Allternit system prompt
  return [
    { role: 'system', content: ALLTERNIT_SYSTEM_PROMPT },
    ...messages
  ];
}
```

---

## Backend API Endpoints (Cloud Mode)

### POST /v1/ai/stream
Main streaming endpoint for cloud mode.

**Request:**
```json
{
  "provider": "anthropic",
  "model": "claude-3-7-sonnet-20250219",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "temperature": 0.7,
  "max_tokens": 4096,
  "tools": [...]
}
```

**Response:** SSE stream
```
data: {"type": "text", "text": "Hello"}
data: {"type": "text", "text": " there"}
data: {"type": "done"}
```

### GET /v1/ai/models
List available models based on user's subscription tier.

**Response:**
```json
{
  "models": [
    {
      "id": "claude-3-7-sonnet-20250219",
      "name": "Claude 3.7 Sonnet",
      "provider": "anthropic",
      "tier": "pro",
      "capabilities": ["tools", "vision", "code"]
    }
  ]
}
```

### POST /v1/ai/complete
Non-streaming completion endpoint.

---

## Configuration Storage

### Local Config (`~/.config/gizzi/config.json`)
```json
{
  "version": "2.0.0",
  "mode": "cloud",
  
  "cloud": {
    "baseURL": "https://api.allternit.com",
    "accessToken": "oauth_access_token_here",
    "refreshToken": "oauth_refresh_token_here",
    "expiresAt": "2026-04-02T12:00:00Z"
  },
  
  "byok": {
    "anthropic": {
      "apiKey": "sk-ant-...",
      "lastVerified": "2026-04-01T10:00:00Z"
    },
    "openai": {
      "apiKey": "sk-..."
    }
  },
  
  "local": {
    "ollama": {
      "baseURL": "http://localhost:11434"
    }
  },
  
  "preferences": {
    "defaultProvider": "anthropic",
    "defaultModel": "claude-3-7-sonnet-20250219",
    "telemetryEnabled": true
  }
}
```

---

## Migration Strategy

### Phase 1: Parallel Implementation (Weeks 1-2)
- Fork SDKs to `packages/sdk/`
- Keep existing `@anthropic-ai/sdk` usage
- Add feature flag `GIZZI_USE_HARNESS=1`

### Phase 2: Testing (Weeks 3-4)
- Test BYOK mode with existing keys
- Validate system prompt injection
- Compare outputs (old vs new)

### Phase 3: Cloud Launch (Weeks 5-6)
- Deploy `/v1/ai/*` endpoints
- Launch OAuth flow
- Enable Pro subscriptions

### Phase 4: Deprecation (Weeks 7-8)
- Default to harness
- Remove direct SDK dependencies
- Update documentation

---

## Revenue Model

| Tier | Price | Mode | Features |
|------|-------|------|----------|
| **Free** | $0 | BYOK | All providers, local caching, community support |
| **Pro** | $20/mo | Cloud | Managed keys, priority routing, advanced models |
| **Team** | $50/mo | Cloud | + Team features, admin panel, usage analytics |
| **Enterprise** | Custom | Self-hosted | + On-premise, audit logs, custom contracts |

---

## File References

| Component | Path |
|-----------|------|
| Harness Core | `packages/sdk/src/harness/index.ts` |
| BYOK Mode | `packages/sdk/src/harness/modes/byok.ts` |
| Cloud Mode | `packages/sdk/src/harness/modes/cloud.ts` |
| Local Mode | `packages/sdk/src/harness/modes/local.ts` |
| Anthropic SDK | `packages/sdk/src/providers/anthropic/index.ts` |
| OpenAI SDK | `packages/sdk/src/providers/openai/index.ts` |
| System Prompts | `packages/sdk/src/harness/prompts.ts` |
| Backend Routes | `server/src/routes/ai.ts` |
| CLI Auth | `src/cli/commands/auth.ts` |
| Query Engine | `src/runtime/claude-core/query-engine.ts` |

---

## Quick Reference: Common Tasks

### Add a new provider
1. Create directory: `packages/sdk/src/providers/<name>/`
2. Implement provider client class
3. Add to `BUNDLED_PROVIDERS` in harness
4. Add auth command in CLI

### Update system prompts
1. Edit `packages/sdk/src/harness/prompts.ts`
2. All modes automatically use new prompt
3. Cloud mode updates immediately
4. BYOK/Local modes update on next CLI update

### Add new harness mode
1. Create file: `packages/sdk/src/harness/modes/<name>.ts`
2. Implement `StreamHandler` interface
3. Add mode to `HarnessConfig` type
4. Add case in `AllternitHarness.stream()`

### Deploy cloud endpoint
1. Add route to `server/src/routes/ai.ts`
2. Deploy to staging: `deploy staging`
3. Test with harness in cloud mode
4. Deploy to production: `deploy production`

---

## Glossary

| Term | Definition |
|------|------------|
| **Harness** | The unified AI interface that abstracts all providers |
| **BYOK** | Bring Your Own Key - user provides API keys |
| **Mode** | Operating mode: BYOK, Cloud, Local, or Subprocess |
| **Forked SDK** | Third-party SDK copied and rebranded as Allternit's |
| **System Prompt** | Base instructions injected into every conversation |
| **Cloud Gateway** | Allternit's backend API that routes to providers |

---

## Questions?

See the implementation todo list with `todo list` or reference the architecture diagrams above.

For technical decisions, refer to:
- `ARCHITECTURE.md` - System design
- `API.md` - Backend API specification
- `SDK.md` - SDK development guide
