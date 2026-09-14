/**
 * Peer registry for capability-based node discovery.
 *
 * The scheduler needs to resolve "I need capability X" to a node that hosts X.
 * This module queries the Allternit platform registries (gizzi instances +
 * runtime devices) and merges the results into `NodeIdentity` records.
 *
 * NOTE: the platform registry currently stores URL/name for instances and
 * string capabilities for runtime devices. The full `NodeIdentity` record is
 * reconstructed here from both sources. Once the platform stores full
 * capability records (see instance-registration.ts), this merge becomes a
 * single query.
 */
import { Log } from "@/shared/util/log"
import { Flag } from "@/runtime/context/flag/flag"
import { Pairing } from "@/runtime/services/pairing/pairing"
import {
  type NodeIdentity,
  type CapabilityQuery,
  type FabricCapability,
  fabricCapabilityKindSchema,
} from "./transport"

const log = Log.create({ service: "fabric:peer-registry" })

const FETCH_TIMEOUT_MS = 10_000
const DEFAULT_TTL_MS = 30_000

export interface PeerRegistry {
  /** Resolve a capability query to matching peer nodes. */
  query(q: CapabilityQuery): Promise<NodeIdentity[]>
  /** Forget cached peers. */
  invalidate(): void
}

/** Platform API peer record from `/api/v1/gizzi-instances`. */
interface GizziInstance {
  id: string
  name: string
  url: string
  status: string
  updated_at: string
  /** Full capability-native NodeIdentity, if the platform registry stores it. */
  record?: NodeIdentity
}

/** Platform API peer record from `/api/v1/runtime-devices`. */
interface RuntimeDevice {
  id: string
  name: string
  runtimeType?: string
  hostname?: string
  platform?: string
  version?: string
  capabilities?: string[]
  publicKeyFingerprint?: string
  status?: string
  lastSeenAt?: string
  createdAt?: string
}

export class PlatformPeerRegistry implements PeerRegistry {
  private cache: { at: number; peers: NodeIdentity[] } | undefined
  private fetching: Promise<NodeIdentity[]> | undefined

  constructor(
    private readonly ttlMs = DEFAULT_TTL_MS,
    private readonly localIdentity?: () => NodeIdentity | undefined,
  ) {}

  async query(q: CapabilityQuery): Promise<NodeIdentity[]> {
    const peers = await this._peers()
    return peers.filter((peer) => this._matches(peer, q))
  }

  invalidate() {
    this.cache = undefined
    this.fetching = undefined
  }

  private _matches(peer: NodeIdentity, q: CapabilityQuery): boolean {
    if (q.nodeId && peer.nodeId !== q.nodeId) return false
    if (q.name && !peer.capabilities.some((c) => c.name === q.name)) return false
    if (q.kind && !peer.capabilities.some((c) => c.kind === q.kind)) return false
    if (q.resource && !peer.capabilities.some((c) => c.resource === q.resource)) return false
    return true
  }

  private async _peers(): Promise<NodeIdentity[]> {
    const now = Date.now()
    if (this.cache && now - this.cache.at < this.ttlMs) {
      return this._withLocal(this.cache.peers)
    }

    this.fetching ??= (async () => {
      try {
        const peers = await this._fetchPeers()
        this.cache = { at: Date.now(), peers }
        return peers
      } catch (err) {
        log.warn("failed to fetch peers from platform registry", {
          error: err instanceof Error ? err.message : String(err),
        })
        return this.cache?.peers ?? []
      } finally {
        this.fetching = undefined
      }
    })()

    return this._withLocal(await this.fetching)
  }

  private _withLocal(peers: NodeIdentity[]): NodeIdentity[] {
    const local = this.localIdentity?.()
    if (!local) return peers
    const withoutLocal = peers.filter((p) => p.nodeId !== local.nodeId)
    return [local, ...withoutLocal]
  }

  private async _fetchPeers(): Promise<NodeIdentity[]> {
    const credential = await this._resolveCredential()
    if (!credential) {
      log.debug("no credential available for peer registry query")
      return []
    }

    const [instances, devices] = await Promise.all([
      this._fetchInstances(credential),
      this._fetchRuntimeDevices(credential),
    ])

    const byName = new Map<string, GizziInstance>()
    for (const instance of instances) byName.set(instance.name, instance)

    const peers: NodeIdentity[] = []
    for (const device of devices) {
      const instance = byName.get(device.name)
      const nodeId = `node:${device.id}`

      // If the platform registry stores the full capability record, use it as-is
      // and only override endpoints if the instance URL is present.
      if (instance?.record) {
        const record = instance.record
        peers.push({
          ...record,
          nodeId: record.nodeId ?? nodeId,
          endpoints: record.endpoints.length ? record.endpoints : this._instanceEndpoints(instance),
        })
        continue
      }

      peers.push({
        nodeId,
        name: device.name,
        runtimeType: device.runtimeType ?? "desktop",
        platform: device.platform ?? "unknown",
        version: device.version ?? "0.0.0",
        endpoints: instance ? this._instanceEndpoints(instance) : [],
        capabilities: this._deviceCapabilities(device.capabilities ?? []),
        resources: [
          { kind: "platform.os", name: "platform", value: device.platform ?? "unknown" },
        ],
      })
    }

    // Include any gizzi instances that lack a runtime_device row (e.g. clerk-registered).
    for (const instance of instances) {
      if (devices.some((d) => d.name === instance.name)) continue
      if (instance.record) {
        peers.push(instance.record)
        continue
      }
      peers.push({
        nodeId: `node:${instance.id}`,
        name: instance.name,
        runtimeType: "desktop",
        platform: "unknown",
        version: "0.0.0",
        endpoints: this._instanceEndpoints(instance),
        capabilities: [],
        resources: [],
      })
    }

    return peers
  }

  private async _resolveCredential(): Promise<string | undefined> {
    const device = await Pairing.load()
    if (Pairing.tokenUsable(device)) return device.deviceToken
    const envToken = process.env.ALLTERNIT_API_TOKEN?.trim()
    if (envToken) return envToken
    return undefined
  }

  private async _fetchInstances(credential: string): Promise<GizziInstance[]> {
    const platform = Flag.GIZZI_PLATFORM_API_URL.replace(/\/+$/, "")
    const response = await fetch(`${platform}/api/v1/gizzi-instances`, {
      headers: { authorization: `Bearer ${credential}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(`instances query failed (${response.status}): ${body}`)
    }
    const json = (await response.json()) as { instances?: GizziInstance[] }
    return json.instances ?? []
  }

  private async _fetchRuntimeDevices(credential: string): Promise<RuntimeDevice[]> {
    const platform = Flag.GIZZI_PLATFORM_API_URL.replace(/\/+$/, "")
    const response = await fetch(`${platform}/api/v1/runtime-devices`, {
      headers: { authorization: `Bearer ${credential}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(`runtime-devices query failed (${response.status}): ${body}`)
    }
    const json = (await response.json()) as { runtimes?: RuntimeDevice[] }
    return json.runtimes ?? []
  }

  private _instanceEndpoints(instance: GizziInstance) {
    return [
      {
        transport: instance.url.includes("100.") ? ("tailscale" as const) : ("tunnel" as const),
        url: instance.url,
        priority: instance.url.includes("100.") ? 10 : 20,
        metadata: { instanceId: instance.id, status: instance.status },
      },
    ]
  }

  private _deviceCapabilities(capabilityStrings: string[]): FabricCapability[] {
    return capabilityStrings.map((name, index) => {
      const kind = this._inferKind(name)
      return {
        id: `cap:${name}:${index}`,
        name,
        version: "0.1.0",
        kind,
        resource: this._inferResource(name),
      }
    })
  }

  private _inferKind(name: string) {
    if (name.includes(":connect") || name.includes(":observe") || name.includes("remote_control")) {
      return fabricCapabilityKindSchema.enum.observe
    }
    if (name.includes(":execute") || name.includes(":terminal") || name.includes("shell")) {
      return fabricCapabilityKindSchema.enum.execute
    }
    if (name.includes(":files") || name.includes(":write")) return fabricCapabilityKindSchema.enum.write
    if (name.includes(":read")) return fabricCapabilityKindSchema.enum.read
    if (name.includes(":use") || name.includes("providers")) return fabricCapabilityKindSchema.enum.compute
    return fabricCapabilityKindSchema.enum.execute
  }

  private _inferResource(name: string): string {
    if (name.startsWith("runtime:")) return name.split(":")[0]
    if (name.startsWith("providers:")) return "provider"
    return "unknown"
  }
}
