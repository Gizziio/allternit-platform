/**
 * AllternitOS contract spine — DRAFT.
 *
 * These are the minimal `Workload`/`Artifact`/`Capability`/`Lease`/`Receipt`/
 * `Approval`/`Event` contracts the Documents and Office program package is
 * built against. They are PROVISIONAL: the platform's contract-spine ADRs
 * (ADR-002..012) are not ratified (see docs/GENOFFICE_PHASE5_DECISION.md and
 * docs/Core_System/00-Strategy/ALLTERNIT_OS_LIVING_ROADMAP.md), so shapes
 * here may change when the ratified schemas land. Everything in this package
 * is versioned `0.1.0-draft` and must not be treated as a stable platform
 * contract until ratification.
 */

import { z } from 'zod'

/** Contract spine version — bumped on any shape change. */
export const CONTRACT_SPINE_VERSION = '0.1.0-draft.0'

/** Lifecycle marker: everything here is provisional until ADR ratification. */
export const CONTRACT_SPINE_STATUS = 'DRAFT-pending-ADR-ratification' as const

const isoDateTime = z.string().datetime()
const id = z.string().min(1)

// ── Event ────────────────────────────────────────────────────────────────────

export const eventSchema = z.object({
  id,
  /** Dot-namespaced event type, e.g. `artifact.created`. */
  type: z.string().min(1),
  at: isoDateTime,
  /** Emitting program or service id. */
  source: z.string().min(1),
  /** Subject resource id (artifact, workload, …) when applicable. */
  subject: z.string().optional(),
  data: z.record(z.unknown()).optional(),
})
export type SpineEvent = z.infer<typeof eventSchema>

// ── Capability ───────────────────────────────────────────────────────────────

export const capabilityKindSchema = z.enum(['read', 'write', 'execute', 'compute'])
export const capabilitySchema = z.object({
  id,
  /** Dot-namespaced capability name, e.g. `office.docx.edit`. */
  name: z.string().min(1),
  version: z.string().min(1),
  kind: capabilityKindSchema,
  /** Resource scope the capability governs, e.g. `artifact:office-document`. */
  resource: z.string().min(1),
  description: z.string().optional(),
})
export type Capability = z.infer<typeof capabilitySchema>

// ── Lease ────────────────────────────────────────────────────────────────────

export const leaseSchema = z.object({
  id,
  capabilityId: id,
  /** Program the capability is granted to. */
  grantee: z.string().min(1),
  issuedAt: isoDateTime,
  expiresAt: isoDateTime.optional(),
  status: z.enum(['active', 'revoked', 'expired']),
  constraints: z.record(z.unknown()).optional(),
})
export type Lease = z.infer<typeof leaseSchema>

// ── Workload ─────────────────────────────────────────────────────────────────

export const workloadSchema = z.object({
  id,
  programId: z.string().min(1),
  /** Dot-namespaced workload kind, e.g. `office.document.parse`. */
  kind: z.string().min(1),
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']),
  /** Leases this workload executes under. */
  leaseIds: z.array(id).default([]),
  inputs: z.record(z.unknown()).optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
})
export type Workload = z.infer<typeof workloadSchema>

// ── Artifact ─────────────────────────────────────────────────────────────────

export const artifactProvenanceSchema = z.object({
  workloadId: id.optional(),
  programId: z.string().optional(),
  /** Free-form lineage note (e.g. engine name + version). */
  engine: z.string().optional(),
})

export const artifactSchema = z.object({
  id,
  workspaceId: z.string().min(1),
  type: z.string().min(1),
  title: z.string(),
  status: z.enum(['draft', 'published', 'archived']),
  /** Monotonic content version; 1-based. */
  version: z.number().int().positive(),
  /** Content fingerprint (format recorded in `checksumAlgo`). */
  checksum: z.string().optional(),
  checksumAlgo: z.enum(['fnv1a64', 'sha256']).optional(),
  provenance: artifactProvenanceSchema.optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
})
export type Artifact = z.infer<typeof artifactSchema>

// ── Receipt ──────────────────────────────────────────────────────────────────

export const receiptSchema = z.object({
  id,
  workloadId: id,
  status: z.enum(['succeeded', 'failed', 'cancelled']),
  /** Artifacts produced or mutated by the workload. */
  artifactIds: z.array(id).default([]),
  /** Short human/agent-readable summary of what happened. */
  summary: z.string().optional(),
  issuedAt: isoDateTime,
})
export type Receipt = z.infer<typeof receiptSchema>

// ── Approval ─────────────────────────────────────────────────────────────────

export const approvalSchema = z.object({
  id,
  workloadId: id,
  prompt: z.string().min(1),
  status: z.enum(['pending', 'approved', 'rejected']),
  decidedAt: isoDateTime.optional(),
  decidedBy: z.string().optional(),
})
export type Approval = z.infer<typeof approvalSchema>

// ── Program manifest ─────────────────────────────────────────────────────────

export const programSurfaceSchema = z.object({
  /** Surface kind: web route, desktop window, or native mobile view. */
  kind: z.enum(['web-route', 'desktop-window', 'ios-view']),
  /** Route path (`/docs`), window target (`docs`), or iOS feature name. */
  ref: z.string().min(1),
})

export const programSidecarSchema = z.object({
  /** Managed child process the program needs (e.g. office-engine). */
  name: z.string().min(1),
  /** How the host lifecycle-manages it. */
  lifecycle: z.enum(['managed', 'external']),
  healthPath: z.string().optional(),
})

export const programManifestSchema = z.object({
  programId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  /** `provisional` until the contract spine ADRs are ratified. */
  status: z.enum(['provisional', 'ratified']),
  contractSpineVersion: z.string().min(1),
  capabilities: z.array(capabilitySchema),
  surfaces: z.array(programSurfaceSchema),
  sidecars: z.array(programSidecarSchema).default([]),
})
export type ProgramManifest = z.infer<typeof programManifestSchema>
