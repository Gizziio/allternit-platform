/**
 * Centralized runtime environment access for the Allternit platform shell.
 *
 * Vite exposes build-time env vars through `import.meta.env`. We keep a thin
 * typed wrapper here so the rest of the app does not scatter `process.env` /
 * `import.meta.env` reads, and so we can validate required values once at
 * startup.
 */

function readEnv(key: string): string | undefined {
  // Vite client env
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

  const selfHosted = envFlag('ALLTERNIT_SELF_HOSTED');
  const clerkKey = env('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');

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
 */
export function getBuildTimeClerkPublishableKey(): string {
  return env('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY') ?? '';
}

export function isClerkDisabledByEnv(): boolean {
  return envFlag('NEXT_PUBLIC_ALLTERNIT_PLATFORM_DISABLE_CLERK');
}

export function isDesktopAuthEnabled(): boolean {
  return envFlag('NEXT_PUBLIC_ALLTERNIT_DESKTOP_AUTH');
}
