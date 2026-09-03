/**
 * Fabric lease authority placeholder.
 *
 * Leases are defined canonically by `@allternit/os-contracts` (`leaseSchema`)
 * and signed/validated by an upstream Allternit lease authority service. The
 * gizzi-code runtime does NOT implement its own signing semantics; it only
 * validates that a presented lease matches the canonical schema and is active
 * and unexpired.
 *
 * `POST /v1/fabric/leases` remains a dev-only convenience that mints an
 * unsigned lease so local clients can exercise the capability flow without a
 * deployed authority. Production deployments must disable this endpoint or
 * proxy it to the platform lease service.
 */
import { randomBytes } from "node:crypto"
import z from "zod/v4"
import { Log } from "@/shared/util/log"
import { type FabricLease, fabricLeaseSchema, canonicalLeaseSchema } from "./transport"

const log = Log.create({ service: "fabric:lease-authority" })

const DEFAULT_TTL_SECONDS = 3600

function generateId(): string {
  return `lease_${randomBytes(16).toString("hex")}`
}

export interface LeaseRequest {
  capabilityId: string
  grantee: string
  ttlSeconds?: number
  constraints?: Record<string, unknown>
  policy?: FabricLease["policy"]
}

export namespace LeaseAuthority {
  /**
   * Dev-only lease minting.
   *
   * Returns an unsigned lease. This is intentionally not a security boundary;
   * it exists only so local integration can flow before the upstream lease
   * service is wired in.
   */
  export function issue(req: LeaseRequest): FabricLease {
    const now = Date.now()
    const ttlMs = (req.ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000
    const issuedAt = new Date(now).toISOString()
    const expiresAt = new Date(now + ttlMs).toISOString()

    return {
      id: generateId(),
      capabilityId: req.capabilityId,
      grantee: req.grantee,
      issuedAt,
      expiresAt,
      status: "active",
      constraints: req.constraints,
      policy: req.policy,
      signature: undefined,
    }
  }

  /**
   * Validate a lease against the canonical schema and basic lifetime.
   *
   * Accepts both the internal `FabricLease` shape and the canonical
   * AllternitOS `CapabilityLease` shape; canonical leases are normalized
   * before validation.
   */
  export async function check(
    lease: unknown,
  ): Promise<{ ok: true; lease: FabricLease } | { ok: false; reason: string }> {
    let normalized: FabricLease | undefined

    const donor = fabricLeaseSchema.safeParse(lease)
    if (donor.success) {
      normalized = donor.data
    } else {
      const canonical = canonicalLeaseSchema.safeParse(lease)
      if (canonical.success) {
        normalized = normalizeCanonicalLease(canonical.data)
      }
    }

    if (!normalized) {
      return { ok: false, reason: "lease_malformed" }
    }

    if (normalized.status !== "active") {
      return { ok: false, reason: "lease_not_active" }
    }

    if (Date.parse(normalized.expiresAt ?? "0") <= Date.now()) {
      return { ok: false, reason: "lease_expired" }
    }

    if (normalized.signature == null) {
      log.debug("lease has no signature; accepting under dev mode only")
    }

    return { ok: true, lease: normalized }
  }

  function mapCanonicalState(
    state: z.infer<typeof canonicalLeaseSchema>["state"],
  ): FabricLease["status"] {
    switch (state) {
      case "active":
      case "approved":
        return "active"
      case "expired":
        return "expired"
      case "revoked":
      case "denied":
      case "closed":
      case "requested":
        return "revoked"
    }
  }

  function normalizeCanonicalLease(
    canonical: z.infer<typeof canonicalLeaseSchema>,
  ): FabricLease {
    return {
      id: canonical.id,
      capabilityId: canonical.capability,
      grantee: canonical.subject,
      issuedAt: canonical.issued_at,
      expiresAt: canonical.not_after,
      status: mapCanonicalState(canonical.state),
      constraints: canonical.limits,
      policy: canonical.workload_id
        ? {
            workloadId: canonical.workload_id,
            principalId: canonical.issuer,
            extra: canonical.limits,
          }
        : undefined,
      signature: undefined,
    }
  }

  /** No-op: there is no local secret to reset. */
  export function resetSecret() {
    // retained for test compatibility
  }
}
