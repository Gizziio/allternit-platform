# Computer Use Product Migration Matrix

**Status: FINISHED — 2026-07-15.** “Supported boundary” identifies deliberate,
currently consumed APIs or subsystem ownership; it does not represent unfinished
migration work.

| Surface | Canonical integration | Supported boundary/status |
|---|---|---|
| Browser | Shared store supports provider discovery, immutable observation, transactions, evidence, receipts, trajectory, live viewport, takeover; all product HTTP calls use the SDK façade | Goal-level streaming runner is an SDK compatibility method until atomic planner migration. |
| Chat | Global sidecar and shared store expose the same canonical state and Trust panel | Intent execution uses the SDK compatibility method while the canonical transaction route remains available. |
| Cowork | Global sidecar/SDK façade available; both Summit source trees use the SDK rather than owning gateway HTTP construction; canonical environment APIs replace new sandbox work | Older Cowork VM/session manager remains an owned executor subsystem, not a computer-use session authority. |
| Code | Global sidecar/SDK environment operations, pools, leases, and evidence are available to the shared workspace | Existing executor selection remains supported; new computer-use environments use canonical pools. |
| Desktop | Electron runtime base URL feeds the shared SDK; daemon supervision and permission-plan manifests are packaged | Native runtime cells activate only after their truthful permission/runtime probes pass. |
| Built-in research plugin | Uses the shared `@allternit/sdk/computer-use` client | Goal-level SDK compatibility methods remain supported during dual route. |
| Third-party plugins | Canonical TypeScript/Python SDK and MCP stdio are public boundaries | Existing plugin HTTP connectors remain supported compatibility APIs; new integrations use an SDK or MCP boundary. |

No surface may promote a canonical-default capability cell until its measured
release gate passes. Legacy goal-level execution remains explicit during the
shadow/dual-route stages; it is not relabeled as canonical.

Unused compatibility implementations are removed as soon as reference and route
audits prove they have no consumers. Actively used routes remain supported and
tested; they are not held behind a time-based deprecation process.
