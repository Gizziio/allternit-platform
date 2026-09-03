/**
 * Fabric transport contracts for the Allternit capability-native architecture.
 *
 * Canonical types are imported from `@allternit/os-contracts`. This file
 * provides zod v4 runtime validators aligned with those contracts so the
 * gizzi-code runtime can parse/validate incoming requests without taking a
 * direct zod-version dependency inside the contracts package.
 *
 * Invariant: **do not invent local semantic variants.** If a shape needs to
 * change, change it in `packages/@allternit/os-contracts/src/spine.ts` first,
 * then mirror it here.
 */
import z from "zod/v4"
import {
  type Capability as FabricCapability,
  type Lease as FabricLease,
  type Workload as FabricWorkload,
  type NodeIdentity,
  type NodeEndpoint,
  type NodeResource,
  type CapabilityQuery,
  type FabricEvent,
  type FabricTransport as FabricTransportName,
  capabilityKindSchema as contractCapabilityKindSchema,
  nodeEndpointSchema as contractNodeEndpointSchema,
  nodeResourceSchema as contractNodeResourceSchema,
  nodeIdentitySchema as contractNodeIdentitySchema,
  capabilityQuerySchema as contractCapabilityQuerySchema,
  fabricEventSchema as contractFabricEventSchema,
  leaseSchema as contractLeaseSchema,
  workloadSchema as contractWorkloadSchema,
} from "@allternit/os-contracts"

export {
  type FabricCapability,
  type FabricLease,
  type FabricWorkload,
  type NodeIdentity,
  type NodeEndpoint,
  type NodeResource,
  type CapabilityQuery,
  type FabricEvent,
  type FabricTransportName,
}

/** Re-export the contract spine version for debugging/negotiation. */
export { CONTRACT_SPINE_VERSION, CONTRACT_SPINE_STATUS } from "@allternit/os-contracts"

/** Runtime validator for capability kinds (mirror of contract). */
export const fabricCapabilityKindSchema = z.enum([
  contractCapabilityKindSchema.enum.read,
  contractCapabilityKindSchema.enum.write,
  contractCapabilityKindSchema.enum.execute,
  contractCapabilityKindSchema.enum.compute,
  contractCapabilityKindSchema.enum.observe,
  contractCapabilityKindSchema.enum.stream,
])

/** Runtime validator for a capability (mirror of contract `capabilitySchema`). */
export const fabricCapabilitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  kind: fabricCapabilityKindSchema,
  resource: z.string().min(1),
  description: z.string().optional(),
})

/** Runtime validator for a workload (mirror of contract `workloadSchema`). */
export const fabricWorkloadSchema = z.object({
  id: z.string().min(1),
  programId: z.string().min(1),
  kind: z.string().min(1),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  leaseIds: z.array(z.string().min(1)).default([]),
  inputs: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

/** Runtime validator for a node endpoint (mirror of contract). */
export const fabricTransportSchema = z.enum(["tailscale", "tunnel", "mdns", "local", "relay"])

export const nodeEndpointSchema = z.object({
  transport: fabricTransportSchema,
  url: z.string().url(),
  priority: z.number().int().default(0),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/** Runtime validator for a node resource (mirror of contract). */
export const nodeResourceSchema = z.object({
  kind: z.string().min(1),
  name: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  unit: z.string().optional(),
})

/** Runtime validator for a node identity (mirror of contract). */
export const nodeIdentitySchema = z.object({
  nodeId: z.string().min(1),
  name: z.string().min(1),
  runtimeType: z.string().min(1),
  platform: z.string().min(1),
  version: z.string().min(1),
  endpoints: z.array(nodeEndpointSchema),
  capabilities: z.array(fabricCapabilitySchema),
  resources: z.array(nodeResourceSchema).optional(),
})

/** Runtime validator for a capability query (mirror of contract). */
export const capabilityQuerySchema = z.object({
  name: z.string().optional(),
  kind: fabricCapabilityKindSchema.optional(),
  resource: z.string().optional(),
  nodeId: z.string().optional(),
})

/** Runtime validator for a Fabric event (mirror of contract). */
export const fabricEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  at: z.string().datetime(),
  source: z.string().min(1),
  subject: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

/** Runtime validator for a capability lease (mirror of contract `leaseSchema`). */
export const fabricLeaseSchema = z.object({
  id: z.string().min(1),
  capabilityId: z.string().min(1),
  grantee: z.string().min(1),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  status: z.enum(["active", "revoked", "expired"]),
  constraints: z.record(z.string(), z.unknown()).optional(),
  policy: z
    .object({
      workloadId: z.string().optional(),
      principalId: z.string().optional(),
      budgetId: z.string().optional(),
      maxInvocations: z.number().int().min(1).optional(),
      extra: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  signature: z.string().optional(),
})

/**
 * Canonical AllternitOS CapabilityLease validator.
 *
 * Accepts the canonical shape from `contracts/workload/v0.1/capability-lease.schema.json`.
 * The runtime normalizes this to the internal `FabricLease` shape for validation.
 */
export const canonicalLeaseSchema = z.object({
  id: z.string().min(1),
  revision: z.number().int().min(1).optional(),
  subject: z.string().min(1),
  issuer: z.string().min(1).optional(),
  workload_id: z.string().min(1).optional(),
  step_id: z.string().min(1).optional(),
  capability: z.string().min(1),
  resource: z.string().optional(),
  actions: z.array(z.string().min(1)).optional(),
  purpose: z.string().min(1).optional(),
  state: z.enum(["requested", "approved", "denied", "active", "expired", "revoked", "closed"]),
  issued_at: z.string().datetime(),
  not_after: z.string().datetime().optional(),
  policy_ref: z.string().min(1).optional(),
  parent_lease_id: z.string().min(1).optional(),
  limits: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  revoked_at: z.string().datetime().optional(),
  revocation_reason: z.string().optional(),
})

// ── Fabric transport interface ───────────────────────────────────────────────

/** Result of a join operation. */
export type JoinResult =
  | { ok: true; nodeId: string; endpoints: NodeEndpoint[] }
  | { ok: false; error: string }

/** A connection to another Fabric node. */
export interface FabricConnection {
  /** URL this connection reaches. */
  readonly url: string
  /** True if the underlying transport considers the channel alive. */
  readonly connected: boolean
  /** Close the channel. */
  close(): void
}

/**
 * Pluggable transport for joining and publishing on the Allternit Fabric.
 *
 * Implementations: TailscaleFabricTransport (production), LocalFabricTransport
 * (loopback testing), RelayFabricTransport (future).
 */
export interface FabricTransport {
  /** Transport name, e.g. "tailscale". */
  readonly name: string

  /** True when the transport layer is available on this host. */
  available(): boolean

  /**
   * Join the Fabric and return the endpoints this node is reachable on.
   * Idempotent: concurrent and repeated calls return the same promise.
   */
  join(opts: { port: number; authKey?: string; controlUrl?: string }): Promise<JoinResult>

  /** Leave the Fabric and tear down any transport-owned processes. */
  leave(): Promise<void>

  /** Current endpoints for this node, if joined. */
  endpoints(): NodeEndpoint[]

  /** Current node identity, if joined. */
  identity(): NodeIdentity | undefined

  /** Resolve a capability query to known nodes/endpoints. */
  resolve(query: CapabilityQuery): Promise<NodeIdentity[]>

  /** Establish a connection to the given node endpoint. */
  connect(endpoint: NodeEndpoint): Promise<FabricConnection | undefined>

  /** Subscribe to Fabric membership events. */
  onEvent(handler: (event: FabricEvent) => void): () => void
}
