/**
 * Lease-check middleware.
 *
 * Validates that the caller has presented a valid Fabric lease for the
 * capability they are trying to use. Leases are short-lived credentials
 * signed by the local lease authority (see `runtime/fabric/lease-authority.ts`).
 *
 * Enforcement is lenient by default: if no lease header is provided the request
 * is allowed but logged, so existing clients continue to work while the lease
 * rollout happens. Set GIZZI_ENFORCE_LEASES=true to reject requests without a
 * valid lease.
 */
import type { MiddlewareHandler } from "hono"
import { Log } from "@/shared/util/log"
import { type FabricLease, fabricLeaseSchema } from "@/runtime/fabric/transport"
import { LeaseAuthority } from "@/runtime/fabric/lease-authority"

const log = Log.create({ service: "lease-check" })

/** Lease IDs explicitly revoked before their natural expiry. */
const revokedLeaseIds = new Set<string>()

export namespace LeaseCheck {
  export const HEADER = "x-allternit-lease"

  export function enforce(): MiddlewareHandler {
    return async (c, next) => {
      const fromHeader = c.req.header(HEADER)
      const fromQuery = c.req.query(HEADER)
      const raw = fromHeader ?? fromQuery
      const capability = c.req.path
      const enforce = process.env.GIZZI_ENFORCE_LEASES === "true"

      if (!raw) {
        if (enforce) {
          log.warn("lease required but not provided", { path: c.req.path })
          return c.json(
            { error: "lease_required", message: "A valid Fabric lease is required for this capability." },
            403,
          )
        }
        log.debug("lease not provided; allowing under lenient mode", { path: c.req.path })
        return next()
      }

      let lease: FabricLease | undefined
      try {
        const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"))
        const result = fabricLeaseSchema.safeParse(parsed)
        if (result.success) lease = result.data
      } catch {
        lease = undefined
      }

      if (!lease) {
        if (enforce) {
          log.warn("lease malformed", { path: c.req.path })
          return c.json({ error: "lease_malformed", message: "The provided lease could not be parsed." }, 403)
        }
        log.debug("lease malformed; allowing under lenient mode", { path: c.req.path })
        return next()
      }

      if (revokedLeaseIds.has(lease.id)) {
        if (enforce) {
          log.warn("lease revoked", { path: c.req.path, leaseId: lease.id })
          return c.json({ error: "lease_revoked", message: "The provided lease has been revoked." }, 403)
        }
        log.debug("lease revoked; allowing under lenient mode", { path: c.req.path, leaseId: lease.id })
        return next()
      }

      const check = await LeaseAuthority.check(lease)
      if (check.ok === false) {
        const reason = check.reason
        if (enforce) {
          log.warn("lease invalid", { path: c.req.path, leaseId: (lease as FabricLease).id, reason })
          return c.json({ error: reason, message: "The provided lease is not valid." }, 403)
        }
        log.debug("lease invalid; allowing under lenient mode", {
          path: c.req.path,
          leaseId: (lease as FabricLease).id,
          reason,
        })
        return next()
      }

      c.set("fabricLease", check.lease)
      c.set("fabricCapability", capability)
      await next()
    }
  }

  /**
   * Verify the lease carried by `enforce()` authorizes a specific capability.
   * Use this on routes that are not dispatched through the executor but still
   * belong to a capability (e.g. SSE event streams).
   */
  export function requireCapability(capability: string): MiddlewareHandler {
    return async (c, next) => {
      const lease = c.get("fabricLease")
      const enforce = process.env.GIZZI_ENFORCE_LEASES === "true"
      if (!enforce) {
        return next()
      }
      if (!lease) {
        const fromQuery = c.req.query(HEADER)
        if (fromQuery) {
          try {
            const parsed = JSON.parse(Buffer.from(fromQuery, "base64url").toString("utf8"))
            const result = fabricLeaseSchema.safeParse(parsed)
            if (result.success) {
              c.set("fabricLease", result.data)
              if (result.data.capabilityId === capability) {
                return next()
              }
            }
          } catch {
            // fall through to lease_required
          }
        }
        return c.json({ error: "lease_required", message: `Lease required for ${capability}.` }, 403)
      }
      if (lease.capabilityId !== capability) {
        return c.json(
          { error: "lease_capability_mismatch", message: `Lease is for ${lease.capabilityId}, not ${capability}.` },
          403,
        )
      }
      return next()
    }
  }

  /** Revoke a lease so the middleware rejects it even if the signature is valid. */
  export function revokeLease(leaseId: string) {
    revokedLeaseIds.add(leaseId)
  }

  /** Restore a revoked lease (mostly useful in tests). */
  export function unrevokeLease(leaseId: string) {
    revokedLeaseIds.delete(leaseId)
  }
}

// Type helpers for Hono context.
declare module "hono" {
  interface ContextVariableMap {
    requestID?: string
    fabricLease?: FabricLease
    fabricCapability?: string
  }
}
