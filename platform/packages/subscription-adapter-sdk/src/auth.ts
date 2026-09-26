// §A3.1 — detectAuthState + threadIdFromUrl.
import type { Page } from "playwright";
import type { SdkSelectorResolver } from "./selectors";

export type AuthState = "ready" | "auth_required";

export interface DetectAuthOptions {
  // Pack key for a locator that only exists when logged in.
  probeKey?: string;
  loggedInUrlPattern?: RegExp;
  loggedOutUrlPattern?: RegExp;
}

// URL pattern first (explicit login page beats an ambiguous DOM), then the
// logged-in probe locator.
export async function detectAuthState(
  page: Page,
  resolver: SdkSelectorResolver,
  opts: DetectAuthOptions = {}
): Promise<AuthState> {
  const url = page.url();
  if (opts.loggedOutUrlPattern?.test(url)) return "auth_required";
  const probe = await resolver.tryResolveLocator(opts.probeKey ?? "logged_in_probe");
  if (probe !== null) return "ready";
  if (opts.loggedInUrlPattern?.test(url)) return "ready";
  return "auth_required";
}

// First capture group of the pattern is the provider thread id.
export function threadIdFromUrl(url: string, pattern: RegExp): string | null {
  const m = pattern.exec(url);
  return m && m[1] !== undefined ? m[1] : null;
}
