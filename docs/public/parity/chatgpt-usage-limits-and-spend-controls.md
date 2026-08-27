# Usage limits and spend controls

ChatGPT usage limits and spend controls determine when hosted-plan message allowances, credit pools, and workspace caps apply. In Allternit, the deciding factor is the execution and credential path: platform gateway, direct BYOK provider access, self-hosted infrastructure, or a managed session.

## Know when these controls apply

| Execution path | Controls that apply |
| --- | --- |
| Allternit virtual key through `/v1` | Per-key request rate, key monthly budget, tenant hard budget, organization spend cap, and model allowlist; the tightest applicable cap wins. |
| OAuth workspace session | Workspace/RBAC policy, organization limits, retention policy, and any platform gateway limits used by the session. |
| Direct BYOK provider profile | Provider account quota and invoice; Allternit local `--max-budget-usd`, permissions, and session budgets only where explicitly configured. |
| Self-hosted/local model | Local infrastructure capacity and operator-defined Allternit limits; no ChatGPT subscription allowance applies. |
| Managed beta session | Independent token, turn, and tool-call budgets attached to that session. |

ChatGPT Plus, Pro, Business, Enterprise, and credit-pool message limits are **not applicable / roadmap**: Allternit does not consume a ChatGPT plan allowance when it calls a BYOK or self-hosted model. The upstream provider's commercial terms still apply.

## Inspect effective gateway limits

```bash
curl -s "$ALLTERNIT_API_URL/rate-limits" \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY"
```

Example response:

```json
{
  "object": "rate_limits",
  "requests_remaining": 598,
  "requests_limit": 600,
  "tokens_remaining": 987000,
  "tokens_limit": 1000000,
  "reset_at": "2026-08-09T09:01:00Z"
}
```

Request-rate exhaustion returns HTTP `429` with `allternit.rate_limited` and a `Retry-After` header. A hard monthly cap returns `allternit.budget_exceeded`; raising or resetting the relevant monthly cap is an administrative decision, so blind retries are inappropriate.

## Configure limits

Set a per-key budget and request rate:

```bash
allternit admin keys create --name ci \
  --monthly-budget-cents 2500 \
  --rate-limit-rpm 30
```

Set a hard tenant monthly budget:

```bash
allternit admin budgets set --monthly-cents 10000
```

Bound one local unattended run:

```bash
gizzi exec --max-budget-usd 1.50 "Analyze the failing test suite"
```

Bound one managed session independently of dollars:

```bash
curl -s -X POST "$ALLTERNIT_CONTROL_URL/api/v1/beta/sessions" \
  -H "Authorization: Bearer $ALLTERNIT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "bounded-ci-run",
    "budget": {
      "max_tokens": 20000,
      "max_turns": 20,
      "max_tool_calls": 50
    }
  }'
```

These layers are cumulative. For example, a session with tokens remaining can still be stopped by a gateway key or organization spend cap.

## Monitor and respond

Use the Analytics API for token, request, status, and estimated-cost reporting. Managed sessions emit `budget_updated` and `budget_exceeded` events. Administrators can inspect `/api/v1/admin/spend-limits` and use the increase-request workflow when the organization permits exceptions.

Soft tenant budgets report overage without blocking; hard gateway and organization caps block requests. Choose hard caps for untrusted automation and soft caps for forecasting where continuity matters more than enforcement.

## See also

- [API rate-limit snapshot](../api/reference.md#get-v1rate-limits)
- [Token, turn, and tool budgets](../guides/token-turn-tool-budgets.md)
- [Analytics API](../cli/analytics-api.md)
- [`allternit admin`](../cli/admin.md)

