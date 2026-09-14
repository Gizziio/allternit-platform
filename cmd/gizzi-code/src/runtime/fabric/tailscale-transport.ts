/**
 * Tailscale-backed Fabric transport.
 *
 * Implements the FabricTransport interface using the existing Mesh module
 * (tailnet join via sidecar/attach/spawn) and InstanceRegistration
 * (platform registry PUT). This keeps the Tailscale dependency where it
 * already lives — in the mesh join logic — and exposes it through the
 * capability-native Fabric abstraction rather than as a separate remote-access
 * primitive.
 */
import { Log } from "@/shared/util/log"
import { Mesh } from "@/runtime/server/mesh"
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

const log = Log.create({ service: "fabric:tailscale" })

export interface TailscaleFabricOptions {
  /** Human-readable node name; defaults to os.hostname(). */
  name?: string
  /** Stable node id; defaults to a deterministic value derived from hostname. */
  nodeId?: string
}

export class TailscaleFabricTransport implements FabricTransport {
  readonly name = "tailscale"

  private _nodeId: string | undefined
  private _nodeName: string | undefined
  private _endpoints: NodeEndpoint[] = []
  private _identity: NodeIdentity | undefined
  private _joining: Promise<JoinResult> | undefined
  private _events: ((event: FabricEvent) => void)[] = []
  private _peers = new PlatformPeerRegistry(undefined, () => this._identity)

  constructor(private readonly opts: TailscaleFabricOptions = {}) {}

  available(): boolean {
    return Mesh.available()
  }

  async join(opts: { port: number; authKey?: string; controlUrl?: string }): Promise<JoinResult> {
    if (this._identity) {
      return { ok: true, nodeId: this._identity.nodeId, endpoints: this._endpoints }
    }

    this._joining ??= (async () => {
      try {
        const meshUrl = await Mesh.start(opts.port, {
          authKey: opts.authKey,
          controlUrl: opts.controlUrl,
        })

        if (!meshUrl) {
          const reason = "tailscale mesh join skipped (no auth key or mesh unavailable)"
          log.warn(reason)
          return { ok: false, error: reason } as JoinResult
        }

        this._endpoints = [
          {
            transport: fabricTransportSchema.enum.tailscale,
            url: meshUrl,
            priority: 10,
            metadata: { source: "mesh", controlUrl: opts.controlUrl ?? Mesh.DEFAULT_CONTROL_URL },
          },
        ]

        this._identity = buildNodeIdentity({
          nodeId: this.opts.nodeId,
          name: this.opts.name,
          endpoints: this._endpoints,
        })
        this._nodeId = this._identity.nodeId
        this._nodeName = this._identity.name

        // Publish to the platform instance registry as a capability record
        // instead of the legacy { url, name } shape.
        void InstanceRegistration.registerCapabilityRecord(this._identity).catch((err) => {
          log.warn("failed to publish capability record to platform registry", {
            error: err instanceof Error ? err.message : String(err),
          })
        })

        this._emit({
          id: `evt:${this._nodeId}:joined`,
          type: "fabric.node.joined",
          at: new Date().toISOString(),
          source: "fabric:tailscale",
          subject: this._nodeId,
          data: { endpoints: this._endpoints.map((e) => e.url) },
        })

        return { ok: true, nodeId: this._nodeId, endpoints: this._endpoints }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        log.error("tailscale fabric join failed", { error })
        return { ok: false, error }
      }
    })()

    return this._joining
  }

  async leave(): Promise<void> {
    this._joining = undefined
    await Mesh.stop()
    InstanceRegistration.stop()
    if (this._nodeId) {
      this._emit({
        id: `evt:${this._nodeId}:left`,
        type: "fabric.node.left",
        at: new Date().toISOString(),
        source: "fabric:tailscale",
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

    // Exclude the local node from peers if it appears under a different nodeId.
    const filteredPeers = local ? peers.filter((p) => p.nodeId !== local.nodeId) : peers

    return localMatches ? [local, ...filteredPeers] : filteredPeers
  }

  async connect(endpoint: NodeEndpoint): Promise<FabricConnection | undefined> {
    // Lightweight liveness check; the actual execution channel is HTTP over the
    // Fabric endpoint. A future version may use tailscale dial or a WebSocket.
    try {
      const response = await fetch(`${endpoint.url.replace(/\/$/, "")}/health`, {
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) return undefined
      return {
        url: endpoint.url,
        connected: true,
        close() {
          // Stateless HTTP channel; nothing to close.
        },
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
