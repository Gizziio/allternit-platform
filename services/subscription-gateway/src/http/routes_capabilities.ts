// GET /v1/capabilities — live registry view (loaded adapter manifests),
// extended in P4 with the route lane and per-entitlement pool state + reject
// reason (drives the CLI picker and the P4 Phase 2 catalog). Additive only:
// every P3 field keeps its name and meaning. Empty when no registry is wired
// (unit tests) or no adapters are installed.
import { Router, type Request, type Response } from "express";
import type { AdapterRegistry } from "../adapters/registry.js";
import { buildSnapshot } from "../router/snapshot.js";
import {
  entitlementForAccount,
  laneForManifest,
  poolKeyFor,
  type PoolEntitlement,
} from "../router/resolve.js";
import type { Db } from "../store/db.js";
import type { GatewayDeps } from "./server.js";

export interface CapabilityViewEntryV2 {
  capability: string;
  adapter_id: string;
  adapter_version: string;
  provider: string;
  pool_id: string;
  plans: string[];
  detachable: boolean;
  export_formats: string[];
  status: "stable" | "beta" | "disabled";
  // P4 additions:
  lane: "subscription" | "local" | "credits" | "metered";
  entitlements: PoolEntitlement[];
}

export function capabilitiesView(db: Db, registry: AdapterRegistry, now = new Date()): CapabilityViewEntryV2[] {
  const snapshot = buildSnapshot(db, registry, now);
  return registry.capabilities().map((entry) => {
    const manifest = registry.byId(entry.adapter_id)?.manifest;
    const cap = manifest?.capabilities.find(
      (c) => c.id === entry.capability && c.pool_id === entry.pool_id
    );
    const entitlements: PoolEntitlement[] = [];
    if (manifest && cap) {
      for (const account of snapshot.accounts) {
        if (account.provider !== manifest.provider) continue;
        const health = snapshot.session_health[account.account_id] ?? account.session_health;
        const pool = snapshot.pools.find(
          (p) => p.pool_key === poolKeyFor(manifest.provider, account.account_id, cap.pool_id)
        );
        entitlements.push(entitlementForAccount(manifest, cap, account, pool, health, now));
      }
    }
    return { ...entry, lane: manifest ? laneForManifest(manifest) : "subscription", entitlements };
  });
}

export function capabilitiesRouter(deps: GatewayDeps): Router {
  const router = Router();

  router.get("/v1/capabilities", (_req: Request, res: Response) => {
    if (!deps.adapterRegistry) {
      res.json([]);
      return;
    }
    res.json(capabilitiesView(deps.db, deps.adapterRegistry));
  });

  return router;
}
