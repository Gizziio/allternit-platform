/**
 * Resolves the Clerk publishable key for the desktop auth renderer.
 *
 * The key is written to dist/renderer/auth/clerk-config.json at build time
 * from NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or resources/company.json. In
 * development it can also be supplied via process.env.ALLTERNIT_CLERK_KEY
 * injected by the dev server.
 */

interface ClerkConfig {
  publishableKey: string;
  signInUrl?: string;
  signUpUrl?: string;
}

let cached: ClerkConfig | null = null;

export async function loadClerkConfig(): Promise<ClerkConfig> {
  if (cached) return cached;

  // In a packaged build, electron-builder puts the renderer next to the main
  // bundle; in dev, Vite serves it from the source directory.
  const candidates = [
    './clerk-config.json',
    '../clerk-config.json',
    '../../clerk-config.json',
  ];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate);
      if (!response.ok) continue;
      const parsed = (await response.json()) as ClerkConfig;
      if (parsed.publishableKey) {
        cached = parsed;
        return parsed;
      }
    } catch {
      // try next
    }
  }

  throw new Error(
    'Clerk publishable key is not configured. ' +
      'Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY at build time or clerkPublishableKey in resources/company.json.',
  );
}
