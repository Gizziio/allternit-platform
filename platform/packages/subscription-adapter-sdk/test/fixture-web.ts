import type { CapabilityId, ProviderId } from "@allternit/subscription-fabric-contracts";
import type { DeclarativeChatConfig } from "../src/index";
import { fixtureHtml } from "./helpers";

// §A3.3 proof — the fixture-web adapter is pure config; the Phase 1 pack plus
// the keys the declarative driver needs (banner / challenge / capability entry).
export const FIXTURE_WEB_EXTRA_SELECTORS = `
banner:
  critical: false
  strategies:
    - { css: ".fw-banner" }
challenge:
  critical: false
  strategies:
    - { testid: fw-challenge }
capability:chat:
  critical: false
  strategies:
    - { testid: fw-composer }
`;

export function fixtureWebConfig(
  overrides: Partial<DeclarativeChatConfig> = {}
): DeclarativeChatConfig {
  return {
    manifest: {
      adapter_id: "fixture-web",
      adapter_version: "0.1.0",
      provider: "fixture-web" as ProviderId,
      interface: "ui_bridge_web",
      origins: ["https://fixture-web.test"],
      auth: {
        login_url: "https://fixture-web.test/login",
        logged_in_probe: "logged_in_probe",
      },
      plans: [{ plan_id: "free", label: "Free" }],
      capabilities: [
        {
          id: "chat.create" as CapabilityId,
          min_capability_version: 1,
          plans: ["free"],
          pool_id: "fixture-free-pool",
          detachable: false,
          export_formats: [],
          status: "stable",
        },
      ],
      pacing: {
        min_action_gap_ms: [1, 2],
        min_task_gap_s: 0,
        max_tasks_per_hour: 1000,
        max_tasks_per_day: 5000,
      },
      selectors_version: "v1",
    },
    selectorsYaml: fixtureHtml("selectors.v1.yaml") + FIXTURE_WEB_EXTRA_SELECTORS,
    threadUrlPattern: /^https:\/\/fixture-web\.test\/c\/([\w-]+)/,
    banners: [
      { kind: "limit_banner", pattern: /approaching your (usage )?limit/i },
      { kind: "limit_banner", pattern: /limit reached/i },
    ],
    criticalKeys: ["composer", "send_button", "logged_in_probe"],
    sampleThreadUrl: "https://fixture-web.test/c/fw-thread-1",
    sampleThreadId: "fw-thread-1",
    submitFallbackEnter: true,
    completion: { stabilityMs: 150, pollIntervalMs: 25, timeoutMs: 5000 },
    heartbeatIntervalMs: 200,
    stallTimeoutS: 5,
    ...overrides,
  };
}
