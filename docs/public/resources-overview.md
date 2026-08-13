# Resources overview

This page indexes every Allternit resource type, where it lives, and how to manage it.

## Resource types

### API & platform resources

| Resource | Path / prefix | Lifecycle | Typical use |
|----------|---------------|-----------|-------------|
| API keys | `/api/v1/admin/keys` | Org-scoped | Programmatic access to the platform |
| Virtual keys | `/api/v1/virtual-keys` | Workspace-scoped | Fine-grained spend and rate limits |
| Batches | `/v1/batches` | Job-scoped | Offline batch inference |
| Files | `/v1/files` | File-scoped | Training data, attachments, citations |
| Connectors | `/api/v1/connectors` | Org-scoped | OAuth / SaaS integrations |
| Vault credentials | `/beta/vaults/:id/credentials` | Vault-scoped | Encrypted secrets for tools |

### Agent & session resources

| Resource | Path / prefix | Lifecycle | Typical use |
|----------|---------------|-----------|-------------|
| Sessions | `/beta/sessions` | User-scoped | Long-running agent runs |
| Threads | `/beta/sessions/:id/threads` | Session-scoped | Conversation branches |
| Memory stores | `/beta/memory-stores` | Org-scoped | Persistent vector/search memory |
| Session memory | `/api/v1/memory/session` | Session-scoped | SQLite-backed working memory |
| Resources | `/beta/sessions/:id/resources` | Session-scoped | GitHub tokens, API keys, vault credentials |

### Tool & skill resources

| Resource | Path / prefix | Lifecycle | Typical use |
|----------|---------------|-----------|-------------|
| Tool registry | `/api/v1/tools` | Org / public | Native and custom tools |
| Skills | `/api/v1/skills` | Org-scoped | Reusable prompt/tool bundles |
| MCP tunnels | `/api/v1/admin/mcp-tunnels` | Org-scoped | External MCP server attachments |
| Plugins | `/api/v1/plugins` | Org-scoped | IDE / editor extensions |

### Admin & governance resources

| Resource | Path / prefix | Lifecycle | Typical use |
|----------|---------------|-----------|-------------|
| Workspaces | `/api/v1/admin/workspaces` | Org-scoped | Multi-team isolation |
| RBAC roles | `/api/v1/admin/rbac_roles` | Org-scoped | Custom roles |
| RBAC groups | `/api/v1/admin/rbac_groups` | Org-scoped | Group-based access |
| External keys | `/api/v1/admin/external-keys` | Org-scoped | BYO KMS / CMEK |
| Audit logs | `/admin/audit` | Org-scoped | Access transparency feed |
| SCIM users | `/scim/v2/Users` | Org-scoped | Enterprise user provisioning |
| SCIM groups | `/scim/v2/Groups` | Org-scoped | Enterprise group provisioning |

## Resource addressing

All resources follow a hierarchical path convention:

```
/{api_version}/{scope}/{resource}/{id}/{sub_resource}
```

Examples:

```
/beta/sessions/sess_123/threads/th_456
/beta/vaults/vault_789/credentials/cred_abc
/api/v1/admin/workspaces/ws_1/members
```

## Resource tags

Resources can carry a `tags` map for cost allocation and discovery:

```json
{
  "tags": {
    "team": "platform",
    "env": "production",
    "cost_center": "eng-ai"
  }
}
```

Tags propagate to usage exports and analytics filters.

## Resource limits

Default per-organization limits are enforced by the control plane. See the [API reference](./api/reference.md) for current defaults. Requests that exceed a limit return `429 Too Many Requests` with a `Retry-After` header.

## Next steps

- [API reference](./api/reference.md)
- [CLI reference](./gizzi/index.md)
