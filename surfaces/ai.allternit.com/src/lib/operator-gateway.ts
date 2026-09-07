/**
 * Operator gateway helpers.
 *
 * The "operator gateway" is the user's resolved non-local runtime gateway
 * (see `allternit.runtime-backend.snapshot`'s `resolved_gateway_url`). Local
 * gateways (127.0.0.1 / localhost) are served through the app's own
 * `/api/v1/*` proxy paths so cookies and interceptors apply, so discovery
 * URLs must only be built from remote gateway origins.
 */

const LOCAL_GATEWAY_URL_RE = /^https?:\/\/(?:127\.0\.0\.1|localhost)/;

/**
 * Resolve the provider-discovery URL for the resolved runtime gateway.
 * Returns the relative `/api/v1/providers` path when the gateway is missing
 * or local, and the absolute `${gateway}/api/v1/providers` URL otherwise.
 */
export function operatorProviderDiscoveryUrl(gatewayUrl?: string | null): string {
  const gw = gatewayUrl ?? "";
  if (gw && !LOCAL_GATEWAY_URL_RE.test(gw)) return `${gw}/api/v1/providers`;
  return "/api/v1/providers";
}
