# Porting Proven Brain-Selection Patterns into Gizzi

> This doc takes the production-tested implementations from Hermes, OpenClaw, Continue.dev, and Codex CLI and maps them to concrete changes inside `cmd/gizzi-code`.

---

## 1. The canonical model ref: adopt `providerID/modelID` everywhere

### What OpenClaw does

`src/agents/model-ref-shared.ts` normalizes every model reference into `{ provider, model }`, splitting on the **first** `/` so model IDs may themselves contain `/`:

```ts
export type ModelRef = { provider: string; model: string };

export function normalizeModelRef(
  provider: string,
  model: string,
  options?: ModelRefNormalizeOptions,
): ModelRef {
  const normalizedProvider = normalizeProviderId(provider);
  const normalizedModel = normalizeProviderModelId(normalizedProvider, model.trim(), options);
  return { provider: normalizedProvider, model: normalizedModel };
}
```

It also supports an optional `@profile` suffix and provider-ID normalization against a shared catalog.

### What Gizzi already has

`cmd/gizzi-code/src/runtime/providers/provider.ts:898-907` already parses `providerID/modelID`:

```ts
const MODEL_ALIASES: Record<string, string> = {
  "sonnet": "anthropic/claude-sonnet-4-6",
  "opus":   "anthropic/claude-opus-4-6",
  ...
}

export function parseModel(model: string) {
  const aliased = MODEL_ALIASES[model.toLowerCase()]
  if (aliased) model = aliased
  const [providerID, ...rest] = model.split("/")
  return { providerID, modelID: rest.join("/") }
}
```

### What to port / change

1. **Make `parseModel` the only entry point for model-ref strings.**  
   Today the platform UI in `surfaces/ai.allternit.com/src/lib/ai/models.ts` and `provider_routes.rs` build their own strings. Route every caller through `Provider.parseModel`.

2. **Add optional profile suffix support.**  
   In `provider.ts`, extend the parser to accept `providerID/modelID@profileID`:

   ```ts
   export type ModelRef = {
     providerID: string
     modelID: string
     authProfileId?: string
   }

   export function parseModel(model: string): ModelRef {
     const [modelPart, profileId] = model.split("@")
     const aliased = MODEL_ALIASES[modelPart.toLowerCase()]
     const normalized = aliased ?? modelPart
     const [providerID, ...rest] = normalized.split("/")
     return {
       providerID,
       modelID: rest.join("/"),
       authProfileId: profileId,
     }
   }
   ```

3. **Propagate `ModelRef` instead of `string`.**  
   - `SessionPrompt.CommandInput.model` is currently `z.string().optional()`. Change it to `ModelRef`.
   - `Session.create` currently takes no model. Add an optional `model: ModelRef` so the platform can pin a brain at session creation time.
   - `MessageV2.User.model` already stores `{ providerID, modelID }`. Add `authProfileId?: string` there.

---

## 2. Runtime/harness policy: resolve *how* to run before auth

### What OpenClaw does

`src/agents/model-runtime-policy.ts:213` resolves the runtime/harness in precedence order:

1. Exact agent model entry: `agents.entries[*].models["provider/model"].agentRuntime`
2. Provider model config: `models.providers[*].models[*].agentRuntime`
3. Wildcard agent model entry: `models["provider/*"].agentRuntime`
4. Provider-level config: `models.providers[*].agentRuntime`
5. If runtime is `auto`, implicit route defaults (e.g. OpenAI Platform → codex)

Then `src/agents/harness/selection.ts:290` selects a harness that can preserve the prepared provider/model/route/auth tuple, falling back to the built-in harness.

### What Gizzi already has

`cmd/gizzi-code/src/runtime/session/prompt.ts:2180-2192` resolves the model for a command with this precedence:

```ts
const taskModel = await (async () => {
  if (command.model) {
    return Provider.parseModel(command.model)
  }
  if (command.agent) {
    const cmdAgent = await Agent.get(command.agent)
    if (cmdAgent?.model) {
      return cmdAgent.model
    }
  }
  if (input.model) return Provider.parseModel(input.model)
  return await lastModel(input.sessionID)
})()
```

And `provider.ts:825-849` resolves the default model:

```ts
export async function defaultModel() {
  const cfg = await Config.get()
  const providers = await list()
  if (cfg.model && cfg.model !== "auto" && cfg.model !== "auto/auto") {
    const parsed = parseModel(cfg.model)
    if (parsed.providerID !== "auto") {
      await getModel(parsed.providerID, parsed.modelID)
      return parsed
    }
  }
  if (Object.keys(providers).length > 0) {
    return { providerID: "auto", modelID: "auto" }
  }
  throw new Error("No providers found. Run `gizzi auth add` to connect a provider.")
}
```

### What to port / change

1. **Introduce a `resolveRuntimePolicy` function in `provider.ts`.**  
   Given a `ModelRef`, return the intended harness/runtime:

   ```ts
   export type RuntimePolicy =
     | { type: "sdk"; providerID: string }
     | { type: "subprocess"; providerID: string; cmd: string }
     | { type: "auto" }

   export async function resolveRuntimePolicy(ref: ModelRef): Promise<RuntimePolicy> {
     const cfg = await Config.get()
     const provider = cfg.provider?.[ref.providerID]
     const modelEntry = provider?.models?.[ref.modelID]

     // 1. per-model runtime pin
     if (modelEntry?.runtime) return parseRuntime(modelEntry.runtime, ref.providerID)
     // 2. per-provider runtime pin
     if (provider?.runtime) return parseRuntime(provider.runtime, ref.providerID)
     // 3. provider auth_type implies subprocess
     const info = await getProvider(ref.providerID)
     if (info?.auth_type === "subprocess" && info.subprocess_cmd) {
       return { type: "subprocess", providerID: ref.providerID, cmd: info.subprocess_cmd }
     }
     // 4. default to SDK
     return { type: "sdk", providerID: ref.providerID }
   }
   ```

2. **Wire harness selection into `getLanguage`.**  
   Today `provider.ts:714-747` already branches on `auth_type === "subprocess"`. Generalize it to consult `resolveRuntimePolicy`:

   ```ts
   export async function getLanguage(model: Model): Promise<LanguageModelV2> {
     const policy = await resolveRuntimePolicy({ providerID: model.providerID, modelID: model.id })
     if (policy.type === "subprocess") {
       return new SubprocessLanguageModel(model.providerID, model.api.id) as unknown as LanguageModelV2
     }
     const sdk = await getSDK(model)
     ...
   }
   ```

3. **Add runtime policy to `Config.Provider` schema.**  
   In `src/runtime/context/config/config.ts:1168`, add:

   ```ts
   runtime: z.enum(["sdk", "subprocess", "auto"]).optional()
   ```

---

## 3. Auth profile store: separate secrets from selection state

### What OpenClaw does

`src/agents/auth-profiles/types.ts` defines:

```ts
type AuthProfile = {
  id: string
  type: "api_key" | "token" | "oauth"
  provider: string
  ...
}

type AuthProfileStore = {
  version: number
  profiles: Record<string, AuthProfile>   // secrets
  order: Record<string, string[]>         // per-provider selection order
  lastGood: Record<string, string>        // last working profile per provider
  usageStats: Record<string, UsageStats>  // rotation metadata
}
```

The key idea: **secrets live in `profiles`, rotation/cooldown/order live in sibling state fields.** Session pins store `authProfileOverride` plus `authProfileOverrideSource: "auto" | "user"` so auto-rotation never clobbers an explicit user choice.

### What Hermes does

`hermes_cli/auth.py` keeps `~/.hermes/auth.json`:

```json
{
  "version": 4,
  "active_provider": "nous",
  "providers": {
    "nous": { "access_token": "...", "refresh_token": "...", "expires_at": "..." }
  },
  "credential_pool": {
    "openrouter": [{ "access_token": "...", "source": "manual", "priority": 0 }]
  }
}
```

And `agent/credential_pool.py` supports rotation, exhaustion cooldown, and concurrency leases.

### What Gizzi already has

`cmd/gizzi-code/src/runtime/integrations/auth/auth.ts:10-38` has a simple auth store:

```ts
export namespace Auth {
  export const Oauth = z.object({
    type: z.literal("oauth"),
    refresh: z.string(),
    access: z.string(),
    expires: z.number(),
    accountId: z.string().optional(),
    enterpriseUrl: z.string().optional(),
  })

  export const Api = z.object({
    type: z.literal("api"),
    key: z.string(),
  })

  export const WellKnown = z.object({
    type: z.literal("wellknown"),
    key: z.string(),
    token: z.string(),
  })

  export const Info = z.discriminatedUnion("type", [Oauth, Api, WellKnown])
}
```

It stores one credential per provider ID. There is no per-provider multi-profile support, no rotation state, and no session pin provenance.

### What to port / change

1. **Introduce named auth profiles.**  
   In `auth.ts`, add:

   ```ts
   export type Profile = {
     id: string
     providerID: string
     credential: Info
     source: "user" | "env" | "oauth"
   }

   export type Store = {
     version: number
     profiles: Record<string, Profile>
     order: Record<string, string[]>   // providerID -> profileId[]
     lastGood: Record<string, string>  // providerID -> profileId
     sessionPins: Record<string, { profileId: string; source: "user" | "auto" }> // sessionID -> pin
   }
   ```

2. **Add profile-scoped getters/setters.**  
   Keep the existing `Auth.get(providerID)` as a convenience that returns the active profile for that provider, but add:

   ```ts
   export async function getProfile(profileId: string): Promise<Profile | undefined>
   export async function profilesForProvider(providerID: string): Promise<Profile[]>
   export async function setProfile(profile: Profile): Promise<void>
   export async function setOrder(providerID: string, order: string[]): Promise<void>
   ```

3. **Move platform API-key onboarding to this store.**  
   Today `surfaces/ai.allternit.com` posts keys to `/api/v1/onboarding/provider` and the Rust API presumably stores them somewhere. Instead, have the Rust API forward to Gizzi's `Auth.setProfile` so the runtime and UI see the same credential.

4. **Add session pin provenance.**  
   In `MessageV2.User.model` and session info, store:

   ```ts
   authProfileId?: string
   authProfileSource?: "user" | "auto"
   ```

   In the prompt loop, when resolving auth, prefer a user pin; only rotate an auto pin when the profile is on cooldown or incompatible.

---

## 4. Prepared auth plan: materialize route + auth before dispatch

### What OpenClaw does

`src/agents/runtime-plan/prepare-auth.ts:209` produces an `AgentRuntimeAuthPlan`:

```ts
type AgentRuntimeAuthPlan = {
  modelRoute: ProviderModelRoute
  authRequirement: "api-key" | "subscription"
  attempts: PreparedAgentRuntimeAuthAttempt[]
  forwardedAuthProfileId?: string
}
```

Each attempt is immutable: `{ provider, model, baseUrl, authMode, credential }`. The executor tries attempts in order. This makes retry, observability, and harness selection deterministic.

### What Hermes does

`hermes_cli/runtime_provider.py:1773` returns a runtime dict consumed by `AIAgent`:

```python
{
    "provider": "openrouter",
    "api_mode": "chat_completions",
    "base_url": "https://openrouter.ai/api/v1",
    "api_key": "...",
    "source": "env",            # env | pool:<key> | portal | oauth | ...
    "credential_pool": <pool>,
    "requested_provider": "auto",
    "extra_headers": {...},
}
```

### What Gizzi already has

`provider.ts:70-77` builds a base URL with env substitution:

```ts
function loadBaseURL(model: Model, options: Record<string, any>) {
  const raw = options["baseURL"] ?? model.api.url
  if (typeof raw !== "string") return raw
  return raw.replace(/\$\{([^}]+)\}/g, (match, key) => {
    const val = Env.get(String(key))
    return val ?? match
  })
}
```

And `getSDK` builds the AI SDK provider. But there is no explicit "auth plan" object; credentials are pulled ad-hoc inside `Provider.state` and `getLanguage`.

### What to port / change

1. **Create `Provider.AuthPlan`.**  
   In `provider.ts`:

   ```ts
   export type AuthPlan = {
     providerID: string
     modelID: string
     baseURL: string
     apiKey?: string
     token?: string            // bearer / oauth
     authType: "api_key" | "none" | "bearer" | "subprocess"
     extraHeaders: Record<string, string>
     source: "config" | "env" | "profile" | "oauth"
     profileId?: string
   }

   export async function prepareAuth(ref: ModelRef): Promise<AuthPlan> {
     const info = await getProvider(ref.providerID)
     const model = await getModel(ref.providerID, ref.modelID)
     const cfg = (await Config.get()).provider?.[ref.providerID]

     // 1. explicit profile
     if (ref.authProfileId) {
       const profile = await Auth.getProfile(ref.authProfileId)
       if (profile && profile.providerID === ref.providerID) {
         return buildPlanFromProfile(profile, model, cfg)
       }
     }

     // 2. env var
     for (const envKey of info.env) {
       const key = Env.get(envKey)
       if (key) {
         return {
           providerID: ref.providerID,
           modelID: ref.modelID,
           baseURL: loadBaseURL(model, cfg?.options ?? {}),
           apiKey: key,
           authType: info.auth_type ?? "api_key",
           extraHeaders: {},
           source: "env",
         }
       }
     }

     // 3. auth store profile order
     const profiles = await Auth.profilesForProvider(ref.providerID)
     const active = profiles[0]
     if (active) return buildPlanFromProfile(active, model, cfg)

     // 4. subprocess / none
     if (info.auth_type === "subprocess" || info.auth_type === "none") {
       return {
         providerID: ref.providerID,
         modelID: ref.modelID,
         baseURL: loadBaseURL(model, cfg?.options ?? {}),
         authType: info.auth_type,
         extraHeaders: {},
         source: "config",
       }
     }

     throw new Error(`No credentials for provider ${ref.providerID}`)
   }
   ```

2. **Pass `AuthPlan` into `getSDK` and `getLanguage`.**  
   Today `getSDK` derives credentials from `provider.options`. Instead, pass the plan:

   ```ts
   export async function getLanguage(model: Model, plan: AuthPlan): Promise<LanguageModelV2> {
     ...
     const sdk = await getSDK(model, plan)
     ...
   }
   ```

3. **Make the prompt loop resolve the plan once per turn.**  
   In `session/prompt.ts:408-443`, after resolving `resolvedModelRef`, call:

   ```ts
   const plan = await Provider.prepareAuth(resolvedModelRef)
   const model = await Provider.getModel(resolvedModelRef.providerID, resolvedModelRef.modelID)
   const language = await Provider.getLanguage(model, plan)
   ```

---

## 5. Provider abstraction: `BaseLLM`-style interface

### What Continue.dev does

`core/llm/index.ts` defines `BaseLLM`:

```ts
export abstract class BaseLLM implements ILLM {
  static providerName: string;
  static defaultOptions: Partial<LLMOptions> | undefined = undefined;

  // cross-cutting behavior
  async *streamChat(...) { ... }
  async *streamComplete(...) { ... }
  async embed(...) { ... }
  countTokens(text: string): number { ... }

  // provider-specific hooks
  protected abstract _streamChat(...)
  protected abstract _streamComplete(...)
  protected abstract _embed(...)

  // opt-in OpenAI adapter
  protected useOpenAIAdapterFor: (LlmApiRequestType | "*")[] = [];
}
```

Providers register in `core/llm/llms/index.ts`:

```ts
export const LLMClasses = [Anthropic, Cohere, Gemini, OpenAI, Ollama, ...];

export function llmFromDescription(desc: ModelDescription, ...) {
  const cls = LLMClasses.find((llm) => llm.providerName === desc.provider);
  return new cls({ ...cls.defaultOptions, ...desc });
}
```

### What Gizzi already has

Gizzi uses the Vercel AI SDK via `BUNDLED_PROVIDERS` in `src/runtime/providers/adapters/bundled.ts` and a `SubprocessLanguageModel` for CLI providers. There is no local abstraction that unifies SDK + subprocess + custom loaders.

### What to port / change

1. **Define a `Brain` interface in `provider.ts` or a new `brain.ts`.**  

   ```ts
   export interface Brain {
     readonly providerID: string
     readonly modelID: string
     stream(input: LLM.StreamInput): AsyncIterable<LLM.StreamOutput>
     complete(input: LLM.CompleteInput): Promise<string>
     embed(chunks: string[]): Promise<number[][]>
   }
   ```

2. **Implement two adapters.**  
   - `SdkBrain` wraps the Vercel AI SDK language model.
   - `SubprocessBrain` wraps `SubprocessLanguageModel`.

3. **Replace `Provider.getLanguage` with `Provider.getBrain`.**  

   ```ts
   export async function getBrain(ref: ModelRef): Promise<Brain> {
     const plan = await prepareAuth(ref)
     const model = await getModel(ref.providerID, ref.modelID)
     const policy = await resolveRuntimePolicy(ref)
     if (policy.type === "subprocess") {
       return new SubprocessBrain(model, plan)
     }
     return new SdkBrain(model, plan)
   }
   ```

4. **Use `getBrain` in `session/llm.ts`.**  
   Today `llm.ts` calls `Provider.getLanguage`. Replace with `Provider.getBrain(ref)` and call `brain.stream(input)`.

---

## 6. Layered config and profiles as overlays

### What Codex CLI does

`codex-rs/config/src/config_toml.rs`:

```rust
pub struct ConfigToml {
    pub model: Option<String>,
    pub model_provider: Option<String>,
    pub model_providers: HashMap<String, ModelProviderInfo>,
    pub profile: Option<String>,
    pub profiles: HashMap<String, ConfigProfile>,
    ...
}
```

Config layers (low → high precedence):

```
packaged defaults → system → cloud → user → profile → cwd/.codex → repo/.codex → runtime/CLI
```

Profiles are overlay files: `${CODEX_HOME}/<name>.config.toml`.

### What Gizzi already has

`src/runtime/context/config/config.ts:1268` already has:

```ts
model: ModelId.optional(),
small_model: ModelId.optional(),
routing: z.object({ tiers: ..., fallbacks: ... }).optional(),
auth: z.object({ active_profile, credential_store, profiles }).optional(),
provider: z.record(z.string(), Provider).optional(),
```

But there are no explicit config layers and no profile overlay files.

### What to port / change

1. **Add `profiles` directory support.**  
   In `src/runtime/context/global/paths.ts`, add `profiles: path.join(Global.Path.config, "profiles")`.

2. **Load layered config.**  
   In `src/runtime/context/config/config.ts`, change `Config.get()` to merge:

   ```ts
   const layers = [
     defaults,                 // packaged
     await loadSystemConfig(), // /etc/gizzi
     await loadUserConfig(),   // ~/.config/gizzi/config.toml
     await loadProfileConfig(cfg.profile), // ~/.config/gizzi/profiles/<name>.toml
     await loadProjectConfig(), // .gizzi/config.toml
   ]
   return mergeDeep(...layers)
   ```

3. **Deny-list dangerous keys in project config.**  
   Like Codex, prevent `.gizzi/config.toml` from setting `auth.profiles`, `provider.*.options.apiKey`, or `model_providers` so a repo cannot exfiltrate requests.

---

## 7. Session-scoped model pins with provenance

### What OpenClaw does

`src/config/sessions/types.ts:515-532`:

```ts
modelOverride?: string
modelOverrideSource?: "auto" | "user"
agentHarnessId?: string
authProfileOverride?: string
authProfileOverrideSource?: "auto" | "user"
```

`src/agents/auth-profiles/session-override.ts:245-429`:
- User pins are honored until the profile disappears or becomes incompatible.
- Auto pins rotate when the current profile is on cooldown or compaction occurs.
- Rotation stays within the same `authRequirement` route.

### What Hermes does

`hermes_cli/cli.py:5162-5258` stores `(model, billing_provider, billing_base_url, billing_mode, model_config)` per session row and restores on resume unless the user passed `-m`/`--provider` explicitly.

### What Gizzi already has

Gizzi pins the model on the user message (`MessageV2.User.model`). The prompt loop reads the last user message's model at `prompt.ts:409-421`. But there is no concept of a session-level default model, no provenance (`auto` vs `user`), and no explicit override from the API.

### What to port / change

1. **Add session model/auth pin to `Session.Info`.**  
   In `src/runtime/session/index.ts` where `Info` is defined (search `export const Info`), add:

   ```ts
   defaultModel?: { providerID: string; modelID: string; authProfileId?: string }
   defaultModelSource?: "user" | "auto"
   ```

2. **Set the pin at session creation.**  
   Update `Session.create` to accept `defaultModel` and store it.

3. **Use the pin when no per-message model is supplied.**  
   In `SessionPrompt.command`, change the fallback from `lastModel(sessionID)` to:

   ```ts
   async function lastModel(sessionID: string) {
     const session = await Session.get(sessionID)
     if (session.defaultModel) return session.defaultModel
     // fallback to last user message model
     ...
   }
   ```

4. **Expose pin provenance in API responses.**  
   The platform UI should know whether a model was auto-routed or explicitly pinned.

---

## 8. Explicit precedence chain

### What Hermes does

`hermes_cli/runtime_provider.py` and `auth.py` enforce:

```
CLI args > config.yaml > env > credential pool > OAuth fallback > AWS > error
```

This is documented and tested. Every resolution path respects it.

### What Gizzi already has

`provider.ts:249-574` merges provider state from:
1. `models.dev` catalog
2. `config.provider` overrides
3. Env vars (inside `Provider.state`)
4. Auth store (`Auth.all()`)
5. Plugin auth loaders

But the precedence is implicit in the merge order and hard to reason about.

### What to port / change

1. **Document the precedence in `provider.ts`.**  

   ```ts
   // Auth resolution precedence:
   // 1. Explicit authProfileId on the model ref
   // 2. Config provider block (options.apiKey, token, subprocess_cmd)
   // 3. Environment variables (provider.env)
   // 4. Auth store profiles, in configured order
   // 5. Plugin OAuth loaders
   // 6. Subprocess / none auth types
   ```

2. **Implement it in `prepareAuth` as a single function.**  
   Replace the scattered credential reads in `Provider.state` and `getSDK` with one `prepareAuth` call.

3. **Add tests.**  
   Write unit tests for `prepareAuth` that assert each precedence level wins over the next.

---

## 9. Fallback chains

### What OpenClaw does

- Model fallbacks: `agents.defaults.model.fallbacks` tried in order.
- Auth failover: profile rotation inside a provider before model fallback.
- Harness fallback: plugin harnesses can declare `fallbackRuntime: "openclaw"`; auto mode falls back to built-in.

### What Gizzi already has

`session/processor.ts:66-118` already implements cross-provider fallback:

```ts
const fallbackChain: { providerID: string; modelID: string }[] =
  input.fallbackModels ?? (cfg.routing?.fallbacks ?? []).map((entry: string) => Provider.parseModel(entry))
```

And `switchToFallbackModel` rotates through the chain on retryable errors.

### What to port / change

1. **Add auth-profile rotation before cross-provider fallback.**  
   In `SessionProcessor.process`, before calling `switchToFallbackModel` on an auth error, try the next auth profile for the same provider/model:

   ```ts
   if (MessageV2.AuthError.isInstance(error)) {
     const rotated = await Provider.rotateAuth(modelRef)
     if (rotated) {
       streamInput.authPlan = rotated
       continue
     }
   }
   ```

2. **Expose `fallbacks` in provider/model config.**  
   Already in `Config.routing.fallbacks`. Add per-provider fallbacks:

   ```ts
   // in Config.Provider
   fallbacks: z.array(ModelId).optional()
   ```

---

## 10. Concrete first slice

To prove the new contract without rewriting everything, do this:

1. **In `cmd/gizzi-code/src/runtime/providers/provider.ts`:**
   - Add `AuthPlan` type.
   - Add `prepareAuth(ref: ModelRef)`.
   - Add `authProfileId` to `ModelRef` / `parseModel`.

2. **In `cmd/gizzi-code/src/runtime/session/index.ts`:**
   - Add `defaultModel?: ModelRef` to `Session.create` and `Session.Info`.

3. **In `cmd/gizzi-code/src/runtime/session/prompt.ts`:**
   - Change `CommandInput.model` from `string` to `ModelRef`.
   - Use `lastModel` that prefers `session.defaultModel`.

4. **In `cmd/allternit-api/src/agent_session_routes.rs`:**
   - Accept `model: { providerID, modelID, authProfileId? }` from frontend.
   - Forward it to Gizzi `/v1/session` and `/v1/session/:id/initialize`.
   - Stop injecting `AppConfig.default_model()`.

5. **In `surfaces/ai.allternit.com/src/views/ChatView.tsx`:**
   - Pass `modelSelection` as `{ providerID, modelID }` into `createSession`.

6. **E2E test:**
   - Select `openai/gpt-5-mini` in chat.
   - Assert Gizzi session info has `defaultModel: { providerID: "openai", modelID: "gpt-5-mini" }`.
   - Assert the first user message carries the same ref.

This slice makes the platform's brain selection actually reach Gizzi. After it lands, port auth profiles, harness policy, and the model picker against a working contract.
