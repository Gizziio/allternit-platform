# `allternit admin`

The `allternit admin` command group manages platform resources through the
Allternit API. All subcommands inherit the global `--api-url` and `--token`
options.

```bash
allternit --api-url https://api.example.com --token $ALLTERNIT_TOKEN admin workspaces list
```

Default values are read from `ALLTERNIT_API_URL` and `ALLTERNIT_TOKEN` when the
flags are omitted.

## Workspaces

```bash
# List workspaces
allternit admin workspaces list

# Create a workspace
allternit admin workspaces create --name "Engineering" --slug eng

# Update a workspace
allternit admin workspaces update ws_123 --name "Engineering Team"

# Delete a workspace
allternit admin workspaces delete ws_123
```

| Command  | Method | Endpoint                            | Body / notes                              |
| -------- | ------ | ----------------------------------- | ----------------------------------------- |
| `list`   | GET    | `/api/v1/workspaces`                | —                                         |
| `create` | POST   | `/api/v1/workspaces`                | `{ name, slug?, description? }`           |
| `update` | PUT    | `/api/v1/workspaces/<id>`           | `{ name?, description? }`                 |
| `delete` | DELETE | `/api/v1/workspaces/<id>`           | URL-encoded id                            |

## Gateway keys

```bash
# List keys
allternit admin keys list

# Create a key with a budget
allternit admin keys create --name "ci-runner" --monthly-budget-cents 50000 --rate-limit-rpm 60

# Update allowed models
allternit admin keys update key_123 --allowed-models "anthropic/claude-sonnet-4,openai/gpt-5"

# Revoke a key
allternit admin keys revoke key_123

# Delete a key
allternit admin keys delete key_123
```

| Command   | Method | Endpoint                          | Body / notes                                              |
| --------- | ------ | --------------------------------- | --------------------------------------------------------- |
| `list`    | GET    | `/api/v1/gateway/keys`            | —                                                         |
| `create`  | POST   | `/api/v1/gateway/keys`            | `{ name?, monthly_budget_cents?, rate_limit_rpm? }`       |
| `update`  | PATCH  | `/api/v1/gateway/keys/<id>`       | `{ name?, monthly_budget_cents?, rate_limit_rpm?, allowed_models? }` |
| `revoke`  | DELETE | `/api/v1/gateway/keys/<id>`       | Same as `delete`                                          |
| `delete`  | DELETE | `/api/v1/gateway/keys/<id>`       | URL-encoded id                                            |

## Budgets

```bash
# View current budget
allternit admin budgets list

# Set a hard monthly budget of $100
allternit admin budgets set --monthly-cents 10000

# Set a soft budget (reports overages without blocking)
allternit admin budgets set --monthly-cents 10000 --soft

# Remove budget enforcement
allternit admin budgets reset
```

| Command  | Method | Endpoint                          | Body / notes                                              |
| -------- | ------ | --------------------------------- | --------------------------------------------------------- |
| `list`   | GET    | `/api/v1/gateway/budgets`         | —                                                         |
| `set`    | PUT    | `/api/v1/gateway/budgets`         | `{ budget_cents, hard: !soft }`                           |
| `reset`  | PUT    | `/api/v1/gateway/budgets`         | `{ budget_cents: 0, hard: false }`                        |

## MCP tunnels

MCP tunnels are proxy endpoints that expose remote MCP servers to the platform.

```bash
# List tunnels
allternit admin mcp-tunnels list

# Create a tunnel
allternit admin mcp-tunnels create --name "staging-db"

# Rotate tunnel credentials
allternit admin mcp-tunnels rotate --id tun_123

# Delete a tunnel
allternit admin mcp-tunnels delete --id tun_123
```

| Command  | Method | Endpoint                                  | Body / notes           |
| -------- | ------ | ----------------------------------------- | ---------------------- |
| `list`   | GET    | `/api/v1/mcp-tunnels`                     | —                      |
| `create` | POST   | `/api/v1/mcp-tunnels`                     | `{ name }`             |
| `rotate` | POST   | `/api/v1/mcp-tunnels/<id>/rotate`         | Empty body             |
| `delete` | DELETE | `/api/v1/mcp-tunnels/<id>`                | URL-encoded id         |

## Output format

Add `--json` to any command to emit machine-readable JSON:

```bash
allternit --json admin workspaces list
```

The JSON flag is read from the global options and passed to every admin
subcommand.
