/**
 * Clerk publishable key for the Allternit platform.
 *
 * This is a public, frontend-safe key. It matches the key used by the mobile
 * and desktop surfaces. It can be overridden at build time via the
 * VITE_CLERK_PUBLISHABLE_KEY environment variable.
 */
export const CLERK_PUBLISHABLE_KEY =
  import.meta.env?.VITE_CLERK_PUBLISHABLE_KEY ??
  'pk_live_Y2xlcmsucGxhdGZvcm0uYWxsdGVybml0LmNvbSQ'
