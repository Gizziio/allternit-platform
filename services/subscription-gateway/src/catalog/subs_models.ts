// D13 — subs model-selector catalog. Connected accounts publish
// `subs/<provider>:<model_class>` picker entries derived entirely from
// manifest/account/snapshot data. Provider ids are opaque strings here
// (providerIdSchema is a brand): they are formatted, never matched on —
// every match below is data-driven (the config tables at the top).
//
// Entry shape is parity with the allternit-api picker catalog
// (available_model_catalog() in cmd/allternit-api/src/provider_routes.rs):
// { id, name, provider, description?, tier, supports_effort } — plus the
// additive gateway extension fields `health` and `fabric`.
import type { FabricSnapshot, SessionHealth } from "@allternit/subscription-fabric-contracts";
import { poolKeyFor, type RoutingPolicy, DEFAULT_ROUTING_POLICY } from "../router/resolve.js";

// Chat-family detection is data, not a name check: the capability FAMILY is
// the first dot-segment of the capability id, and these families are the chat
// ones. (The Phase 2 brief's `.message`/`.chat` suffix examples predate the
// real registry — what adapters actually declare is `chat.create`,
// `chat.continue`, i.e. the `chat` family.)
export const CHAT_CAPABILITY_FAMILIES: readonly string[] = ["chat"];

// Within a family, the submission entry point for picker entries: new tasks
// are submitted to the capability whose id ends in `.create`; if none exists,
// the family's first capability (id-sorted) is used. Continuation/edit
// capabilities (chat.continue, *.edit) never get picker entries — they are
// not new-task entry points.
export const SUBMISSION_CAPABILITY_SUFFIX = ".create";

// Model classes the catalog publishes, derived from the routing policy's
// model_class_rank keys MINUS the non-chat classes below. `deep` is excluded:
// in this fabric it names the long-running deep-research class (research.deep
// semantics, 20-minute stall windows), not a chat model class — no chat
// capability declares it and a picker row for it would submit a mismatched
// task. Decision recorded in P4_PHASE_2_NOTES.md per the brief.
export const NON_CHAT_MODEL_CLASSES: readonly string[] = ["deep"];

// Model class → picker tier (gateway-local data table; the allternit-api
// picker tiers are flagship | standard | fast | legacy).
export const TIER_BY_MODEL_CLASS: Record<string, string> = {
  fast: "fast",
  standard: "standard",
  reasoning: "flagship",
  deep: "flagship",
};

export interface SubsCatalogEntry {
  id: string; // subs/<provider>:<model_class>
  name: string; // "<account label> (subscription) · <ModelClass>"
  provider: string; // grouping key in the picker
  tier: string;
  description: string;
  supports_effort: boolean;
  health: "ready" | "degraded";
  fabric: {
    adapter_id: string;
    account_id: string;
    capability: string;
    options: { model_class: string };
    pool_key: string;
  };
}

export interface SubsCatalogOptions {
  policy?: Partial<RoutingPolicy>;
  chatFamilies?: readonly string[];
  nonChatModelClasses?: readonly string[];
  tierByModelClass?: Record<string, string>;
}

function titleCase(modelClass: string): string {
  return modelClass.slice(0, 1).toUpperCase() + modelClass.slice(1);
}

// Health gate: the picker offers only routes that need no human. Anything in
// the needs_user family, ui_drift, provider_down, or profile_locked hides the
// entry entirely; ready/degraded show with that badge.
function badgeFor(health: SessionHealth): "ready" | "degraded" | null {
  return health === "ready" || health === "degraded" ? health : null;
}

// Pure derivation over the same FabricSnapshot Phase 1's router consumes
// (assembly stays in router/snapshot.ts — this module never touches the db).
export function subsModelCatalog(
  snapshot: FabricSnapshot,
  options: SubsCatalogOptions = {}
): SubsCatalogEntry[] {
  const policy: RoutingPolicy = { ...DEFAULT_ROUTING_POLICY, ...options.policy };
  const chatFamilies = options.chatFamilies ?? CHAT_CAPABILITY_FAMILIES;
  const nonChat = new Set(options.nonChatModelClasses ?? NON_CHAT_MODEL_CLASSES);
  const tierOf = options.tierByModelClass ?? TIER_BY_MODEL_CLASS;
  const modelClasses = Object.keys(policy.model_class_rank)
    .filter((cls) => !nonChat.has(cls))
    .sort((a, b) => (policy.model_class_rank[a] ?? 0) - (policy.model_class_rank[b] ?? 0));

  const entries: SubsCatalogEntry[] = [];
  for (const manifest of snapshot.manifests) {
    const chatCapabilities = manifest.capabilities
      .filter((c) => c.status !== "disabled" && chatFamilies.includes(c.id.split(".")[0]))
      .sort((a, b) => a.id.localeCompare(b.id));
    if (chatCapabilities.length === 0) continue;
    const submission =
      chatCapabilities.find((c) => c.id.endsWith(SUBMISSION_CAPABILITY_SUFFIX)) ?? chatCapabilities[0];

    for (const account of snapshot.accounts) {
      if (account.provider !== manifest.provider || !account.enabled) continue;
      const health = snapshot.session_health[account.account_id] ?? account.session_health;
      const badge = badgeFor(health);
      if (badge === null) continue;
      // Plan gate: when the account's plan is known and the capability names
      // its plans, an unlisted plan publishes nothing (mirrors router rule).
      if (
        submission.plans.length > 0 &&
        account.plan !== null &&
        !submission.plans.includes(account.plan)
      ) {
        continue;
      }
      const provider = manifest.provider as string;
      for (const modelClass of modelClasses) {
        entries.push({
          id: `subs/${provider}:${modelClass}`,
          name: `${account.label} (subscription) · ${titleCase(modelClass)}`,
          provider,
          tier: tierOf[modelClass] ?? "standard",
          description: "Subscription lane — no metered cost",
          supports_effort: false,
          health: badge,
          fabric: {
            adapter_id: manifest.adapter_id,
            account_id: account.account_id,
            capability: submission.id,
            options: { model_class: modelClass },
            pool_key: poolKeyFor(provider, account.account_id, submission.pool_id),
          },
        });
      }
    }
  }
  // Deterministic order for the picker: id asc.
  return entries.sort((a, b) => a.id.localeCompare(b.id));
}
