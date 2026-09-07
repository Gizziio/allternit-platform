/**
 * Resolves the operator data-plane URL (local allternit-api) vs the cloud
 * control plane (api.allternit.com).
 *
 * Desktop and loopback UIs must never send /api/v1/providers, onboarding, or
 * auth-status calls to the Clerk-only cloud API. Those routes 401 with a
 * device token and leave Home stuck on "No AI connected".
 */

export const DEFAULT_OPERATOR_GATEWAY = "http://127.0.0.1:8013";
export const CLOUD_CONTROL_PLANE_HOST = "api.allternit.com";

export function stripGatewaySuffix(value: string): string {
  return String(value || "")
    .trim()
    .replace(/\/api\/v1\/?$/i, "")
    .replace(/\/+$/g, "");
}

export function isCloudControlPlaneUrl(value: string | null | undefined): boolean {
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const host = parsed.hostname.toLowerCase();
    return host === CLOUD_CONTROL_PLANE_HOST || host === "cloud";
  } catch {
    return /api\.allternit\.com/i.test(raw);
  }
}

export function isLoopbackUrl(value: string | null | undefined): boolean {
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw.includes("://") ? raw : `http://${raw}`);
    return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  } catch {
    return /^(https?:\/\/)?(127\.0\.0\.1|localhost)(:|\/|$)/i.test(raw);
  }
}

export type OperatorGatewayInput = {
  windowUrl?: string | null;
  viteUrl?: string | null;
  runtimeGatewayUrl?: string | null;
  locationOrigin?: string | null;
  isDesktop?: boolean;
  fallback?: string;
};

/**
 * Pick the operator gateway for UI /api/* traffic.
 *
 * Desktop / loopback: local kernel, unless the user explicitly selected a
 * remote (non-cloud) runtime backend.
 * Hosted web: window override, then the baked VITE/NEXT public URL.
 */
export function resolveOperatorGatewayUrl(input: OperatorGatewayInput): string {
  const fallback = stripGatewaySuffix(input.fallback || DEFAULT_OPERATOR_GATEWAY) || DEFAULT_OPERATOR_GATEWAY;
  const windowUrl = stripGatewaySuffix(input.windowUrl || "");
  const viteUrl = stripGatewaySuffix(input.viteUrl || "");
  const runtimeGatewayUrl = stripGatewaySuffix(input.runtimeGatewayUrl || "");
  const origin = stripGatewaySuffix(input.locationOrigin || "");
  const desktopOrLoopback = Boolean(input.isDesktop) || isLoopbackUrl(origin);

  if (desktopOrLoopback) {
    if (runtimeGatewayUrl && !isCloudControlPlaneUrl(runtimeGatewayUrl)) {
      return runtimeGatewayUrl;
    }
    if (windowUrl && isLoopbackUrl(windowUrl)) return windowUrl;
    if (origin && isLoopbackUrl(origin)) return origin;
    if (windowUrl && !isCloudControlPlaneUrl(windowUrl)) return windowUrl;
    return fallback;
  }

  const hosted = windowUrl || viteUrl || fallback;
  return hosted || fallback;
}

/**
 * Provider discovery must stay on the operator data plane. A stale runtime
 * snapshot that points at api.allternit.com would 401 every providers call.
 */
export function operatorProviderDiscoveryUrl(
  snapshotGatewayUrl?: string | null,
): string {
  const gw = stripGatewaySuffix(snapshotGatewayUrl || "");
  if (gw && !isLoopbackUrl(gw) && !isCloudControlPlaneUrl(gw)) {
    return `${gw}/api/v1/providers`;
  }
  return "/api/v1/providers";
}
