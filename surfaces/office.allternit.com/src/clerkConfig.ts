/**
 * Clerk publishable key for the Allternit Office surface.
 *
 * This is a public, frontend-safe key. It must be supplied at build time via the
 * VITE_CLERK_PUBLISHABLE_KEY environment variable. There is no committed
 * fallback; shipping a placeholder key breaks sign-in silently.
 */
export const CLERK_PUBLISHABLE_KEY =
  import.meta.env?.VITE_CLERK_PUBLISHABLE_KEY ?? ""
