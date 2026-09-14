/**
 * Allternit Fabric runtime — capability-native node networking.
 *
 * Provides Tailscale/Headscale and cloudflared tunnel transports under the same
 * FabricTransport abstraction. Each transport is a singleton so server lifecycle
 * code can join/leave independently.
 */
import { TailscaleFabricTransport } from "./tailscale-transport"
import { TunnelFabricTransport } from "./tunnel-transport"

let tailscaleTransport: TailscaleFabricTransport | undefined
let tunnelTransport: TunnelFabricTransport | undefined

function createOrGetTailscaleTransport(): TailscaleFabricTransport {
  if (!tailscaleTransport) tailscaleTransport = new TailscaleFabricTransport()
  return tailscaleTransport
}

function createOrGetTunnelTransport(): TunnelFabricTransport {
  if (!tunnelTransport) tunnelTransport = new TunnelFabricTransport()
  return tunnelTransport
}

/** Reset all transport singletons; useful in tests. */
export function resetTransport() {
  tailscaleTransport = undefined
  tunnelTransport = undefined
}

export namespace Fabric {
  /** Default transport: Tailscale/Headscale mesh. */
  export const getTransport = createOrGetTailscaleTransport
  /** Tailscale/Headscale mesh transport. */
  export const getTailscaleTransport = createOrGetTailscaleTransport
  /** Cloudflared tunnel transport. */
  export const getTunnelTransport = createOrGetTunnelTransport
}

export * from "./transport"
export * from "./capability-catalog"
export * from "./executor"
export * from "./peer-registry"
export * from "./lease-authority"
export { TailscaleFabricTransport } from "./tailscale-transport"
export { TunnelFabricTransport } from "./tunnel-transport"
