/**
 * Clerk configuration for platform.allternit.com.
 *
 * The publishable key is read from VITE_CLERK_PUBLISHABLE_KEY at build time.
 * It must NOT be committed to source control.
 */

export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;

export const CLERK_PROXY_URL = "https://platform.allternit.com/__clerk";
export const CLERK_SIGN_IN_PATH = "/sign-in";
export const CLERK_SIGN_UP_PATH = "/sign-up";

export const STATIC_ALLOWED_REDIRECT_ORIGINS = [
  "https://platform.allternit.com",
  "https://ai.allternit.com",
  "https://remotecontrol.allternit.com",
];

export function getAllowedRedirectOrigins(): string[] {
  const current =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://platform.allternit.com";
  return Array.from(new Set([current, ...STATIC_ALLOWED_REDIRECT_ORIGINS]));
}
