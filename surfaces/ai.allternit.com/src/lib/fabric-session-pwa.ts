/**
 * Public standalone Fabric Session PWA.
 *
 * The dashboard is a root-level PWA on its own hostname so a phone can scan
 * a QR, open `/`, and install it. `ai.allternit.com/fabric-session/` remains a
 * same-origin alias; do not use that path as the handoff URL.
 */
export const FABRIC_SESSION_PWA_ORIGIN = "https://fabrictransport.allternit.com";

const PLATFORM_SIGN_IN_ORIGIN = "https://ai.allternit.com";

export function fabricSessionPwaUrl(runtimeId?: string): string {
  const url = new URL("/", FABRIC_SESSION_PWA_ORIGIN);
  if (runtimeId) url.searchParams.set("runtime", runtimeId);
  return url.toString();
}

export function isFabricSessionPwaHost(host = typeof window !== "undefined" ? window.location.hostname : ""): boolean {
  return host === "fabrictransport.allternit.com" || host === "fabric-session.allternit.com";
}

/** Keep QR query params (`runtime`, `session`) after auth. */
export function fabricSessionStayUrl(): string {
  const url = new URL(window.location.href);
  url.hash = "";
  return url.toString();
}

export function fabricSessionSignInHref(): string {
  const here = fabricSessionStayUrl();
  const host = window.location.hostname;
  const onPlatform =
    host === "ai.allternit.com" || host === "localhost" || host === "127.0.0.1";
  const redirect = encodeURIComponent(here);
  if (onPlatform) return `/sign-in?redirect_url=${redirect}`;
  return `${PLATFORM_SIGN_IN_ORIGIN}/sign-in?redirect_url=${redirect}`;
}
