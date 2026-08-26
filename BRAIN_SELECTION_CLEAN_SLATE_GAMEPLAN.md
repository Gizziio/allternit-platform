# Allternit Brain Selection — Clean-Slate Reimplementation Gameplan

> Status: Research complete, awaiting review  
> Scope: How the platform selects a brain (provider/model/auth profile/harness) at runtime and surfaces that choice in Chat, Agent creation, Model Lab, and Settings.  
> Premise: The current drift is not a UI polish problem. The selection made in the frontend does not deterministically reach the runtime. We will fix the choreography first, then align the UI surfaces.

---

## 1. The Core Problem

"Cannot select a brain" is a **data-flow and contract problem**, not a modal styling problem. Today the UI can show a picker, but the choice dies before it reaches the runtime:

1. `ModelSelectionProvider.getBrainSessionConfig()` returns a `brain_profile_id` + `runtime_overrides.model_id`, but **no caller uses it**.
2. `ChatView.handleSend()` creates a backend session with **no brain information**, then passes only `modelSelection?.modelId` (bare model id, no provider) into `sendNativeMessageStream`.
3. `mode-session-store.ts` reconstructs a `provider/modelId` string from `localStorage`, not from the provider/model selection context, and falls back through `/api/onboarding/config` → Ollama → undefined.
4. `agent_session_routes.rs::create_session` **always overwrites** the model with `AppConfig.load().default_model()`, ignoring whatever the frontend sent.
5. `provider_routes.rs` and `lib/providers/provider-registry.ts` maintain **two parallel static registries** of providers/models that must be kept in sync by hand.

The result: the brain the user sees selected and the brain the runtime actually uses are decoupled. The modal feels broken because the underlying contract is broken.

---

## 2. Drift Inventory (What We Actually Have)

| Layer | File | What it does | Why it drifts |
|-------|------|--------------|---------------|
| Selection context | `providers/model-selection-provider.tsx` | Holds `{providerId, profileId, modelId, modelName}` | `getBrainSessionConfig()` is dead code; selection is never consumed by session creation |
| Session creation | `views/ChatView.tsx:406-464` | Creates session, calls `sendNativeMessageStream` | Passes only `modelId`, no provider/profile |
| Message transport | `lib/agents/mode-session-store.ts:594-609` | Builds `modelId` for `chatApi.streamChat` | Reads from `localStorage`, falls back to onboarding/Ollama, no profile |
| API client | `integration/api-client.ts:597-691` | Legacy `/api/chat` + new `/api/v1/agent-sessions` | Two different session/chat contracts coexist |
| Backend gateway | `cmd/allternit-api/src/agent_session_routes.rs:634-737` | Translates to Gizzi `/v1/session` | Always stamps `AppConfig.default_model()` into the payload |
| Backend discovery | `cmd/allternit-api/src/provider_routes.rs` | Static env/CLI provider specs + DB merge | Does not delegate to Gizzi runtime discovery |
| Frontend registry | `lib/providers/provider-registry.ts` | Static `PROVIDER_REGISTRY` with colors/install commands | Duplicates backend `CLI_PROVIDER_SPECS` and `ENV_PROVIDER_SPECS` |
| Frontend catalog | `lib/ai/models.ts` | Static `DEFAULT_MODEL`, `ALL_MODELS` from generated file | Hardcodes `anthropic/claude-sonnet-4-20250514`; not live |
| Model picker | `components/model-picker.tsx` | 1,300-line Command/Dialog | Reconstructs `profileId` heuristically; groups/search logic overlaps provider discovery |

**Key insight:** Allternit already has a runtime that solves most of this — the Gizzi/Multica runtime in `cmd/gizzi-code`. The platform UI is not talking to it correctly.

---

## 3. What Proven Open-Source Projects Do

We studied Hermes, OpenClaw, Continue.dev, Codex CLI, and Allternit's own Gizzi runtime. The patterns that matter:

### 3.1 Hermes — clean separation of transport vs auth
- `ProviderProfile` describes wire behavior (api_mode, base_url, vision, headers, fallback_models).
- `ProviderConfig` describes credential discovery (env vars, OAuth, AWS).
- Resolution precedence is explicit and enforced: **CLI args > config.yaml > env > credential pool > OAuth fallback**.
- `~/.hermes/auth.json` stores tokens; credential pools support rotation/exhaustion.
- Config loader normalizes legacy/ambiguous forms into a canonical shape at the chokepoint.
- Sessions persist `(model, provider, base_url, api_mode)` and restore on resume, while explicit CLI overrides still win.

**Borrow for Allternit:** separate provider transport metadata from auth/credential state; load and normalize config in one place; make precedence explicit instead of accidental.

### 3.2 OpenClaw — strict model-ref grammar and runtime policy
- Canonical model ref: `provider/model`, optionally `@profile`. First `/` splits provider from model (models may contain `/`).
- Runtime resolution happens **before auth**: model config → provider model config → wildcard → provider-level → implicit defaults.
- `AuthProfileStore` separates **secrets** (`profiles`) from **selection state** (`order`, `lastGood`, `usageStats`).
- `prepareAgentRuntimeAuth()` materializes a route + auth-mode + ordered candidate list **before** dispatch.
- **Auth rotation happens inside a provider before model fallback.**
- Session pins store provenance: `modelOverrideSource` / `authProfileOverrideSource` = `"auto" | "user"` so auto-rotation never silently overrides an explicit user choice.
- Harness selection probes each registered harness for support of the prepared provider/model/route/auth tuple; falls back to built-in.

**Borrow for Allternit:** strict `providerID/modelID` refs; resolve runtime/harness before auth; immutable auth plan; session pins with provenance.

### 3.3 Continue.dev — single LLM interface and role-based buckets
- `ILLM` interface + `BaseLLM` abstract class. New providers only implement transport hooks (`_streamChat`, `_streamComplete`, `_embed`).
- Providers are manually registered in `LLMClasses` — explicit, type-safe, discoverable.
- Config produces `modelsByRole` and `selectedModelByRole` (chat, edit, autocomplete, embed, rerank, subagent).
- `GlobalContext` persists per-profile model selections; `rectifySelectedModelsFromGlobalContext()` validates on reload and falls back gracefully.

**Borrow for Allternit:** a single backend-side `Brain` interface; role-based model buckets so chat, coding, autocomplete, and embedding can be configured independently; persisted selection with validation.

### 3.4 Codex CLI — layered config and provider trait
- Config layers: packaged defaults → system → cloud → user → profile → project-local → runtime/CLI.
- Profiles are overlay files (`${CODEX_HOME}/<name>.config.toml`), not duplicated configs.
- `ModelProviderInfo` for serialization + `ModelProvider` trait for runtime behavior.
- `ModelPreset` carries metadata (description, reasoning efforts, service tiers, picker visibility) instead of bare strings.
- Project-local `.codex/config.toml` is **deny-listed** from choosing `model_provider` / `model_providers` so a repo cannot exfiltrate requests.

**Borrow for Allternit:** layered config with explicit precedence; profiles as overlays; richer model metadata; deny-list for repo-owned provider/API-key choices.

### 3.5 Gizzi / Multica (Allternit's own runtime) — the part that already works
- Dynamic discovery: PATH-scan for 30+ CLI subprocess providers + local HTTP probes (Ollama, LM Studio, vLLM) + API/config providers.
- Canonical model ref: `{ providerID, modelID }`; `Provider.parseModel()` resolves aliases and splits on `/`.
- `Provider.resolveAuto()` classifies requests into tiers (simple/standard/complex/reasoning) and picks a capable model.
- Auth merged from config blocks → env vars → `~/.gizzi/auth.json` → plugin OAuth flows.
- Session loop resolves `auto` per-turn and validates with `Provider.getModel()`.
- Fallback chain from `cfg.routing.fallbacks[]`.
- Already exposes HTTP surfaces: `GET /providers`, `GET /config/providers`, `GET /providers/auth`, `POST /:providerID/oauth/*`, `GET /sidecar/models`, etc.

**Borrow for Allternit:** make Gizzi the single source of truth for provider/model discovery and auth state; proxy its endpoints instead of maintaining parallel static registries.

---

## 4. Mapping External Layers into Allternit Surfaces

| External concept | Where it maps in Allternit | Replaces |
|------------------|----------------------------|----------|
| `providerID/modelID` ref | Gizzi's `{providerID, modelID}` | `profileId`, `modelId`, `runtimeModelId`, `brain_profile_id` confusion |
| Provider transport profile | Gizzi `Provider.Info` + `Config.Provider` | Static `PROVIDER_REGISTRY`, `ENV_PROVIDER_SPECS`, `CLI_PROVIDER_SPECS` |
| Auth profile store | Gizzi `~/.gizzi/auth.json` + TOML `[auth]` profiles | Ad-hoc env-var checks in Rust/TS; onboarding provider-key posts |
| Model catalog | Gizzi `models.dev` + live `/providers` + `/sidecar/models` | `lib/ai/models.generated.ts`, `lib/ai/models.ts` |
| Runtime/harness policy | Gizzi `harness.mode` (byok/cloud/local/subprocess) + OpenClaw-style harness probes | Hardcoded `allternit` default model injection |
| Session model pin | Gizzi session `model` field + OpenClaw-style provenance | `localStorage` + optimistic IDs |
| Role-based selection | `modelsByRole` / `selectedModelByRole` (chat, code, autocomplete, embed) | Single global `DEFAULT_MODEL` |
| Fallback chain | `cfg.routing.fallbacks[]` already in Gizzi | None — currently missing |

### Surface-by-surface target state

| Surface | Today | Target |
|---------|-------|--------|
| **Chat composer / model picker** | Static provider registry, heuristic profile resolution, selection lost before session | Reads from `GET /api/v1/providers` (proxied from Gizzi); selection is `providerID/modelID`; pinned per-session |
| **Chat session creation** | Backend overwrites model with `AppConfig.default_model()` | Backend uses frontend `model` ref; falls back to Gizzi default only when absent |
| **Agent creation wizard** | May not expose harness/provider/model | Bind agent to `{providerID, modelID}` + `harness.mode`; persist in agent config |
| **Model Lab** | May not be wired to live local models | Use Gizzi `/sidecar/models/*` for search/install/remove |
| **Settings / provider auth** | Posts keys to `/api/v1/onboarding/provider` | Use Gizzi auth routes/API so runtime and UI see the same auth state |
| **Code mode / gizzi sessions** | Already passes `{providerID, modelID}` | Keep this contract; unify chat to use the same contract |
| **Cowork / design / browser** | Inherit broken chat plumbing | Inherit fixed chat plumbing |

---

## 5. Clean-Slate Gameplan

The plan is staged so we can stop the bleeding first, then replace the drifted layers one at a time without a big-bang rewrite.

### Phase 0 — Stop the bleeding (1 week)
1. **Feature freeze** on new model-picker UX polish and new provider onboarding flows until the contract is fixed.
2. **Add observability**:
   - Log the model ref selected by the user.
   - Log the model ref stamped on session creation.
   - Log the model ref used on each message send.
   - Surface a warning in the UI when they diverge.
3. **Document the canonical contract**: every brain selection is `{providerID, modelID}` plus an optional `authProfileId`. Nothing else.

### Phase 1 — Canonical data model (1 week)
1. Adopt Gizzi's model ref as the single currency:
   ```ts
   type BrainRef = { providerID: string; modelID: string; authProfileId?: string };
   ```
2. Replace `ModelSelection` (`providerId/profileId/modelId/modelName`) with `BrainRef` + display metadata.
3. Add a backend type `BrainSessionConfig = { brain_ref: BrainRef; source: "chat" | "terminal"; harness?: HarnessConfig }`.

### Phase 2 — Delete drift (2 weeks)
Delete or deprioritize:
- `ModelSelectionProvider.getBrainSessionConfig()` dead code path.
- `localStorage`-based model resolution in `mode-session-store.ts`.
- Static `DEFAULT_MODEL` and `ALL_MODELS` in `lib/ai/models.ts`.
- `AppConfig.default_model()` injection in `agent_session_routes.rs::create_session`.
- Legacy `/api/chat` path in `api-client.ts` and the Rust gateway; route everything through `/api/v1/agent-sessions`.
- Duplicate static registries in `provider_routes.rs` (env/CLI specs) and `provider-registry.ts`; keep only lightweight display metadata.

Keep:
- `ModelSelectionProvider` concept, reshaped to hold a `BrainRef`.
- Model picker UX pattern, but rewritten to consume live data.
- Gizzi runtime integration and the Rust API gateway structure.

### Phase 3 — Runtime-first provider discovery (2 weeks)
1. In `allternit-api`, proxy or call Gizzi's `GET /providers` and `GET /config/providers`.
2. Replace `/api/v1/providers` and `/api/v1/providers/auth/status` with Gizzi's discovered state.
3. Update `use-available-brain-models.ts` and `model-picker.tsx` to consume the new endpoints.
4. Ensure auth status reflects runtime truth (PATH, env, auth store) instead of static env checks.

### Phase 4 — Auth profile layer (2 weeks)
1. Align credential storage with Gizzi's auth store (`~/.gizzi/auth.json`) and TOML `[auth]` profiles.
2. Introduce `AuthProfile` concept in the UI/backend:
   - `type: "api_key" | "oauth" | "bearer" | "subprocess"`
   - Per-provider, multiple profiles allowed.
3. Provider connect flow calls Gizzi auth routes (API-key login, OAuth start/verify).
4. Model ref supports optional `@profile` suffix or explicit `authProfileId` field.

### Phase 5 — Deterministic selection plumbing (2 weeks)
1. `ChatView.handleSend()`:
   - If no live session, create one with the current `BrainRef`.
   - Pass `BrainRef` into `sendMessageStream`.
2. `mode-session-store.ts`:
   - Accept `brainRef` in `SendMessageOptions`.
   - Stop reading `localStorage`; use the provided ref or the session's pinned ref.
3. `agent_session_routes.rs::create_session`:
   - Read `model` from frontend body.
   - Use it directly; fall back to Gizzi default only if absent.
   - Persist the chosen ref in the Gizzi session metadata.
4. `agent_session_routes.rs::send_message`:
   - Use session-pinned model unless a per-message override is provided.

### Phase 6 — New model picker (2 weeks)
1. Replace the 1,300-line `model-picker.tsx` with a sheet-style picker:
   - Grouped by runtime kind: Installed CLIs, Cloud APIs, Local models.
   - Live status from `/api/v1/providers`.
   - Search across provider + model names + IDs.
   - Custom model ID entry with validation against provider.
   - Shows capabilities, context window, auth status.
2. Selection always emits a validated `BrainRef`.

### Phase 7 — Harness/runtime policy (2 weeks)
1. Per-agent `harness.mode` (byok / cloud / local / subprocess) from Gizzi config.
2. Runtime policy resolution like OpenClaw: exact model → provider model → provider-level → auto.
3. Harness selection probes (Gizzi built-in vs subprocess CLI vs plugin) based on prepared provider/model/auth tuple.
4. Expose fallback chain from `cfg.routing.fallbacks[]` in UI and runtime.

### Phase 8 — Migration & verification (2 weeks)
1. Migration script for existing sessions:
   - Map old `profile_id` strings to `providerID/modelID` where possible.
   - Mark unmapped sessions to use Gizzi default.
2. E2E tests:
   - User selects model X → session created with X → message sent with X.
   - Session resume restores pinned model.
   - Fallback chain exercised on provider error.
3. Telemetry dashboard for selection divergence warnings.

---

## 6. Delete vs Keep

### Delete
- Static `PROVIDER_REGISTRY` as source of truth (keep only display metadata: color, icon, install URL).
- `lib/ai/models.generated.ts` and hardcoded `lib/ai/models.ts` catalog.
- `ModelSelectionProvider.getBrainSessionConfig()` dead path.
- `localStorage` model selection persistence.
- `AppConfig.default_model()` fallback injection in session creation.
- Legacy `/api/chat` endpoint and dual API contracts.
- Heuristic `resolveProfileId()` in `model-picker.tsx`.

### Keep
- `ModelSelectionProvider` React context, retyped to `BrainRef`.
- `model-picker.tsx` UX shell, rewritten against live data.
- Gizzi runtime as the execution engine.
- Rust API gateway as the platform boundary.
- `/api/v1/agent-sessions` as the canonical session contract.

---

## 7. Recommended First Slice (MVP to prove the new contract)

Goal: make a user-selected model actually reach Gizzi in one deterministic path.

1. **Backend**: `agent_session_routes.rs::create_session` accepts a `model: {providerID, modelID}` from the frontend body and forwards it to Gizzi instead of `AppConfig.default_model()`.
2. **Frontend**: `ChatView.handleSend()` passes the full `ModelSelection` (provider + model) into `createSession`, and `createModeSessionStore.createSession` forwards it.
3. **Remove**: `AppConfig.default_model()` injection; fallback to Gizzi default only when no model is supplied.
4. **Test**: E2E that selecting `openai/gpt-5-mini` in the chat picker creates a Gizzi session with `providerID: "openai"`, `modelID: "gpt-5-mini"`.

This slice is small, testable, and proves the contract works end-to-end before we touch auth, discovery, or the picker UI.

---

## 8. Open Questions for Review

1. Do we want to support the optional `@profile` suffix in model refs (OpenClaw style) or keep `authProfileId` as a separate field?
2. Should the platform DB continue to store provider API keys, or do all credentials move to Gizzi's auth store/keyring?
3. Do we keep `models.dev` as the canonical catalog, or do we also want an OpenRouter-style aggregated catalog?
4. Should project-local config be able to influence model selection (Codex-style) or is that out of scope?
5. What is the desired behavior when the selected provider is offline/unauthenticated — block send, auto-fallback, or prompt to connect?

---

## 9. Sources Consulted

- Allternit codebase: `providers/model-selection-provider.tsx`, `lib/agents/mode-session-store.ts`, `views/ChatView.tsx`, `components/model-picker.tsx`, `integration/api-client.ts`, `lib/providers/provider-registry.ts`, `lib/ai/models.ts`, `cmd/allternit-api/src/provider_routes.rs`, `cmd/allternit-api/src/agent_session_routes.rs`.
- Allternit Gizzi runtime: `cmd/gizzi-code/src/runtime/providers/provider.ts`, `discovery/subprocess.ts`, `discovery/local.ts`, `context/config/config.ts`, `runtime/integrations/auth/auth.ts`, `runtime/session/prompt.ts`, `runtime/server/routes/provider.ts`.
- Hermes Agent: `hermes_cli/config.py`, `hermes_cli/auth.py`, `hermes_cli/runtime_provider.py`, `hermes_cli/model_switch.py`, `providers/base.py`, `providers/__init__.py`, `agent/credential_pool.py`.
- OpenClaw: `src/agents/model-ref-shared.ts`, `model-runtime-policy.ts`, `auth-profiles/order.ts`, `auth-profiles/session-override.ts`, `runtime-plan/prepare-auth.ts`, `harness/selection.ts`, `model-auth-provider.ts`.
- Continue.dev: `core/index.d.ts`, `core/llm/index.ts`, `core/llm/llms/index.ts`, `core/config/load.ts`, `core/config/selectedModels.ts`, `gui/src/components/modelSelection/ModelSelect.tsx`, `gui/src/redux/thunks/streamNormalInput.ts`.
- Codex CLI: `codex-rs/config/src/config_toml.rs`, `profile_toml.rs`, `loader/mod.rs`, `model-provider-info/src/lib.rs`, `model-provider/src/provider.rs`, `tui/src/chatwidget/model_popups.rs`.
