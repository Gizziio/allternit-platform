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
