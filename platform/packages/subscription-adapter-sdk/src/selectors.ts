// §A3.2 — selector registry: YAML packs, ordered fallback, drift telemetry.
import { load } from "js-yaml";
import type { Locator, Page } from "playwright";
import type { SelectorResolver } from "@allternit/subscription-fabric-contracts";

export type SelectorStrategy =
  | { role: string; name?: string }
  | { testid: string }
  | { css: string }
  | { text: string };

export interface SelectorKeyDef {
  critical: boolean;
  strategies: SelectorStrategy[];
}

export interface DriftSignal {
  key: string;
  strategy_index: number;
  total: number;
}

export class SelectorNotFoundError extends Error {
  constructor(
    public readonly key: string,
    total: number
  ) {
    super(
      `selector key "${key}" matched nothing after ${total} strateg${
        total === 1 ? "y" : "ies"
      }`
    );
    this.name = "SelectorNotFoundError";
  }
}

function strategyKind(s: SelectorStrategy): string {
  if ("role" in s) return "role";
  if ("testid" in s) return "testid";
  if ("css" in s) return "css";
  return "text";
}

export class SelectorPack {
  private constructor(private readonly defs: ReadonlyMap<string, SelectorKeyDef>) {}

  // Pack shape: named keys → { critical, strategies: ordered fallbacks }.
  // File order is honored; semantic-first/css-last is convention, not enforced.
  static fromYaml(text: string): SelectorPack {
    const raw = load(text);
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new Error("selector pack must be a YAML mapping of key → { critical, strategies }");
    }
    const defs = new Map<string, SelectorKeyDef>();
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const v = value as { critical?: unknown; strategies?: unknown };
      if (!Array.isArray(v?.strategies) || v.strategies.length === 0) {
        throw new Error(`selector key "${key}" must declare a non-empty strategies array`);
      }
      defs.set(key, {
        critical: v.critical === true,
        strategies: v.strategies as SelectorStrategy[],
      });
    }
    return new SelectorPack(defs);
  }

  has(key: string): boolean {
    return this.defs.has(key);
  }

  get(key: string): SelectorKeyDef | undefined {
    return this.defs.get(key);
  }

  keys(): string[] {
    return [...this.defs.keys()];
  }

  criticalKeys(): string[] {
    return [...this.defs.entries()].filter(([, d]) => d.critical).map(([k]) => k);
  }
}

export interface ResolverOptions {
  onDrift?: (signal: DriftSignal) => void;
}

// Contracts SelectorResolver plus a concrete Playwright locator accessor.
export interface SdkSelectorResolver extends SelectorResolver {
  resolveLocator(locator_key: string): Promise<Locator>;
  tryResolveLocator(locator_key: string): Promise<Locator | null>;
}

function strategyLocator(page: Page, s: SelectorStrategy): Locator {
  if ("role" in s) {
    const opts = s.name !== undefined ? { name: patternToMatcher(s.name) } : undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return page.getByRole(s.role as any, opts);
  }
  if ("testid" in s) return page.getByTestId(s.testid);
  if ("css" in s) return page.locator(s.css);
  return page.getByText(patternToMatcher(s.text));
}

// "/re/i" strings in YAML become RegExp; anything else stays a literal string.
function patternToMatcher(p: string): string | RegExp {
  const m = /^\/(.*)\/([a-z]*)$/.exec(p);
  return m ? new RegExp(m[1], m[2]) : p;
}

export function createResolver(
  page: Page,
  pack: SelectorPack,
  opts: ResolverOptions = {}
): SdkSelectorResolver {
  const lastMatched = new Map<string, string>();

  async function walk(key: string): Promise<Locator | null> {
    const def = pack.get(key);
    if (!def) return null;
    for (let i = 0; i < def.strategies.length; i++) {
      const locator = strategyLocator(page, def.strategies[i]);
      if ((await locator.first().count()) > 0) {
        lastMatched.set(key, `${i}:${strategyKind(def.strategies[i])}`);
        if (i > 0 && opts.onDrift) {
          opts.onDrift({ key, strategy_index: i, total: def.strategies.length });
        }
        return locator;
      }
    }
    return null;
  }

  return {
    async resolve(locator_key: string): Promise<unknown> {
      return this.resolveLocator(locator_key);
    },
    lastMatchedStrategy(locator_key: string): string | null {
      return lastMatched.get(locator_key) ?? null;
    },
    async tryResolveLocator(locator_key: string): Promise<Locator | null> {
      return walk(locator_key);
    },
    async resolveLocator(locator_key: string): Promise<Locator> {
      const locator = await walk(locator_key);
      if (!locator) {
        const def = pack.get(locator_key);
        throw new SelectorNotFoundError(locator_key, def ? def.strategies.length : 0);
      }
      return locator;
    },
  };
}
