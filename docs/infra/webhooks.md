# Inbound webhook triggers

Native inbound webhook support lets external systems wake up a specific bot in the Allternit platform. Each trigger exposes a public URL and, on every verified POST, creates a Rails ticket assigned to the target bot.

## Lifecycle

1. A user creates a trigger in **Settings › Infrastructure › Webhooks** (or from a bot's Home view).
2. The trigger is stored in `webhook_triggers` and bound to an organization and a target bot.
3. The platform returns the trigger id; the public URL is `{public_origin}/webhooks/inbound/{id}`.
4. External systems POST JSON payloads to that URL with an `X-Webhook-Signature` header.
5. The platform verifies the HMAC-SHA256 signature, creates a Rails ticket assigned to the bot, and records the delivery in `webhook_trigger_deliveries`.

## API

### Protected CRUD

All routes require an authenticated organization member.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/webhook-triggers` | List triggers for the org |
| POST | `/api/v1/webhook-triggers` | Create a trigger |
| GET | `/api/v1/webhook-triggers/:id` | Get a trigger |
| PATCH | `/api/v1/webhook-triggers/:id` | Update name, target bot, or active state |
| DELETE | `/api/v1/webhook-triggers/:id` | Delete a trigger |
| GET | `/api/v1/webhook-triggers/:id/deliveries` | Recent delivery attempts |

### Public receiver

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhooks/inbound/:id` | Receive a signed webhook |

The receiver returns:

- `202 Accepted` with `{ "ok": true }` when the ticket is created.
- `202 Accepted` with `{ "ok": false, "ticket_error": "..." }` if verification passed but ticket creation failed.
- `401 Unauthorized` if the signature is missing or invalid.
- `404 Not Found` if the trigger does not exist.
- `503 Service Unavailable` if the trigger is disabled.

## Signature verification

The sender must compute HMAC-SHA256 over the raw request body, keyed by the trigger secret, and send the hex digest in the `X-Webhook-Signature` header.

Example (Node.js):

```js
const crypto = require('crypto');

const signature = crypto
  .createHmac('sha256', triggerSecret)
  .update(body)
  .digest('hex');

fetch(triggerUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Event': 'issue.opened',
  },
  body,
});
```

## Rails ticket

A verified delivery creates a ticket with:

- `kind`: `task`
- `priority`: `P1`
- `assignee`: the trigger's `target_bot_id`
- `title`: `Inbound webhook: {trigger.name}`
- `description`: event name, target bot, and full payload
- `labels`: `["webhook", "{event}"]`
- `external_ref`: the trigger id

The bot can then pick up the ticket through the normal Rails ticket flow.

## Database schema

See migration `cmd/allternit-api/migrations/V88__webhook_triggers.sql`.

## Frontend surfaces

- **Settings › Infrastructure › Webhooks**: create, edit, delete, and copy trigger URLs; view delivery logs.
- **Bot Home view**: shows how many triggers target the current bot and links to webhook settings.
