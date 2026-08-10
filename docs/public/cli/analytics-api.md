# Analytics API

The Analytics API lets organization admins query usage and activity data for their workspaces. It is intended for dashboards, billing reconciliation, compliance reporting, and capacity planning.

## When to use the Analytics API

Use the Analytics API when you need:

- **Aggregated usage metrics** across users, sessions, or time buckets.
- **Cost and token reporting** for chargeback or budget tracking.
- **Activity feeds** for security review or compliance audit trails.
- **Programmatic access** to data that is also shown in the Allternit web console.

For real-time event streaming, use [webhooks](../api/webhooks.md) or the [session event stream](../api/sessions.md) instead.

## Administration boundaries

Analytics endpoints are scoped to the admin's organization. An organization owner or admin can query data for any workspace in their organization. Workspace members without the admin role receive a `403` response.

All endpoints live under `/api/v1/admin/analytics/` and require an admin-scoped bearer token or session cookie.

## Available endpoints

| Endpoint | Description |
|---|---|
| `GET /api/v1/admin/analytics/active-users` | Daily distinct active users over a date range. |
| `GET /api/v1/admin/analytics/token-usage` | Prompt, completion, reasoning, and cached token usage over time. |
| `GET /api/v1/admin/analytics/request-volume` | Request counts with status breakdown (`ok`, `error`, `budget_exceeded`, `rate_limited`, `dlp_blocked`). |
| `GET /api/v1/admin/analytics/cost-over-time` | Estimated cost by time bucket. |
| `GET /api/v1/admin/analytics/per-user-cost` | Cost and request counts aggregated per user. |
| `GET /api/v1/admin/analytics/artifact-activity` | Artifact and section creation counts over time. |
| `GET /api/v1/admin/analytics/chat-project-usage` | Project/session activity for organization members. |
| `GET /api/v1/admin/analytics/connector-usage` | Per-connector connection counts with active/error breakdown. |
| `GET /api/v1/admin/analytics/plugin-usage` | Plugin install and action event aggregates. |
| `GET /api/v1/admin/analytics/skill-usage` | Skill install and invocation aggregates. |
| `POST /api/analytics/gizzi-code/events` | Ingest turn/session telemetry from `gizzi-code` clients. |
| `GET /api/admin/analytics/gizzi-code/usage` | Query aggregated `gizzi-code` usage buckets. |

## Query parameters

Most endpoints accept:

- `start_date` — ISO 8601 date/time (inclusive).
- `end_date` — ISO 8601 date/time (inclusive).
- `granularity` — `hour`, `day`, `week`, or `month`.
- `workspace_id` — filter to a single workspace.
- `user_id` — filter to a single user.

Example:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://api.allternit.com/api/v1/admin/analytics/token-usage?start_date=2026-08-01&end_date=2026-08-31&granularity=day"
```

## Response format

```json
{
  "buckets": [
    {
      "bucket": "2026-08-01T00:00:00Z",
      "prompt_tokens": 120000,
      "completion_tokens": 45000,
      "reasoning_tokens": 12000,
      "cached_tokens": 80000
    }
  ],
  "total_unique_users": 12
}
```

## Retention

Analytics aggregates are retained according to the organization's data retention policy. Raw event data may be retained for a shorter period than aggregated buckets. See [API and data retention](../admin/data-retention.md) for configuration.

## Related pages

- [Metrics](./metrics.md)
- [Observability and telemetry](./observability.md)
- [Admin API overview](../admin/index.md)
