# Work admin FAQ

This page answers common questions for organization owners and admins managing Allternit workspaces.

## Core administrative controls

Allternit provides role-based access control, workspace membership, spend limits, and audit logging through the admin API and web console.

### Can access be scoped by group, role, workspace, or capability?

Yes. Allternit supports:

- **Workspaces** — isolate projects, data, and agents.
- **RBAC roles** — define roles with granular permissions.
- **RBAC groups** — assign users to groups and map groups to roles.
- **Permission profiles** — control what agents can do on user devices.

### How can admins control access, permissions, and policies?

Admins can use:

- `/api/v1/admin/workspaces` to manage workspaces and members.
- `/api/v1/admin/rbac_roles` and `/api/v1/admin/rbac_groups` to define roles and memberships.
- `/api/v1/admin/spend-limits` to set budget caps.
- `/api/v1/admin/external-keys` for BYO KMS configuration.
- `/api/v1/admin/inference-hooks` to inject pre/post-inference policies.

## Usage and cost

### How does Allternit usage translate into spend over time?

The Analytics API aggregates token usage, request volume, and estimated cost by workspace, user, and time bucket. See [Analytics API](../cli/analytics-api.md).

### What usage limits, alerts, or caps are available?

- **Rate limits** — enforced per organization and workspace.
- **Spend limits** — hard caps with increase-request approval flows.
- **Budget events** — the gateway emits `budget_exceeded` events when a cap is hit.

### What usage data is available to admins or owners?

Admins can query active users, token usage, request volume, cost over time, per-user cost, plugin usage, skill usage, and artifact activity.

## Data, privacy, and compliance

### What data is stored, retained, or deleted?

Data retention is configured per organization. Allternit stores:

- Session transcripts and thread history (until deleted or retention expires).
- Tool execution logs and approval decisions.
- Audit events in the Access Transparency feed.
- Vault credentials encrypted with the configured key store.

See [API and data retention](./data-retention.md) for retention policy configuration.

### Are prompts, outputs, files, actions, or tool calls logged?

Yes. Audit logs capture administrative actions, tool approvals, and gateway events. Prompt and output content is not retained beyond the session retention window unless explicitly configured.

### How are access to data, systems, and user actions protected?

- End-to-end TLS for all API traffic.
- Encrypted credential storage via `AllternitVault`.
- RBAC and workspace isolation.
- Optional CMEK with AWS KMS, Azure Key Vault, or Google Cloud KMS.
- SCIM provisioning for identity-provider integration.

### How do runtime and network boundaries govern agent behavior?

Sandbox modes and approval policies enforce boundaries:

- `read-only`, `workspace-write`, or `danger-full-access` sandbox presets.
- Network allowlists and domain restrictions.
- Granular approval rules for tools, paths, and hosts.

### How does Allternit support enterprise privacy and data commitments?

Allternit is designed for self-hosting and BYOC (bring-your-own-cloud) deployments. Data residency controls, retention policies, and external key management help meet enterprise requirements.

## Incident and revocation controls

### How can admins stop access or activity?

- Revoke organization access tokens via `/api/v1/admin/access-tokens`.
- Remove users from workspaces or RBAC groups.
- Rotate or revoke service-account keys.
- Disable MCP tunnels or server tools.
- Revoke vault credentials.

### What high-impact actions are restricted or require review?

- Tool execution outside the active sandbox mode.
- Network requests to unallowed domains.
- File writes outside workspace roots.
- Use of high-privilege tools such as `bash` or `code_execution`.
- Budget increase requests.

## Observability

### Can unusual behavior, failures, or usage spikes be detected quickly?

Yes. The platform emits:

- Audit events to `/api/v1/admin/audit`.
- Webhooks for session and deployment lifecycle events.
- OpenTelemetry spans when enabled.
- Analytics aggregates for cost and usage anomalies.

## Recommended admin actions

For a new organization:

1. Configure workspaces and invite members.
2. Define RBAC roles and groups.
3. Set spend limits and rate limits.
4. Configure data retention and residency policies.
5. Set up audit logging and webhooks.
6. Enable external-key management if required.
7. Document approved sandbox and permission policies for end users.

## Additional resources for your teams

- [Admin API overview](./index.md)
- [Analytics API](../cli/analytics-api.md)
- [Agent approvals and security](../cli/agent-approvals-security.md)
- [Config and state locations](../cli/config-locations.md)
