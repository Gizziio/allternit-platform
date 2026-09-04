/**
 * Centralized runtime environment access for the Allternit platform shell.
 *
 * Vite exposes build-time env vars through `import.meta.env`, but only when they
 * are accessed with static property names. Dynamic access (`import.meta.env[key]`)
 * is not rewritten by Vite, so client-side reads of known variables must use
 * literal property access. This file keeps that concentrated here so the rest of
 * the app can use thin helpers.
 */

function readEnv(key: string): string | undefined {
  // Vite client env. In the production bundle `import.meta.env` is replaced
  // with a static object of public env vars, so dynamic key access works at
  // runtime. This is required for NEXT_PUBLIC_* values to be visible to the
  // generic `env()` helper in the browser.
  if (typeof import.meta.env !== 'undefined' && import.meta.env[key]) {
    return import.meta.env[key] as string;
  }
  // Node / build env fallback
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key];
  }
  return undefined;
}

export function env(key: string, fallback?: string): string | undefined {
  const value = readEnv(key);
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  return value;
}

export function envFlag(key: string): boolean {
  const value = env(key)?.toLowerCase();
  return value === '1' || value === 'true';
}

export interface EnvValidationResult {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validate env vars that the shell needs to function. Run this early in main.tsx
 * so users get a clear message before the app attempts network calls.
 */
export function validatePlatformEnv(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  const selfHosted = isSelfHosted();
  const clerkKey = getBuildTimeClerkPublishableKey();

  // Clerk is resolved at runtime by PlatformAuthProvider from the baked company
  // config: self-hosted builds set selfHosted=true in resources/company.json and
  // bypass Clerk entirely, so a missing build-time key is NOT a hard error.
  // The build-time check cannot see the runtime company config, so it must not
  // assert Clerk is required — doing so produced a false "Missing required
  // environment variables" console error on every packaged self-hosted launch.
  // Surface it as a heads-up only, and silence even that when the build is
  // explicitly flagged self-hosted.
  if (!clerkKey && !selfHosted) {
    warnings.push(
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set at build time. ' +
        'Auth will fall back to the runtime company config; self-hosted builds bypass Clerk.'
    );
  }

  if (!env('ENCRYPTION_KEY')) {
    warnings.push(
      'ENCRYPTION_KEY is not set. A random key will be generated, but secrets will not persist across rebuilds.'
    );
  }

  return { ok: missing.length === 0, missing, warnings };
}

/**
 * Clerk publishable key used by PlatformAuthProvider. Prefers the baked-in
 * company config at runtime; this build-time fallback is the escape hatch.
 *
 * Uses static `import.meta.env` access because Vite only replaces literal
 * property names.
 */
export function getBuildTimeClerkPublishableKey(): string {
  const value = typeof import.meta.env !== 'undefined'
    ? import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    : undefined;
  return typeof value === 'string' ? value : '';
}

export function isClerkDisabledByEnv(): boolean {
  const value = typeof import.meta.env !== 'undefined'
    ? import.meta.env.NEXT_PUBLIC_ALLTERNIT_PLATFORM_DISABLE_CLERK
    : undefined;
  return String(value).toLowerCase() === '1' || String(value).toLowerCase() === 'true';
}

export function isSelfHosted(): boolean {
  // Vite only exposes env vars prefixed with VITE_ / NEXT_PUBLIC_, so the
  // self-hosted build flag must also be readable through NEXT_PUBLIC_.
  const viteValue = typeof import.meta.env !== 'undefined'
    ? import.meta.env.NEXT_PUBLIC_ALLTERNIT_SELF_HOSTED
    : undefined;
  const nodeValue = env('ALLTERNIT_SELF_HOSTED');
  const value = viteValue ?? nodeValue;
  return String(value).toLowerCase() === '1' || String(value).toLowerCase() === 'true';
}

export function isDesktopAuthEnabled(): boolean {
  const value = typeof import.meta.env !== 'undefined'
    ? import.meta.env.NEXT_PUBLIC_ALLTERNIT_DESKTOP_AUTH
    : undefined;
  return String(value).toLowerCase() === '1' || String(value).toLowerCase() === 'true';
}

/**
 * Agent Runner — operator planning mode. The operator backend
 * (`POST /api/v1/operator/execute`, `GET /api/v1/operator/events/:id`) does not
 * exist in either Rust backend yet, so this defaults OFF and the runner fails
 * closed with a visible trace error instead of firing 401s into the console.
 * Set NEXT_PUBLIC_ALLTERNIT_RUNNER_OPERATOR=1 once a real operator backend ships.
 */
export function isRunnerOperatorModeEnabled(): boolean {
  return envFlag('NEXT_PUBLIC_ALLTERNIT_RUNNER_OPERATOR');
}

/**
 * Agent Runner — direct AI chat path. The runner's chat client targets
 * `POST /api/chat`, which no backend serves (the real chat bridge is
 * `POST /api/agent-chat`, but it speaks a different SSE protocol), so this
 * defaults OFF and the runner fails closed with a visible trace error.
 * Set NEXT_PUBLIC_ALLTERNIT_RUNNER_CHAT=1 once a compatible endpoint exists.
 */
export function isRunnerAiChatEnabled(): boolean {
  return envFlag('NEXT_PUBLIC_ALLTERNIT_RUNNER_CHAT');
}

/**
 * Cloud control-plane API base URL — the Clerk-authed cloud-api origin that
 * serves the user-level control-plane namespaces (`/api/v1/agent-sessions`,
 * `/api/v1/office/*`, `/api/v1/beta/*`) by relaying to the user's registered
 * data-plane node. Resolution order:
 *
 *   1. `VITE_CLOUD_API_URL` (build-time, preferred).
 *   2. `NEXT_PUBLIC_ALLTERNIT_CLOUD_API_URL` (legacy convention used by the
 *      fetch interceptor and the runtime-devices relay).
 *   3. When the surface itself is served from loopback (Vite dev server),
 *      `http://localhost:3001` — cloud-api's default BIND_ADDR.
 *   4. `https://api.allternit.com`.
 *
 * This is NOT the 8013 gateway: only the three control-plane namespaces above
 * target this origin, and only when their feature flag is on.
 */
export function getCloudApiBaseUrl(): string {
  const configured =
    env('VITE_CLOUD_API_URL') ?? env('NEXT_PUBLIC_ALLTERNIT_CLOUD_API_URL');
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
  ) {
    return 'http://localhost:3001';
  }
  return 'https://api.allternit.com';
}

/**
 * Agent Sessions API — `/api/v1/agent-sessions` (CRUD, `/sync` SSE,
 * abort/revert/unrevert/compact). These handlers are served by the cloud-api
 * control plane (Clerk auth → user's data-plane node → relay), so this
 * defaults OFF: session stores skip the backend probe/sync and fail closed
 * with a deliberate message instead of firing unauthenticated requests.
 * When ON, callers target `getCloudApiBaseUrl()` — not the 8013 gateway —
 * with the Clerk session bearer; the `/sync` SSE stream uses authenticated
 * fetch streaming because cloud-api accepts no session cookie.
 * Set NEXT_PUBLIC_ALLTERNIT_AGENT_SESSIONS_API=1 in deployments that turn on
 * the control-plane handlers.
 */
export function isAgentSessionsApiEnabled(): boolean {
  return envFlag('NEXT_PUBLIC_ALLTERNIT_AGENT_SESSIONS_API');
}

/**
 * Office bindings API — `/api/v1/office/bindings` (+ bootstrap, runtime
 * state). Served by the cloud-api control plane, so this defaults OFF and
 * office-binding probes fail closed (binding treated as absent). When ON,
 * callers target `getCloudApiBaseUrl()` with the Clerk session bearer.
 * Set NEXT_PUBLIC_ALLTERNIT_OFFICE_API=1 in deployments that turn on the
 * control-plane handlers.
 */
export function isOfficeApiEnabled(): boolean {
  return envFlag('NEXT_PUBLIC_ALLTERNIT_OFFICE_API');
}

/**
 * Beta API — `/api/v1/beta/*` (deep-research tasks, playground session
 * memory/events/run). Served by the cloud-api control plane, so this defaults
 * OFF and the research/playground widgets render a deliberate
 * offline/disabled state. When ON, callers target `getCloudApiBaseUrl()` with
 * the Clerk session bearer.
 * Set NEXT_PUBLIC_ALLTERNIT_BETA_API=1 in deployments that turn on the
 * control-plane handlers.
 */
export function isBetaApiEnabled(): boolean {
  return envFlag('NEXT_PUBLIC_ALLTERNIT_BETA_API');
}

/**
 * Rails API — `/api/rails/*` (DAG plans, WIHs, leases, ledger, vault, mail).
 * Served only by the Rust allternit-api (:8013), which is not publicly
 * reachable from the deployed web surface, so this defaults OFF: DAG runtime
 * / orchestration views skip their mount-time fetches and health polls and
 * show a deliberate "disabled in this deployment" state.
 * Set NEXT_PUBLIC_ALLTERNIT_RAILS_API=1 where the gateway is reachable.
 */
export function isRailsApiEnabled(): boolean {
  return envFlag('NEXT_PUBLIC_ALLTERNIT_RAILS_API');
}

/**
 * Runtime API — `/api/v1/runtime/*` (backend registration, execution mode).
 * Served only by the Rust allternit-api (:8013), not by the deployed web
 * surface, so this defaults OFF: the execution-mode hook skips its mount-time
 * probe and fails closed with a deliberate error instead of firing requests
 * that 404.
 * Set NEXT_PUBLIC_ALLTERNIT_RUNTIME_API=1 where the gateway is reachable.
 */
export function isRuntimeApiEnabled(): boolean {
  return envFlag('NEXT_PUBLIC_ALLTERNIT_RUNTIME_API');
}

/**
 * Tool registry API — `/api/v1/tools[/execute|/register|/unregister]` (kernel
 * tool list, tool execution, GIF recording). Served only by the Rust
 * allternit-api (:8013), not by the deployed web surface, so this defaults
 * OFF: tool stores skip their backend fetches and fail closed with a visible
 * error, and the composer's GIF recording control is hidden.
 * Set NEXT_PUBLIC_ALLTERNIT_TOOLS_API=1 where the gateway is reachable.
 */
export function isToolsApiEnabled(): boolean {
  return envFlag('NEXT_PUBLIC_ALLTERNIT_TOOLS_API');
}

/**
 * Permissions reply API — `POST /api/v1/permissions/:id/reply`. Served only
 * by the Rust allternit-api (:8013), not by the deployed web surface, so this
 * defaults OFF: permission decisions are still recorded locally but the reply
 * is never forwarded to a backend that isn't there.
 * Set NEXT_PUBLIC_ALLTERNIT_PERMISSIONS_API=1 where the gateway is reachable.
 */
export function isPermissionsApiEnabled(): boolean {
  return envFlag('NEXT_PUBLIC_ALLTERNIT_PERMISSIONS_API');
}

/**
 * Questions reply API — `POST /api/v1/questions/:id/reply|reject`. Served
 * only by the Rust allternit-api (:8013), not by the deployed web surface,
 * so this defaults OFF: question prompts are dismissed locally but the reply
 * is never forwarded to a backend that isn't there.
 * Set NEXT_PUBLIC_ALLTERNIT_QUESTIONS_API=1 where the gateway is reachable.
 */
export function isQuestionsApiEnabled(): boolean {
  return envFlag('NEXT_PUBLIC_ALLTERNIT_QUESTIONS_API');
}

/**
 * Model Lab API — `/api/model-lab/*` (Unsloth training/export jobs). Served
 * only by the Rust allternit-api (:8013), not by the deployed web surface, so
 * this defaults OFF: the jobs monitor shows a deliberate "disabled in this
 * deployment" state instead of polling a missing endpoint every 5s.
 * Set NEXT_PUBLIC_ALLTERNIT_MODEL_LAB_API=1 where the gateway is reachable.
 */
export function isModelLabApiEnabled(): boolean {
  return envFlag('NEXT_PUBLIC_ALLTERNIT_MODEL_LAB_API');
}
