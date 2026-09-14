/**
 * Cloudflared-backed Fabric transport.
 *
 * Implements the FabricTransport interface using the existing Tunnel module
 * (cloudflared quick/named tunnels). This unifies the tunnel path with the
 * Tailscale path under the same capability-native abstraction.
 */
import { Log } from "@/shared/util/log"
import { Tunnel } from "@/runtime/server/tunnel"
import { InstanceRegistration } from "@/runtime/server/instance-registration"
import {
  type FabricTransport,
  type JoinResult,
  type NodeEndpoint,
  type NodeIdentity,
  type CapabilityQuery,
  type FabricConnection,
  type FabricEvent,
  fabricTransportSchema,
} from "./transport"
import { buildNodeIdentity } from "./capability-catalog"
import { PlatformPeerRegistry } from "./peer-registry"

const log = Log.create({ service: "fabric:tunnel" })

export interface TunnelFabricOptions {
  /** Human-readable node name; defaults to os.hostname(). */
  name?: string
  /** Stable node id; defaults to a deterministic value derived from hostname. */
  nodeId?: string
}

export class TunnelFabricTransport implements FabricTransport {
  readonly name = "tunnel"

  private _nodeId: string | undefined
  private _nodeName: string | undefined
  private _endpoints: NodeEndpoint[] = []
  private _identity: NodeIdentity | undefined
  private _joining: Promise<JoinResult> | undefined
  private _events: ((event: FabricEvent) => void)[] = []
  private _peers = new PlatformPeerRegistry(undefined, () => this._identity)

  constructor(private readonly opts: TunnelFabricOptions = {}) {}

  available(): boolean {
    return Tunnel.available()
  }

  async join(opts: { port: number; tunnelToken?: string; tunnelHostname?: string }): Promise<JoinResult> {
    if (this._identity) {
      return { ok: true, nodeId: this._identity.nodeId, endpoints: this._endpoints }
    }

    this._joining ??= (async () => {
      try {
        const tunnelOpts: Tunnel.Options = opts.tunnelToken
          ? { mode: "named", token: opts.tunnelToken, hostname: opts.tunnelHostname }
          : { mode: "quick" }

        const url = await Tunnel.start(opts.port, tunnelOpts)
        if (!url) {
          // Named tunnel without a configured hostname: the tunnel runs but we
          // have no URL to advertise.
          return { ok: false, error: "tunnel running without a known URL" } as JoinResult
        }

        this._endpoints = [
          {
            transport: fabricTransportSchema.enum.tunnel,
            url,
            priority: 20,
            metadata: { source: "cloudflared" },
          },
        ]

        this._identity = buildNodeIdentity({
          nodeId: this.opts.nodeId,
          name: this.opts.name,
          endpoints: this._endpoints,
        })
        this._nodeId = this._identity.nodeId
        this._nodeName = this._identity.name

        void InstanceRegistration.registerCapabilityRecord(this._identity).catch((err) => {
          log.warn("failed to publish capability record to platform registry", {
            error: err instanceof Error ? err.message : String(err),
          })
        })

        this._emit({
          id: `evt:${this._nodeId}:joined`,
          type: "fabric.node.joined",
          at: new Date().toISOString(),
          source: "fabric:tunnel",
          subject: this._nodeId,
          data: { endpoints: this._endpoints.map((e) => e.url) },
        })

        return { ok: true, nodeId: this._nodeId, endpoints: this._endpoints }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        log.error("tunnel fabric join failed", { error })
        return { ok: false, error }
      }
    })()

    return this._joining
  }

  async leave(): Promise<void> {
    this._joining = undefined
    Tunnel.stop()
    InstanceRegistration.stop()
    if (this._nodeId) {
      this._emit({
        id: `evt:${this._nodeId}:left`,
        type: "fabric.node.left",
        at: new Date().toISOString(),
        source: "fabric:tunnel",
        subject: this._nodeId,
      })
    }
    this._identity = undefined
    this._endpoints = []
  }

  endpoints(): NodeEndpoint[] {
    return this._endpoints
  }

  identity(): NodeIdentity | undefined {
    return this._identity
  }

  async resolve(query: CapabilityQuery): Promise<NodeIdentity[]> {
    const local = this._identity
    const localMatches =
      local &&
      (!query.nodeId || query.nodeId === local.nodeId) &&
      (!query.name || local.capabilities.some((c) => c.name === query.name)) &&
      (!query.kind || local.capabilities.some((c) => c.kind === query.kind)) &&
      (!query.resource || local.capabilities.some((c) => c.resource === query.resource))

    const peers = await this._peers.query(query).catch((err) => {
      log.warn("peer registry query failed", { error: err instanceof Error ? err.message : String(err) })
      return [] as NodeIdentity[]
    })

    const filteredPeers = local ? peers.filter((p) => p.nodeId !== local.nodeId) : peers
    return localMatches ? [local, ...filteredPeers] : filteredPeers
  }

  async connect(endpoint: NodeEndpoint): Promise<FabricConnection | undefined> {
    try {
      const response = await fetch(`${endpoint.url.replace(/\/$/, "")}/health`, {
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) return undefined
      return {
        url: endpoint.url,
        connected: true,
        close() {},
      }
    } catch (err) {
      log.debug("fabric connect health check failed", {
        url: endpoint.url,
        error: err instanceof Error ? err.message : String(err),
      })
      return undefined
    }
  }

  onEvent(handler: (event: FabricEvent) => void): () => void {
    this._events.push(handler)
    return () => {
      this._events = this._events.filter((h) => h !== handler)
    }
  }

  private _emit(event: FabricEvent) {
    for (const handler of this._events) {
      try {
        handler(event)
      } catch (err) {
        log.warn("fabric event handler threw", { error: err instanceof Error ? err.message : String(err) })
      }
    }
  }
}
