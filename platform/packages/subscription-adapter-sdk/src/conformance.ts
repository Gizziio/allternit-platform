// §A3.5 — shared conformance suite: selector resolution, completion detection,
// banner classification, thread-ID parsing, probe — every adapter, every fixture.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import type { QuotaSignal } from "@allternit/subscription-fabric-contracts";
import { threadIdFromUrl } from "./auth";
import { createBannerClassifier, type BannerPattern } from "./banners";
import { CompletionTimeout, awaitCompletion, type CompletionOptions } from "./completion";
import { probe, type ProbeInput } from "./probe";
import { SelectorPack, createResolver } from "./selectors";

export interface FixtureExpectation {
  resolves?: string[]; // pack keys that must resolve on this fixture
  absent?: string[]; // pack keys that must NOT resolve
  probeOk?: boolean;
  completes?: boolean;
  bannerKinds?: QuotaSignal["kind"][];
}

export interface ConformanceTarget {
  pack: SelectorPack;
  banners: BannerPattern[];
  threadUrlPattern: RegExp;
  sampleThreadUrl: string;
  sampleThreadId: string;
  probeInput: ProbeInput;
  expectations?: Record<string, FixtureExpectation>;
}

export type ConformanceAdapterFactory = () => ConformanceTarget;

export interface ConformanceCheck {
  fixture: string;
  check: string;
  ok: boolean;
  detail?: string;
}

export interface ConformanceReport {
  ok: boolean;
  checks: ConformanceCheck[];
  failures: ConformanceCheck[];
}

export class ConformanceError extends Error {
  constructor(public readonly report: ConformanceReport) {
    super(
      `conformance failed (${report.failures.length}): ` +
        report.failures
          .map((f) => `${f.fixture}/${f.check}${f.detail ? ` — ${f.detail}` : ""}`)
          .join("; ")
    );
    this.name = "ConformanceError";
  }
}

export const CANONICAL_FIXTURES = [
  "logged-out",
  "idle",
  "streaming",
  "complete",
  "limit-banner",
  "challenge",
] as const;

export const DEFAULT_EXPECTATIONS: Record<string, FixtureExpectation> = {
  "logged-out": { absent: ["logged_in_probe"], probeOk: false },
  idle: {
    resolves: ["composer", "send_button", "logged_in_probe"],
    absent: ["stop_button", "streaming"],
    probeOk: true,
  },
  streaming: { resolves: ["stop_button", "streaming"], completes: false },
  complete: {
    resolves: ["response"],
    absent: ["stop_button", "streaming"],
    completes: true,
  },
  "limit-banner": { bannerKinds: ["limit_banner"] },
  challenge: { absent: ["logged_in_probe"], probeOk: false },
};

export interface ConformanceOptions {
  browser?: Browser; // tests inject the launchBrowser fallback browser
  completion?: CompletionOptions;
}

export async function runConformance(
  factory: ConformanceAdapterFactory,
  fixturesDir: string,
  opts: ConformanceOptions = {}
): Promise<ConformanceReport> {
  const target = factory();
  const { pack } = target;
  const expectations: Record<string, FixtureExpectation> = {
    ...DEFAULT_EXPECTATIONS,
    ...target.expectations,
  };
  const checks: ConformanceCheck[] = [];
  const push = (fixture: string, check: string, ok: boolean, detail?: string) =>
    checks.push({ fixture, check, ok, detail });

  const threadId = threadIdFromUrl(target.sampleThreadUrl, target.threadUrlPattern);
  push("(pure)", "thread-id", threadId === target.sampleThreadId, threadId ?? "no match");

  const ownBrowser = opts.browser
    ? null
    : await chromium.launch().catch(() => chromium.launch({ channel: "chrome" }));
  const browser = opts.browser ?? ownBrowser;
  if (!browser) throw new Error("no browser available for conformance");
  try {
    for (const fixture of CANONICAL_FIXTURES) {
      const html = readFileSync(join(fixturesDir, `${fixture}.html`), "utf8");
      const page = await browser.newPage();
      await page.setContent(html);
      const resolver = createResolver(page, pack);
      const exp = expectations[fixture] ?? {};

      for (const key of exp.resolves ?? []) {
        if (!pack.has(key)) {
          push(fixture, `resolves:${key}`, false, "key missing from pack");
          continue;
        }
        const locator = await resolver.tryResolveLocator(key);
        push(
          fixture,
          `resolves:${key}`,
          locator !== null,
          locator
            ? (resolver.lastMatchedStrategy(key) ?? undefined)
            : "no strategy matched"
        );
      }
      for (const key of exp.absent ?? []) {
        if (!pack.has(key)) continue;
        const locator = await resolver.tryResolveLocator(key);
        push(fixture, `absent:${key}`, locator === null);
      }
      if (exp.probeOk !== undefined) {
        const result = await probe(page, resolver, pack, target.probeInput);
        push(
          fixture,
          "probe",
          result.ok === exp.probeOk,
          result.ok ? "ok" : result.checks.filter((c) => !c.ok).map((c) => c.key).join(",")
        );
      }
      if (exp.completes !== undefined) {
        try {
          await awaitCompletion(page, resolver, {
            stabilityMs: 150,
            pollIntervalMs: 25,
            timeoutMs: 900,
            ...opts.completion,
          });
          push(fixture, "completion", exp.completes === true);
        } catch (err) {
          push(
            fixture,
            "completion",
            exp.completes === false && err instanceof CompletionTimeout,
            err instanceof Error ? err.message : String(err)
          );
        }
      }
      if (exp.bannerKinds) {
        if (!pack.has("banner")) {
          push(fixture, "banner", false, "pack lacks banner key");
        } else {
          const classifier = createBannerClassifier(target.banners);
          const bannerLoc = await resolver.tryResolveLocator("banner");
          const kinds = bannerLoc
            ? (await Promise.all((await bannerLoc.all()).map((el) => el.innerText()))).map(
                (t) => classifier.classify(t)?.kind ?? null
              )
            : [];
          for (const kind of exp.bannerKinds) {
            push(fixture, `banner:${kind}`, kinds.includes(kind), kinds.join(","));
          }
        }
      }
      await page.close();
    }
  } finally {
    if (ownBrowser) await ownBrowser.close();
  }

  const failures = checks.filter((c) => !c.ok);
  const report: ConformanceReport = { ok: failures.length === 0, checks, failures };
  if (failures.length > 0) throw new ConformanceError(report);
  return report;
}
