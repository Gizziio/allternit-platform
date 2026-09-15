/**
 * Allternit account authentication (Clerk) — production configuration.
 *
 * Terminal login opens the workspace site (https://ai.allternit.com), not the
 * cloud console (https://platform.allternit.com). The publishable key is
 * Clerk's public frontend key for clerk.allternit.com. Secret keys (sk_*)
 * never belong in this tree.
 */
export const ALLTERNIT_WORKSPACE_URL = "https://ai.allternit.com"
export const ALLTERNIT_CLOUD_CONSOLE_URL = "https://platform.allternit.com"
export const ALLTERNIT_CLERK_FRONTEND_URL = "https://clerk.allternit.com"
export const ALLTERNIT_CLERK_PUBLISHABLE_KEY =
  "pk_live_Y2xlcmsuYWxsdGVybml0LmNvbSQ"
