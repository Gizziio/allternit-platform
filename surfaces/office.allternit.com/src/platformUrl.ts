/**
 * URL of the main Allternit platform (ai.allternit.com).
 * Override via `VITE_ALLTERNIT_PLATFORM_URL` for local/dev deployments.
 */
export const ALLTERNIT_PLATFORM_URL: string =
  (import.meta.env?.VITE_ALLTERNIT_PLATFORM_URL as string | undefined) ?? 'https://allternit.com'
