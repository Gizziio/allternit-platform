---
status: done
reviewer: claude
summary: The thesis and layering are sound, but the spec treats a streaming, stateful, ambiguously-acknowledged web UI like a request/response API and needs an event-stream adapter contract, at-most-once submission semantics, pool-based quota and cooldowns, detached long-running tasks, a real localhost threat model, and a much thinner MVP before implementation starts.
---

# Review: Subscription Capability Fabric (Architecture)

Reviewer: Claude (architecture). Subject: `docs/specs/subscription-fabric/SPEC.md` (2026-09-25).
Grounded against `REPO_STRUCTURE.md`, `platform/packages/{browser-tools,replies-contract,provider-adapters}`, `services/`, and the existing `chatgpt-image` / `media-router` skills (which already run a ChatGPT web lane for images and keep a usage ledger).

## Verdict

**Approve the direction. Block implementation until the critical issues below are fixed.**

The core invariant in §44 is right: bots request capabilities, the fabric picks entitlements, adapters execute, and artifacts come back normalized. So is the adapter-disposability rule (§5, §42). The problem is that the contracts that would enforce those ideas are written for a synchronous, reliable, idempotent backend. A consumer web UI is none of those things:

- **It streams.** `execute(): Promise<TaskResult>` (§29) can't express that.
- **Sending a prompt is not idempotent, and its acknowledgment can be ambiguous.** Nothing in §19/§20/§31 handles "we clicked send, then crashed."
- **It degrades silently.** Providers quietly switch to a weaker model when a cap is hit. Nothing in §11/§33 detects this.
- **Some capabilities run on the provider side for 5–30 minutes** (deep research, Kimi websites/slides). A single-flight worker (§19) would be blocked the whole time.
- **The daemon holds live sessions that can drive paid accounts and read full chat history.** §25 treats it like an ordinary localhost API.

About two-thirds of the spec is scope (seven artifact families, projects, publish, UI, economics) that should wait until the chat and image slice has shown that session health and completion detection hold up for weeks.

## Critical issues

1. **The adapter contract can't stream, report progress, or be cancelled mid-flight (§29, §19).**
   `execute(task): Promise<TaskResult>` gives no way to emit text deltas, progress ("researching 14 sources"), partial artifacts, or a "needs user" pause. And `cancel(taskId)` on the adapter is the wrong layer, because the worker owns the page and the in-flight state.
   **Fix:** make `execute` return `AsyncIterable<AdapterEvent>` and take an `ExecutionContext` that carries an `AbortSignal`, a scoped page lease, an artifact sink, and a clock. Cancellation becomes `signal.abort()`, and the adapter must then click the provider's Stop button and report `cancelled` with whatever partial output exists. See "Architecture changes → A1" for signatures.

2. **Submission ambiguity and duplicate spend (§19, §20, §31).**
   The most dangerous failure in a UI bridge is: the prompt was typed and sent, then the worker, browser, or network died before we saw acknowledgment. A blind retry creates a duplicate provider turn, spends quota twice, and corrupts the thread mapping.
   **Fix:**
   - Add `submission_state: "not_sent" | "sent_unconfirmed" | "acknowledged"` to each task attempt.
   - Treat every provider-side submit as **at-most-once**.
   - On restart, an attempt in `sent_unconfirmed` must run a *reconcile* step: open the mapped provider thread, look for the last user turn, and match it against `prompt_fingerprint` (a sha256 of the normalized prompt). It then either adopts the existing turn or marks the failure `submission_ambiguous`. It never resubmits automatically.
   - Add a caller-supplied `idempotency_key` to the task.

3. **Long-running provider-side tasks block the single-flight worker (§17, §19, §34).**
   Deep research, Kimi slides/websites, and ChatGPT agent-style tasks run on the provider's servers for minutes. With `1 active UI task per provider worker`, one research run freezes chat for that provider for 20+ minutes.
   **Fix:** split worker capacity into two kinds of slot:
   - an **interactive slot**, concurrency 1, which covers typing, submitting, and extracting;
   - **detached watches**, a bounded N, where the provider is working server-side and the worker only needs to poll the thread URL later.

   Adapters declare for each capability whether it can be detached (`detachable: true`). After acknowledgment, the adapter emits `detached { resume_token }`. The worker frees the interactive slot and schedules `resume(resume_token)` on a backoff. Add task status `provider_running`.

4. **The quota model has no concept of shared pools, silent downgrades, or cooldowns (§11, §33).**
   - The entitlements are listed per capability, but providers enforce limits per *pool*, and one pool can cover several capabilities (chat and file analysis share one model's message cap, for example). A pool can also be model-specific.
   - The spec never covers silent downgrade: ChatGPT keeps answering on a smaller model after a cap. The task "succeeds," but the entitlement actually used wasn't the one selected.
   - "Unknown" has no routing semantics.

   **Fix:**
   - Introduce a `QuotaPool` entity keyed by `(provider, account_id, pool_id)`. Capabilities point to it through `pool_id`.
   - Record `observed_model` on every attempt and compare it with `requested_model`. A mismatch emits a `quota.degraded` signal and moves the pool to `degraded`.
   - Define router behavior under uncertainty (see "Architecture changes → A4"): local budgets, cooldowns with exponential backoff, and a circuit breaker. Real tasks are never used as probes against a pool marked exhausted.

5. **Session health is a single `health()` call with no drift detection and no challenge semantics (§17, §29, §31, §34).**
   Real failures come in several distinct shapes: logged out, a challenge or verification interstitial, account restricted, a UI redesign (selectors gone), or a provider outage. Each needs a different response, and `health()` can't tell them apart.
   **Fix:**
   - Add a `SessionHealth` state machine: `ready | degraded | auth_required | challenge_presented | account_restricted | ui_drift | provider_down | profile_locked`.
   - Add a **non-spending canary** (`adapter.probe()`) that loads the app and checks every *critical* locator without submitting anything. Run it on worker start, after any `selector_not_found`, and on a 15–30 minute idle timer.
   - When a challenge or restriction is detected, **halt the whole worker**, pause its queue, notify the user through the desktop shell, and never retry automatically. The worker resumes only after a user-confirmed `resume` or a clean probe.

6. **Profile ownership conflicts (§25, §34).**
   A Chromium user-data-dir can be locked by only one process at a time. That breaks two things:
   - §25 "allow user to open provider session manually" conflicts with a persistent worker that holds the profile.
   - The existing `chatgpt-image` skill already uses its own profile, `/Users/joe/.chatgpt-image-profile`. The same account now has two automation identities that will fight each other for session tokens (rotating refresh tokens can log one of them out).

   **Fix:**
   - The gateway is the **sole owner** of each profile. "Open manually" means the gateway brings its own headful window to the front (or detaches the worker, releases the lock, and hands the window to the user), then reattaches after the user is done.
   - Detect `SingletonLock` and report `profile_locked`.
   - Migrate the `chatgpt-image` lane onto the fabric (media-router calls `image.generate` through the gateway) instead of running two profiles for one account.

7. **Thread mapping assumes one stable 1:1 mapping (§15).**
   Real cases break that assumption:
   - fallback moves a thread to another provider mid-conversation;
   - the user continues the conversation by hand in the provider UI;
   - the provider thread is deleted or archived;
   - the model is switched inside the thread;
   - the provider's "memory" feature learns from bot prompts.

   **Fix:**
   - Make the mapping 1:N with an epoch (schema below).
   - Store `last_synced_turn_index` and `last_turn_fingerprint`. Before continuing a thread, the adapter checks for divergence; on mismatch it emits `thread.diverged` and applies the `on_divergence` policy (`adopt | fork | fail`).
   - Cross-provider fallback on a thread-bound task has to be opt-in (`allow_thread_migration`), and it requires an explicit context-transfer strategy (`summary | full_replay | none`). Without that, the fallback provider answers with no context and the result looks like success.

8. **The localhost daemon threat model is missing (§25).**
   "Bind localhost; token only if exposed" isn't enough. Any local process, and **any web page in the user's browser** (via CSRF or DNS rebinding against `127.0.0.1:7788`), could drive paid accounts and read chat history. Other gaps:
   - `inputs[].path` (§21) is an arbitrary local-file-read primitive that also uploads the file to a third party.
   - Downloaded "website" artifacts are untrusted HTML/JS that Allternit surfaces would render.
   - Provider output flows into bots as untrusted text, which is a prompt-injection path into agents with tools.

   See "Architecture changes → A6" for concrete controls. The minimum is: always require a token (including on localhost), strictly validate `Host` and `Origin`, and prefer a Unix domain socket.

9. **Outward-facing and irreversible capabilities have no approval gate (§9, §32).**
   `website.publish`, and later anything that shares links, runs scheduled tasks, or posts, publishes content to the public internet under the user's identity. Autonomous bots can't trigger that unattended.
   **Fix:**
   - Add `side_effects: "none" | "provider_state" | "external_publish"` to each capability.
   - `external_publish` requires a human approval token (`approval_id`) bound to the specific task and preview. Policy can't turn this off in the MVP.

10. **Where the code lives and what it runs on are undecided and conflict with repo rules (§18, §28).**
    §18 leaves "Python or TypeScript" open, and §28 proposes a standalone `subscription-fabric/` root, which would violate the `REPO_STRUCTURE.md` ownership rules (no new roots; daemons go in `services/`, contracts and TS libs in `platform/packages/`). The repo already has Playwright infrastructure in `@allternit/browser-tools` and a canonical streaming vocabulary in `@allternit/replies-contract` (`ReplyEvent`, `ArtifactReplyItem`).
    **Fix:** use **TypeScript/Node**, with the layout in "Architecture changes → A7". Map chat streaming onto `ReplyEvent` so Thread UIs reuse the existing reducers (`@allternit/replies-reducer`) instead of adopting a third event dialect.

## Schema changes

### S1. Capability taxonomy (§9): separate capabilities from operations

The §9 list mixes three different kinds of thing:

- **Capabilities** (`image.generate`, `presentation.create`).
- **Artifact operations** (`image.download`, `*.export`, `file.download`). These are operations on an artifact that already exists, so they belong on the artifact API: `POST /v1/artifacts/{id}/export`.
- **API verbs** (`task.create`, `task.status`, `task.cancel`, `chat.thread.list`, `project.list`). These are gateway endpoints, not entitlements.

Remove the last two groups from the capability namespace.

Other problems:

- `reasoning` shows up in the §10 manifest but isn't in the taxonomy. It's a **modifier**, not a capability. Model it as `options.model_class: "fast" | "standard" | "reasoning" | "deep"`, with the adapter mapping each class to a concrete provider model.
- `/v1/code` (§8) and the `video`/`audio` artifact types (§13) have no capabilities behind them. Either add `code.generate` and `video.generate` or remove the endpoints and types.
- `research.run` hides a real split between fast search and deep research. Deep research is long-running (Critical #3) and usually on its own pool. Split it into `research.quick` and `research.deep`.
- `website.preview` isn't a capability. It's a field on the artifact (`preview`).

Revised capability definition (flat and dot-named, used by both the registry and manifests):

```ts
type CapabilityId = `${string}.${string}`; // e.g. "presentation.create"

interface CapabilityDef {
  id: CapabilityId;
  version: number;                       // bump on input/output contract change
  input_schema: JSONSchema;              // options per capability (n, aspect_ratio, format, slide_count…)
  output_artifact_types: ArtifactType[];
  side_effects: "none" | "provider_state" | "external_publish";
  requires_thread: boolean;              // chat.continue, research.continue, *.edit
  long_running_hint: boolean;            // eligible for detached execution
}
```

### S2. Provider manifest (§10): flat, typed, and not hand-scored

The nested `capabilities: { chat: { thread_create: true } }` shape in §10 doesn't match the dot-names in §9, and `reliability.score: 0.70` is a guess dressed up as a number. Replace it with:

```ts
interface AdapterManifest {
  adapter_id: string;                  // "kimi_web" — stable across versions
  adapter_version: string;             // semver; "kimi_web@1.3.0"
  provider: ProviderId;                // "kimi"
  interface: "official" | "ui_bridge_web" | "ui_bridge_desktop";
  origins: string[];                   // ["https://www.kimi.com"] — navigation allowlist
  auth: { login_url: string; logged_in_probe: string /* locator key */ };
  plans: PlanDef[];                    // plan tiers this adapter understands
  capabilities: Array<{
    id: CapabilityId;
    min_capability_version: number;
    plans: string[];                   // which plan tiers expose it
    pool_id: string;                   // → QuotaPool
    detachable: boolean;
    export_formats: string[];          // ["pptx","pdf"]
    max_inputs?: { files: number; bytes_per_file: number };
    status: "stable" | "beta" | "disabled";
  }>;
  pacing: PacingProfile;               // see A5
  selectors_version: string;           // ties to selector registry pack
}
```

Reliability is **measured**, not declared. It's a rolling success rate per `(adapter_version, capability)` from the event log, stored in `adapter_stats`.

### S3. Entitlements and quota (§11, §33)

```ts
interface Account {
  account_id: string;                  // local id, "acct_chatgpt_01"
  provider: ProviderId;
  label: string;                       // "Eoj — ChatGPT Pro"
  plan: string | null;                 // observed plan tier; null = unknown (never guessed)
  plan_observed_at: string | null;
  profile_ref: string;                 // opaque handle to gateway-owned profile dir
  session_health: SessionHealth;
  enabled: boolean;
}

interface QuotaPool {
  pool_key: string;                    // `${provider}:${account_id}:${pool_id}`
  pool_id: string;                     // "gpt-reasoning-msgs", "image-gen", "kimi-slides"
  state: "available" | "estimated" | "unknown" | "degraded" | "cooling_down" | "exhausted";
  remaining: number | null;
  remaining_confidence: "exact" | "estimated" | "none";
  window: { kind: "rolling" | "fixed" | "unknown"; seconds: number | null };
  reset_at: string | null;
  reset_at_source: "provider_ui" | "error_message" | "documented" | "inferred" | null;
  local_used_in_window: number;        // our own counter
  local_budget: number | null;         // user/adaptive soft cap (see A4)
  cooldown_until: string | null;
  last_signal: QuotaSignal | null;
  updated_at: string;
}

interface QuotaSignal {
  kind: "limit_banner" | "hard_error" | "model_downgraded" | "slow_mode" | "reset_notice" | "counter_visible";
  raw_excerpt: string;                 // redacted, ≤ 500 chars, for audit
  observed_at: string;
  task_id: string | null;
}

interface Entitlement {                // derived view, not a stored source of truth
  account_id: string;
  capability: CapabilityId;
  pool_key: string;
  available: boolean;                  // plan exposes it AND adapter status stable|beta AND health ready|degraded
  reason_unavailable?: string;
}
```

`Entitlement` should be a **computed join** of Account × Manifest × QuotaPool × SessionHealth. If it's stored as its own record (the way §11 reads), it'll drift out of sync with them.

### S4. Task (§20)

```ts
interface Task {
  task_id: string;
  idempotency_key: string | null;      // caller-supplied; unique per requester
  capability: CapabilityId;
  capability_version: number;
  requester: { kind: "bot" | "user" | "cli" | "system"; id: string; bot_id?: string };
  thread_id: string | null;
  project_id: string | null;
  parent_task_id: string | null;       // research.continue, *.edit chains
  prompt: string;
  inputs: TaskInput[];
  options: Record<string, unknown>;    // validated against CapabilityDef.input_schema
  routing: {
    mode: "auto" | "prefer" | "force";
    provider?: ProviderId;
    account_id?: string;
    allow_fallback: boolean;           // default true within subscriptions, false across thread boundary
    allow_metered: boolean;            // default false (§32)
    allow_thread_migration: boolean;   // default false (Critical #7)
  };
  constraints: {
    sensitivity: "public" | "internal" | "confidential" | "local_only";
    deadline_at: string | null;
    max_metered_usd: number | null;
    required_export_format: string | null;
  };
  approval_id: string | null;          // required when side_effects = external_publish
  priority: "interactive" | "normal" | "background";
  status: TaskStatus;
  status_detail: string | null;        // human-readable ("waiting for login", "provider researching")
  route_decision: RouteDecision | null;
  attempts: TaskAttempt[];
  result: { artifact_ids: string[]; text?: string } | null;
  error: TaskError | null;
  created_at: string; updated_at: string; completed_at: string | null;
}

type TaskStatus =
  | "queued" | "routing" | "waiting_worker"      // replaces "waiting_provider" ambiguity
  | "running" | "streaming" | "provider_running" // provider_running = detached (Critical #3)
  | "needs_user"                                  // auth/challenge/approval; pauses, does not fail
  | "completed" | "partial"                       // partial: text ok but artifact download failed, etc.
  | "failed" | "cancelled";
// "artifact_ready" (§19) is removed from status: it is an event, and a task can emit several.

interface TaskAttempt {
  attempt_no: number;
  adapter_id: string; adapter_version: string;
  account_id: string; pool_key: string;
  submission_state: "not_sent" | "sent_unconfirmed" | "acknowledged";
  prompt_fingerprint: string;          // sha256(normalized prompt + input hashes)
  provider_thread_id: string | null;
  requested_model_class: string | null;
  observed_model: string | null;       // Critical #4 — silent downgrade detection
  started_at: string; ended_at: string | null;
  outcome: "success" | "partial" | "failed" | "cancelled" | "ambiguous";
  error: TaskError | null;
}

type TaskInput =
  | { type: "artifact"; artifact_id: string }
  | { type: "file"; path: string; sha256: string; size_bytes: number } // path must pass allowlist (A6)
  | { type: "text"; name: string; content: string }
  | { type: "url"; url: string };
```

### S5. Artifact (§13)

Fields to add: `sha256`, `size_bytes`, `bot_id` (§37 filters the shelf by bot, but the metadata has no bot field), `adapter_version`, `retrieval_state`, `version`/`parent_artifact_id` for edit chains, and `provider_url_expires_at` (download URLs from providers are often signed and short-lived).

`preview_url` also has to be split. A provider URL needs the provider session to open and can't be rendered inside Allternit.

```ts
interface Artifact {
  artifact_id: string;
  type: ArtifactType;                  // + "html_app" (§14 already uses it; add to canonical list)
  mime_type: string | null;
  format: string | null;               // "pptx", "xlsx", "png"
  title: string | null;
  source: {
    task_id: string; attempt_no: number; capability: CapabilityId;
    provider: ProviderId; account_id: string; adapter_id: string; adapter_version: string;
    provider_artifact_id: string | null;
    provider_url: string | null;       // opens in provider (needs session)
    provider_url_expires_at: string | null;
  };
  context: { thread_id: string | null; project_id: string | null; bot_id: string | null };
  storage: {
    retrieval_state: "remote_only" | "downloading" | "local" | "failed" | "expired";
    local_path: string | null;         // relative to artifact store root; never arbitrary
    sha256: string | null; size_bytes: number | null;
    local_preview_path: string | null; // rendered thumbnail / sandboxed HTML bundle
  };
  lineage: { version: number; parent_artifact_id: string | null };
  capabilities: { editable_via: CapabilityId[]; export_formats: string[] };
  trust: "untrusted_provider_output";  // constant for ui_bridge; drives sandboxed rendering (A6)
  sensitivity: Task["constraints"]["sensitivity"];
  created_at: string;
}
```

### S6. Thread mapping (§15)

```ts
interface ThreadMapping {
  mapping_id: string;
  thread_id: string;                   // Allternit thread
  epoch: number;                       // increments on migration to another provider/account
  provider: ProviderId; account_id: string; adapter_id: string;
  provider_thread_id: string;
  provider_project_id: string | null;
  provider_url: string;
  last_synced_turn_index: number;      // provider-side turn count we believe exists
  last_turn_fingerprint: string;       // hash of last assistant turn text
  model_class: string | null;          // what the thread was running on
  status: "active" | "diverged" | "migrated" | "provider_deleted" | "archived";
  on_divergence: "adopt" | "fork" | "fail";
  context_transfer_from: string | null; // previous mapping_id on migration
  created_at: string; last_used_at: string;
}
```

### S7. Errors (§31)

```ts
interface TaskError {
  class: FailureClass;
  scope: "task" | "pool" | "account" | "adapter" | "gateway"; // what the failure poisons
  retryable: boolean;
  fallback_eligible: boolean;
  cooldown_s: number | null;
  user_action: string | null;          // "Sign in to Kimi", "Solve verification in window"
  detail: string;                      // redacted
  evidence_ref: string | null;         // redacted screenshot/DOM snapshot id
}
```

## Architecture changes

### A1. Adapter interface (replaces §29)

```ts
interface SubscriptionAdapter {
  readonly manifest: AdapterManifest;

  // Lifecycle — worker-owned browser context is injected, adapter never launches browsers.
  attach(ctx: AdapterRuntime): Promise<void>;
  detach(): Promise<void>;

  // Health — non-spending.
  probe(signal: AbortSignal): Promise<ProbeResult>;          // canary: auth + critical locators
  readPlan?(signal: AbortSignal): Promise<string | null>;    // observed plan tier
  readQuota?(poolId: string, signal: AbortSignal): Promise<QuotaSignal | null>;

  // Execution — streaming, cancellable.
  execute(task: Task, ctx: ExecutionContext): AsyncIterable<AdapterEvent>;
  resume?(token: ResumeToken, ctx: ExecutionContext): AsyncIterable<AdapterEvent>; // detached tasks
  reconcile?(attempt: TaskAttempt, ctx: ExecutionContext): Promise<ReconcileResult>; // Critical #2

  // Threads/artifacts
  readThread?(providerThreadId: string, ctx: ExecutionContext): Promise<ThreadSnapshot>; // divergence check
  fetchArtifact?(ref: ProviderArtifactRef, ctx: ExecutionContext): Promise<ArtifactFile>;
  exportArtifact?(ref: ProviderArtifactRef, format: string, ctx: ExecutionContext): Promise<ArtifactFile>;
}

interface ExecutionContext {
  signal: AbortSignal;                 // cancellation
  page: PageLease;                     // scoped, worker-owned; adapter must not keep references
  artifacts: ArtifactSink;             // streams bytes into content-addressed store
  pacing: Pacer;                       // A5 — adapters call pacing.beforeAction()
  selectors: SelectorResolver;         // A3
  log: RedactingLogger;
  attempt: TaskAttempt;                // adapter updates submission_state via ctx.markSubmitted()
  markSubmitted(providerThreadId: string | null): Promise<void>; // durable write BEFORE continuing
}

type AdapterEvent =
  | { t: "submitted"; provider_thread_id: string | null; provider_url: string | null }
  | { t: "reply"; event: ReplyEvent }                 // reuse @allternit/replies-contract
  | { t: "progress"; label: string; fraction?: number }
  | { t: "artifact.partial"; ref: ProviderArtifactRef; preview?: Uint8Array }
  | { t: "artifact.ready"; ref: ProviderArtifactRef; meta: Partial<Artifact> }
  | { t: "model.observed"; model: string }
  | { t: "quota.signal"; pool_id: string; signal: QuotaSignal }
  | { t: "needs_user"; reason: "auth" | "challenge" | "confirm_dialog"; message: string }
  | { t: "detached"; resume_token: ResumeToken; poll_after_s: number }
  | { t: "done"; outcome: "success" | "partial"; text?: string }
  | { t: "error"; error: TaskError };
```

Key rules:

- `markSubmitted` has to be durably persisted **before** the adapter clicks Send and **after** the provider acknowledges (two writes: `sent_unconfirmed`, then `acknowledged`).
- Adapters never retry a submit. Retry policy belongs to the worker and router.
- **Completion detection** combines several signals: the stop button disappears, the send button re-enables, the text stops changing for 1.5–3 s, and there's no in-flight streaming node. Implement this once in the SDK (A3).

### A2. Router interface (replaces §30)

```ts
interface CapabilityRouter {
  resolve(task: Task, snapshot: FabricSnapshot): RouteDecision;       // pure, deterministic, testable
  onAttemptFailed(task: Task, attempt: TaskAttempt, snapshot: FabricSnapshot): RouteDecision | "stop";
}

interface RouteDecision {
  decision_id: string;
  primary: RouteCandidate | null;      // null → no eligible route; task → needs_user or failed
  fallbacks: RouteCandidate[];         // pre-filtered by policy and sensitivity
  rejected: Array<{ adapter_id: string; account_id?: string; reason: RejectReason }>;
  policy_version: string;
  explain: string;                     // human-readable, shown in observability
}
interface RouteCandidate {
  adapter_id: string; account_id: string | null; pool_key: string | null;
  lane: "subscription" | "local" | "credits" | "metered";
  est_metered_usd: number;             // 0 for subscription lanes
  requires_approval: boolean;          // metered over threshold, external_publish
}
```

`resolve` should be a **pure function over a snapshot**. That makes it table-testable, it never touches browsers, and it produces a `rejected[]` list that explains "why not Kimi?" in the UI. Policy is re-checked on **every hop**. §31's fallback example (Kimi → Claude → API) would otherwise skip the sensitivity check on the metered hop.

### A3. Adapter SDK and selector registry

Reuse `@allternit/browser-tools` for launching and CDP. Add a thin SDK on top (see "Adapter extensibility design").

### A4. Routing under quota uncertainty (§33)

Per pool:

- **`unknown` pools are eligible**, ranked below `available`/`estimated` pools on the same lane but above any lane with a worse cost class. Uncertainty alone should never push work to the metered lane.
- **Local soft budget.** `local_budget` per rolling window defaults to a conservative per-plan number the user can override. When `local_used_in_window ≥ local_budget`, the pool drops in rank. It is not excluded. This keeps volume human-scale (A5) even when the provider never says anything.
- **Soft signal** (limit banner, "approaching limit", slow mode): state `degraded`. `interactive` priority tasks can still use the pool; `background` tasks skip it.
- **`model_downgraded`**: state `degraded`, and for tasks that request `model_class ≥ reasoning`, treat the pool as exhausted until `reset_at` (or a 3-hour default).
- **Hard error**: state `exhausted` until `reset_at` if the error names one. Otherwise `cooling_down` with exponential cooldown (30 m → 1 h → 2 h → 4 h, capped at 24 h). When the cooldown expires the pool goes to `unknown`, **not** `available`.
- **No active probing.** Real tasks aren't used to test whether an exhausted pool has recovered. The first task after cooldown is treated as a normal attempt. If it hits the limit again, the cooldown doubles.
- **Circuit breaker per adapter version.** If more than 3 consecutive `selector_not_found`/`provider_ui_changed` failures happen across any capabilities, the adapter goes to `ui_drift` and stops receiving routes until `probe()` passes.

### A5. Session hygiene and abuse-signal avoidance (operational)

This is about looking like the ordinary single-user session it really is. It is **not** about evading provider security controls, and §26 stands.

- Use the **real Chrome channel** (`channel: "chrome"`, already the convention in `chatgpt-image`) with a persistent profile that the user logged into by hand. No bundled headless Chromium, and no fingerprint spoofing or "stealth" plugins. Those are both the detection signal and a §26 violation.
- Run headful by default: an off-screen or minimized dedicated window. Headless only if the adapter's probe history shows it's stable for that provider.
- A `PacingProfile` for each adapter:

  ```ts
  { min_action_gap_ms: [800, 2500], min_task_gap_s: 5, max_tasks_per_hour: number, max_tasks_per_day: number, quiet_hours?: [start, end] }
  ```

  Pacing is enforced by the worker, not by adapter code.
- No parallel submits across tabs on one account, even when concurrency is raised later. Parallelism is allowed only for detached watches (reading, not writing).
- On a challenge, verification prompt, or "unusual activity" notice, stop immediately, surface it to the user, and never retry automatically (Critical #5).
- **Provider-side hygiene:**
  - Create bot conversations inside a dedicated provider project or folder ("Allternit") where the provider supports one.
  - For ChatGPT, give the user a per-account choice: run stateless bot tasks in temporary-chat mode, or accept that provider memory will learn from bot prompts.
  - This keeps the user's personal history from being flooded with bot threads.

### A6. Security (fills gaps in §25)

1. **Transport:** default to a Unix domain socket at `~/.allternit/subscriptions/gateway.sock` (mode 0600). TCP `127.0.0.1:7788` is optional and still **always** requires a bearer token. Reject any request whose `Host` isn't `127.0.0.1:<port>` or `localhost:<port>` (defeats DNS rebinding). Reject any request carrying an `Origin` header unless it's on an explicit allowlist (defeats browser CSRF). Never send CORS `*`.
2. **Caller identity:** issue per-caller tokens (one per bot runtime, CLI, or desktop shell) with scopes: `tasks:submit`, `tasks:read`, `artifacts:read`, `accounts:manage`, `approve:external_publish`. Bots never get `accounts:manage` or `approve:*`.
3. **Secrets:** keep the token and at-rest encryption key in the macOS Keychain, not in a file. Profile directories are 0700. Encrypt the state DB with the Keychain-held key, or at minimum the fields containing prompts and responses.
4. **Input file reads:** `inputs[].path` has to resolve (after realpath) under an allowlisted root (the workspace and the artifact store). Deny `~/.ssh`, the Keychain, browser profiles (including the gateway's own profiles), and dotfiles by default. Uploading a file to a provider is data egress, so apply `constraints.sensitivity`: `local_only`/`confidential` → ui_bridge lanes are ineligible unless the policy allows them.
5. **Navigation lock:** the worker page may only navigate to `manifest.origins` (plus the provider's auth and CDN hosts). Block everything else at the context route level. Don't reuse `browser-tools`' default `allowedHosts: ['*']`.
6. **Downloads:** save into a content-addressed quarantine directory, verify the MIME type, set `com.apple.quarantine`, and never auto-open. HTML and website artifacts render only inside a sandboxed iframe or webview (`sandbox="allow-scripts"`, no same-origin, CSP `connect-src 'none'`) or on a separate origin.
7. **Prompt injection:** mark provider output `trust: untrusted_provider_output`. Bot runtimes have to treat fabric text as data, not instructions. Document this in the bot-facing contract.
8. **Redaction:** screenshots and DOM snapshots taken on failure get cropped to the composer and response region, plus a redaction pass that masks email addresses, account names, and sidebar history. Keep them for 7 days by default.
9. **Kill switch:** `DELETE /v1/accounts/{id}/session` stops the worker, wipes the profile directory (after confirmation), and revokes local tokens scoped to that account.

### A7. Placement in this monorepo (replaces §28)

```text
platform/packages/subscription-fabric-contracts/   # @allternit/subscription-fabric-contracts
    src/{capability,task,artifact,quota,thread,events,manifest}.ts  # types + zod/JSON Schema
platform/packages/subscription-adapter-sdk/        # @allternit/subscription-adapter-sdk
    src/{runtime,selectors,completion,download,pacing,probe,fixtures,conformance}.ts
services/subscription-gateway/                     # the daemon (TS, Node, Playwright via browser-tools)
    src/{http,queue,worker,router,store,reconcile,events}/
    adapters/{chatgpt-web,claude-web,kimi-web}/    # each: manifest.yaml, selectors/*.yaml, adapter.ts, fixtures/
cmd/allternit/ (existing CLI)                      # `allternit subs|caps|task|artifacts` subcommands → gateway client
```

- **State:** SQLite (WAL) at `~/.allternit/subscriptions/state.db`. The artifact store is at `~/.allternit/subscriptions/artifacts/<sha256[0:2]>/<sha256>`. Drop "Postgres" from §27 for the local daemon.
- **Events:** SSE at `GET /v1/tasks/{id}/events` streams the `AdapterEvent`s, with `reply` events being `ReplyEvent`s verbatim. That lets Thread UIs reuse `@allternit/replies-reducer`.
- **Bot integration:** also expose the gateway as an **MCP server** with the tools `subscription_task_run`, `subscription_task_status`, and `artifact_get`. gizzi-code and Claude-Code-style bots then get the fabric without new client code.
- **media-router integration:** register `chatgpt-web` and `kimi-web` as free-lane providers that call the gateway, keep logging to the existing `media-usage.jsonl` ledger, and retire the standalone `chatgpt-image` profile (Critical #6).

### A8. Worker model (§17, §19)

- One worker per `(provider, account_id)`, not per provider. Single-account is fine for the MVP, but the key should allow multiple accounts later at no extra cost.
- A worker owns one browser context and one **interactive page**, plus up to `N_watch` (default 2) read-only watch pages for detached tasks.
- Crash recovery: the supervisor restarts the worker, and any attempt left in `sent_unconfirmed` is sent to `reconcile()` before the queue resumes.
- Put a watchdog on each attempt: if nothing changes (no DOM mutation, no event) for `stall_timeout_s` (per capability; 90 s for chat, 20 m for deep research), fail it as `stalled`. It's retryable only if `submission_state = not_sent`.
- Queue fairness is `interactive` > `normal` > `background`. A background task can't be picked up while an interactive task is waiting for the same worker.

### A9. Failure taxonomy additions (§31)

Add these classes, each with a default `scope`, `retryable`, and `fallback_eligible`:

| class | scope | retry | fallback | action |
|---|---|---|---|---|
| `challenge_presented` | account | no | yes (other account/provider) | halt worker, `needs_user` |
| `account_restricted` | account | no | yes | halt worker, notify |
| `submission_ambiguous` | task | no | **no** | reconcile, else surface to user |
| `model_downgraded` | pool | n/a (task may succeed) | policy | mark pool degraded |
| `content_refused` | task | no | **no by default** | surface refusal; don't auto-shop other providers |
| `stalled` / `timeout` | task | only if not_sent | yes | watchdog |
| `output_truncated` | task | continue-prompt once | no | adapter sends "continue" if supported |
| `profile_locked` | account | after release | yes | A6/Critical #6 |
| `worker_crashed` | account | via reconcile | yes | supervisor |
| `artifact_expired` | task | re-export if provider thread alive | no | |
| `approval_required` | task | after approval | no | `needs_user` |
| `policy_denied` | task | no | n/a | router rejection, not an adapter error |

Fold `selector_not_found` into `provider_ui_changed` with a `detail.locator_key`. Callers shouldn't have to tell the two apart. What matters is that both trip the circuit breaker (A4).

## MVP cuts

What the MVP builds (tighter than §27 and §40):

- **Phase 1:** contracts package, gateway (UDS + token), SQLite store, worker supervisor, a pure router with **static priority + policy only**, the event log, and the artifact store.
- **Phase 2:** `chatgpt-web` with `chat.create`, `chat.continue`, and `image.generate` only, including probe, reconcile, divergence check, and pacing. It replaces the `chatgpt-image` lane.
- **Phase 3:** `kimi-web` with `chat.*` and **one** artifact family (`presentation.create` → pptx). Hold the rest until pptx capture has been stable for two weeks.
- **Phase 4:** `claude-web` with `chat.*` only.
- **UI:** a single connection-status and needs-user panel in the desktop shell. Nothing else.

Cut or defer:

- **The per-capability endpoints** in §8 (`/v1/images`, `/v1/documents`, …). Keep `/v1/tasks`, `/v1/tasks/{id}/events`, `/v1/artifacts/{id}`, `/v1/accounts`, and `/v1/capabilities`. The chat thread endpoints in §40 are fine as a convenience wrapper over tasks.
- **`project.*`, `website.publish`, `website.modify`, `*.edit`, `spreadsheet.analyze`, `file.*`** as standalone capabilities.
- **Desktop-app bridges** (§6.2 desktop, §7). Web only.
- **Avoided-cost accounting** (§24) and "estimated unused capacity" (§27 Phase 6). Record `est_metered_usd` per route candidate now, since that's cheap, but postpone the economics UI. A sunk-cost estimate that depends on guessed quotas is misleading anyway.
- **Router scoring weights** (quality, latency, "sunk cost") from §12. Use an ordered preference list plus policy. Add scoring once there's measured reliability data.
- **Multi-account per provider, raising concurrency, and headless mode.** Keep the schema ready for them, but don't build them.
- **Metered-API fallback execution.** For the MVP, the router can *report* a metered candidate, but running it requires `allow_metered` plus per-task approval. (It could reuse the existing `llm_gateway` in allternit-api; defer the wiring.)
- **§43 (other SaaS)**: not relevant to any MVP decision. Keep the abstraction honest, but don't generalize for it yet.

## Adapter extensibility design

As written, adding a provider is **not** cheap: each adapter would re-implement launching, auth detection, composer typing, completion detection, downloads, retries, and quota parsing. It gets cheap when adapters shrink to **declarative config plus a few hooks**.

1. **Adapter SDK (`@allternit/subscription-adapter-sdk`)** provides these as shared primitives:
   - `fillComposer`: handles contenteditable and textarea, and pastes long prompts via the clipboard or `insertText`, not per-key typing.
   - `submit`.
   - `awaitCompletion`: the multi-signal detector from A1.
   - `extractLastAssistantTurn`: DOM to markdown, keeping code blocks and citations.
   - `captureDownload`: Playwright download event into `ArtifactSink`.
   - `captureImages`: takes the largest rendered image, or the network response body for image URLs on allowed origins.
   - `detectAuthState`: from the URL pattern plus a locator.
   - `detectBanners`: regex packs that map to `QuotaSignal`s.
   - `threadIdFromUrl`.
2. **Selector registry.** Selectors live in `adapters/<p>/selectors/<version>.yaml` as **named locator keys** with ordered fallback strategies. Semantic locators come first (role and accessible name, `data-testid`); CSS/XPath is last.

   ```yaml
   composer:
     critical: true
     strategies:
       - { role: textbox, name: /message|ask/i }
       - { testid: prompt-textarea }
       - { css: "div#prompt-textarea[contenteditable=true]" }
   stop_button: { critical: true, strategies: [ { role: button, name: /stop/i } ] }
   ```

   The resolver records which strategy matched and reports it as telemetry. When a strategy falls through to a later fallback, that's the **early drift warning**, and it shows up before anything actually breaks. `probe()` checks every `critical: true` key.
3. **Declarative chat adapters.** Most chat-only providers (Gemini, Grok, Mistral Le Chat, DeepSeek) can be pure config: `manifest.yaml` + `selectors.yaml` + a thread-URL regex, all run by a generic `DeclarativeChatAdapter`. That makes a new chat-only provider a config-and-fixtures PR with no TypeScript. Only artifact-producing capabilities need code hooks (`onArtifact`, `exportArtifact`).
4. **Capability probes.** `probe()` also confirms that each capability the manifest declares still has its entry points (the image tool toggle, the "Slides" mode button, and so on) without spending anything. A capability whose locator vanishes gets marked `status: disabled` in the live registry automatically, so the router stops routing to it with no code change.
5. **Fixtures and conformance.**
   - An `sdk record` command saves sanitized DOM snapshots (MHTML or HTML) of the key states for each adapter: logged out, idle, streaming, complete, limit banner, and challenge.
   - A shared **conformance suite** runs every adapter against its fixtures: selector resolution, completion detection, banner classification, and thread-ID parsing.
   - A new adapter merges only when it passes the suite, which gives §41 step 18 a concrete meaning.
   - A nightly optional **live canary** (probe only, never submitting) per connected account catches UI drift before users do.
6. **Manifest-driven routing.** The router reads the live registry (manifests merged with probe results, health, and pools) and never branches on `provider === "kimi"`. Enforce this with a lint rule that bans provider-name literals in `router/` and `queue/`, which puts the §42 "mandatory separation" rule into CI.
7. **Versioned hot-swap.** Adapters are loaded by `adapter_id@version`. Ship v2 next to v1, route a canary share of traffic to it, and compare measured success rates before cutting over. This delivers §5's "disposable adapters" in practice.

## Open questions for the human

1. **Runtime:** do you confirm TypeScript/Node for the gateway (reusing `@allternit/browser-tools` Playwright) over Python or Rust? This review assumes TS.
2. **Scope of accounts:** is the MVP owner-accounts-only? The `chatgpt-image` skill has a client-consent path for driving *client* accounts. Should the fabric ever connect client accounts, and if so, is it a separate profile store and policy namespace per client?
3. **Local-only guarantee:** should the gateway be *structurally* barred from ever running on Allternit cloud infrastructure (for example, it refuses to start without a local Keychain)? Hosting user sessions server-side is a very different risk class.
4. **Window posture:** is an off-screen or minimized headful Chrome window acceptable on your machine for each connected provider, or do you want one dedicated "Allternit Sessions" Chrome window with a tab per provider?
5. **Provider history hygiene:** should bot tasks run in a dedicated provider project or folder, in temporary/incognito chats (ChatGPT) where possible, or in your normal history? And do you want ChatGPT memory isolated from bot traffic?
6. **`chatgpt-image` migration:** OK to retire the standalone `~/.chatgpt-image-profile` lane and route media-router's ChatGPT free lane through the gateway, so there's only one automation identity per account?
7. **Content refusals:** when a provider refuses a prompt, should the router ever automatically retry it on another provider, or always surface the refusal? This review recommends always surfacing it.
8. **Thread migration default:** when a thread's provider is exhausted mid-conversation, which should happen: wait for reset, migrate with a summary, or ask? This review recommends asking for interactive threads and waiting for background ones.
9. **Publish gate:** do you confirm `website.publish` and similar outward-facing capabilities always need a per-task human approval, with no policy override, matching the deploy-preview rule in `CLAUDE.md`?
10. **Budgets:** what default per-provider daily task caps (A5 `max_tasks_per_day`) do you want before any provider signal is observed? For example, ChatGPT 150/day, Claude 80/day, Kimi 60/day.
