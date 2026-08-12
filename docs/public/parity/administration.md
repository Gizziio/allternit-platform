# Administration

ChatGPT administration centralizes workspace membership, policy, identity, auditing, and spend controls in a hosted tenant. Allternit provides equivalent controls through its web console, protected `/api/v1/admin/*` API, and `allternit admin` CLI, while allowing the control plane and data plane to run in the customer's cloud.

## Administrative surfaces

| Concern | Allternit capability |
| --- | --- |
| Workspace isolation | Workspace CRUD, membership, and workspace-scoped resources |
| Authorization | Organization roles, RBAC roles/groups, permission profiles |
| Identity lifecycle | OAuth, service accounts, access tokens, and SCIM routes |
| Agent policy | Sandbox modes, approval rules, inference hooks, tool/network restrictions |
| Secrets | Encrypted Allternit Vault and optional external KMS keys |
| Observability | Audit feed, analytics API, webhooks, and OpenTelemetry |
| Cost governance | Gateway-key budgets, tenant budgets, organization spend caps, rate limits |

Organization owner/admin checks protect administrative endpoints. More privileged approval actions can be further restricted by deployment policy.

## CLI workflow

```bash
export ALLTERNIT_API_URL=https://allternit.example.com/api/v1
export ALLTERNIT_TOKEN="$ORG_ADMIN_TOKEN"

allternit admin workspaces list
allternit admin workspaces create --name "Engineering" --slug eng
allternit admin keys create --name ci-runner \
  --monthly-budget-cents 50000 --rate-limit-rpm 60
allternit admin budgets set --monthly-cents 100000
allternit --json admin keys list
```

## API workflow

The following example reads the active organization's spend-limit record:

```bash
curl -s "$ALLTERNIT_API_URL/admin/spend-limits" \
  -H "Authorization: Bearer $ALLTERNIT_TOKEN"
```

Workspace, RBAC, audit, service-account, external-key, and inference-policy routes are likewise exposed beneath `/api/v1`. Use a scoped administrator token, log changes, and rotate it through the approved secret store.

## Managed endpoint configuration

Administrators can distribute mandatory settings separately from user preferences. A representative policy is:

```toml
forced_login_method = "oauth"
forced_workspace_id = "00000000-0000-0000-0000-000000000000"

[sandbox]
mode = "workspace-write"
allow_network = false

[approval_policy]
mode = "granular"

[[approval_policy.rules]]
permission = "bash"
pattern = "*"
action = "ask"
```

Managed configuration wins over user and project configuration. Self-hosted operators are responsible for distributing these files, backing up the control-plane database, configuring TLS and identity providers, and integrating audit retention with their compliance systems.

## SaaS-specific differences

ChatGPT plan purchase, seat billing, and OpenAI support escalation are **not applicable / roadmap** for the self-host/BYOC deployment model. Allternit instead governs access and usage at the organization, workspace, key, session, and upstream-provider layers. Provider invoices and infrastructure quotas remain with the customer's selected cloud/model vendors.

## See also

- [Work admin FAQ](../admin/work-admin-faq.md)
- [RBAC](../admin/rbac.md)
- [Workspaces](../admin/workspaces.md)
- [`allternit admin`](../cli/admin.md)
- [Security model](../security/security-model.md)

