// §A3.4 — probe(): auth state + every critical locator + capability entry
// points. Non-spending: never fills, never clicks, never submits.
import type { Page } from "playwright";
import type { ProbeCheck, ProbeResult } from "@allternit/subscription-fabric-contracts";
import { detectAuthState } from "./auth";
import type { SdkSelectorResolver, SelectorPack } from "./selectors";

export interface ProbeInput {
  auth: { login_url: string; logged_in_probe: string }; // logged_in_probe is a pack key
  criticalKeys?: string[]; // default: every critical: true key in the pack
}

export async function probe(
  page: Page,
  resolver: SdkSelectorResolver,
  pack: SelectorPack,
  input: ProbeInput
): Promise<ProbeResult> {
  const checks: ProbeCheck[] = [];

  const authState = await detectAuthState(page, resolver, { probeKey: input.auth.logged_in_probe });
  checks.push({
    key: "auth.state",
    critical: true,
    ok: authState === "ready",
    detail: authState,
  });

  const criticalKeys = input.criticalKeys ?? pack.criticalKeys();
  for (const key of criticalKeys) {
    const locator = await resolver.tryResolveLocator(key);
    checks.push({
      key,
      critical: true,
      ok: locator !== null,
      detail: locator ? (resolver.lastMatchedStrategy(key) ?? undefined) : "no strategy matched",
    });
  }

  // §A3.4 — capability entry points: pack keys under the `capability:` group.
  for (const key of pack.keys().filter((k) => k.startsWith("capability:"))) {
    if (criticalKeys.includes(key)) continue;
    const locator = await resolver.tryResolveLocator(key);
    checks.push({
      key,
      critical: false,
      ok: locator !== null,
      detail: locator ? (resolver.lastMatchedStrategy(key) ?? undefined) : "entry point vanished",
    });
  }

  const ok = checks.filter((c) => c.critical).every((c) => c.ok);
  return { ok, checks, observed_at: new Date().toISOString() };
}
