# Go-to-Market Positioning

> Allternit is the open, self-hostable alternative to Anthropic, OpenAI, and Kimi managed agents.

## Positioning statement

Allternit gives engineering teams the agentic infrastructure that managed vendors promise — multi-step reasoning, tool use, memory, orchestration, and enterprise governance — while keeping the backend, the data, and the model routing under the customer's control.

## Capability comparison

| Competitor feature | Allternit equivalent | Notes |
|--------------------|----------------------|-------|
| Anthropic Claude Computer Use | Browser automation + computer-use gateway + VM driver | Powered by Playwright and local/remote VM execution |
| OpenAI GPTs / Assistants | Agent registry + skills + agent runtime in `cmd/allternit-api` | Source-available, deployable locally |
| OpenAI Code Interpreter | Sandbox code execution + VM session routes | Local or Firecracker/Apple VF isolation |
| Kimi long-context agent sessions | gizzi-code multi-turn agent harness | Runs locally or paired with the platform |
| Managed vector memory | `allternit-memory` service + memory routes | Self-hostable SQLite/Postgres backend |
| Managed OAuth / secrets | `AllternitVault` + `/api/v1/beta/vaults` | Encrypted at rest, BYO KMS ready |
| Vendor IAM + SCIM | Clerk + `/api/v1/scim/v2` provisioning | Use your own Clerk tenant or self-hosted mode |
| Vendor audit logs | `/api/v1/admin/audit` + `audit_events` | Append-only, cursor-paginated |
| Compliance exports | `/api/v1/admin/compliance` | Export/delete requests for chats, projects, artifacts |
| Managed agent hosting | `allternit-cloud-api` on a VPS (production: Contabo, `api.allternit.com`) | Your cloud account, your runtime lifecycle |
| BYOK / CMEK | `/api/v1/admin/external-keys` | AWS KMS ARN validation, Azure/GCP scaffolded |

## Self-hosting and BYOC messaging

- **No vendor lock-in.** The full stack is in one repo: API, cloud backend, platform UI, desktop shell, iOS app, and agent runtime.
- **Bring your own cloud.** Run the cloud backend on Fly.io, Railway, Hetzner, or any VPS with the included Docker image.
- **Bring your own keys.** AWS KMS keys are validated locally; Azure and GCP placeholders are ready for provider-side verification.
- **Bring your own models.** The LLM gateway supports multiple providers behind an OpenAI-compatible `/v1` surface.
- **Bring your own identity.** Clerk is the default, but self-hosted mode removes the external dependency entirely.

## Target audiences

| Audience | Pain point | Allternit answer |
|----------|------------|------------------|
| Security-conscious enterprises | Cannot send source code or secrets to managed agents | Local-first SQLite + BYO KMS + self-hosted backend |
| AI platform teams | Need white-label agent runtime | Source-available API and UI, packaged desktop + mobile |
| Regulated industries | Need audit trails and compliance deletion | `/admin/audit`, `/admin/compliance`, append-only logs |
| Cost-conscious startups | Managed agent APIs scale unpredictably | Self-hosted flat infrastructure, bring your own API keys |

## Key differentiators

1. **Open backend.** The agent runtime, memory, vault, and compliance APIs ship as source, not as opaque endpoints.
2. **Local-first default.** `allternit-api` runs on the device with SQLite; cloud is optional.
3. **True BYOC.** External KMS key management is a first-class admin API, not a support ticket.
4. **Unified surfaces.** Web, desktop, iOS, and the gizzi-code CLI share the same backend contracts.

## Call to action

Start with `cargo run -p allternit-api`, create an organization, and register your first external KMS key. When you need centralized tenancy, promote the same codebase to `allternit-cloud-api` on your own VPS (production runs on Contabo as `api.allternit.com`; see `docs/Operations/CLOUD_API_VPS_DEPLOY.md`).
