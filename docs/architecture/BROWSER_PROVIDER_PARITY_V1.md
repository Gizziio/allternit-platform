# Browser Provider Parity v1

This matrix is a release gate for the unified Allternit Browser Agent. `extension-tab` is the existing-browser transport used by Platform, Desktop, and Gizzi; it is not a parallel agent.

| Capability | Local Playwright/CDP | Extension tab | Browser Use | Stagehand/Browserbase | Required parity behavior |
|---|---:|---:|---:|---:|---|
| Navigate | required | required | required | required | Validate initial and redirected URL policy. |
| Focused accessibility observation + refs | required | required | required | required | Same bounded `BrowserObservation` schema and stable action refs. |
| DOM observation | required | required | optional | required | Declare absence during negotiation; never silently return empty data. |
| Screenshot artifact | required | required | required | required | Artifact reference, redaction status, dimensions, media type. |
| Click/type/press/scroll/select/hover | required | required | required | required | Same `ActionIntent` lifecycle and verification. |
| Tabs | required | required | provider-declared | required | Explicit active tab and deterministic focus semantics. |
| Frames/OOPIF | required | required | provider-declared | required | Frame identity included in observations and target resolution. |
| Native dialogs | required | required | provider-declared | required | Pending dialog surfaced; policy or explicit response recorded. |
| Upload/download | required | required | provider-declared | required | Approval/policy check and artifact receipt. |
| Console/network diagnostics | required | extension-permission | optional | required | Details channel only; bounded and secret-redacted. |
| Pause/resume/cancel/takeover | required | required | required | required | One shared run state and execution lease. |
| Approval from any Allternit surface | required | required | required | required | Same approval ID; exactly-once resolution. |
| Record/replay | required | required | required | required | Semantic actions and artifact refs, not inline screenshots. |
| Skill candidate/promotion | required | required | required | required | One sanitizer/compiler/registry and human promotion gate. |
| Receipts | required | required | required | required | Same chained receipt schema across providers. |
| Private/LAN targets | required | required | forbidden by default | forbidden by default | Route local; revalidate redirects. |
| Persistent logged-in profile | provider-declared | required | provider-declared | provider-declared | Capability negotiated before task planning. |

## Cross-surface continuity cases

Every release must prove:

1. Start a run in Platform Web, execute in the extension, approve in Desktop, and view the same final receipt in all surfaces.
2. Start in the extension side panel, continue the same conversation in Platform, and preserve run/action sequence numbers.
3. Disconnect and reconnect the extension without duplicating an action or approval.
4. Transfer the execution lease between two authorized surfaces; reject stale-owner actions.
5. Compile a verified run into one skill, then retrieve and replay it from another surface/provider.

## Capability rule

Unsupported provider features must be declared by `ProviderCapabilities` before planning. A provider may supply a stronger implementation, but it may not weaken approval, redaction, verification, receipt, or skill-promotion semantics.
