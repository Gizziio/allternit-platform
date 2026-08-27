# Self-Hosting and BYOC

Allternit is designed to run under your control. The same codebase ships two binaries:

| Binary | Use case | Default port | Database |
|--------|----------|--------------|----------|
| `allternit-api` | Local-first backend per device | `8013` | SQLite |
| `allternit-cloud-api` | Centrally hosted cloud backend | `8080` / `3001` | SQLite or PostgreSQL |

Both support Clerk for identity and can be run on your own infrastructure, under your own cloud accounts, with your own KMS keys.

## Local-first SQLite backend (`cmd/allternit-api`)

`allternit-api` is the backend the desktop and mobile surfaces talk to. It stores state in a local SQLite database and is meant to be spawned per device.

### Build

```bash
cargo build --release -p allternit-api
```

### Run

```bash
export ALLTERNIT_API_PORT=8013
export ALLTERNIT_DATA_DIR="${HOME}/.local/share/allternit"
./target/release/allternit-api
```

The server binds to `0.0.0.0:8013` by default and initializes `allternit.db` under `ALLTERNIT_DATA_DIR`.

### Clerk identity setup

The API verifies Clerk JWTs against a JWKS endpoint. Configure it through company config or environment:

```json
{
  "clerkPublishableKey": "pk_test_...",
  "clerkJwksUrl": "https://clerk.platform.allternit.com/.well-known/jwks.json",
  "clerkIssuer": "https://clerk.platform.allternit.com",
  "clerkWebhookSecret": "whsec_..."
}
```

Place the file at `~/.allternit/company.json` or set overrides:

```bash
export CLERK_JWKS_URL="https://clerk.platform.allternit.com/.well-known/jwks.json"
export CLERK_ISSUER="https://clerk.platform.allternit.com"
```

For fully offline/self-hosted deployments, set `selfHosted: true` in company config to skip Clerk JWT verification and trust the desktop bootstrap headers.

### Environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `ALLTERNIT_API_PORT` | API listen port | `8013` |
| `ALLTERNIT_DATA_DIR` | SQLite and runtime data directory | `~/.local/share/allternit` |
| `ALLTERNIT_ENCRYPTION_KEY` | At-rest encryption key | generated on first use |
| `CLERK_JWKS_URL` | Clerk JWKS endpoint | baked into company config |
| `CLERK_ISSUER` | Expected JWT issuer | baked into company config |

## Cloud-hosted `cmd/allternit-cloud-api` on Fly.io

`allternit-cloud-api` is the centrally hosted service. It adds multi-tenant auth (`users.tenant_id`, `api_tokens`, `user_sessions`, `audit_log`), device-token verification, hosted-runtime management, and Clerk webhook sync.

### Build and deploy

```bash
# Local build
cargo build --release -p allternit-cloud-api

# Fly.io deploy
fly deploy --config fly.toml
```

The included `fly.toml` uses `cmd/allternit-cloud-api/Dockerfile` and mounts persistent storage at `/data`.

### Required Fly.io secrets

```bash
fly secrets set FLY_API_TOKEN="..."
fly secrets set ALLTERNIT_CREDENTIALS_KEY="..."
```

### Configuration

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_URL` | Database connection | `sqlite:///data/api.db` |
| `BIND_ADDR` | Listen address | `0.0.0.0:8080` |
| `RATE_LIMIT_RPM` | General rate limit | `60` |
| `PUBLIC_RATE_LIMIT_RPM` | Stricter limit for pairing/relay | `30` |
| `HOSTED_RUNTIME_IDLE_TIMEOUT_MINUTES` | Idle runtime shutdown | `15` |
| `FLY_ORG_SLUG` | Fly organization | `allternit` |
| `ALLTERNIT_CREDENTIALS_KEY` | Encryption key for provider tokens | required in production |

## Why Allternit is the open alternative

Managed agent platforms lock your data, your model routing, and your agent logic inside a vendor's cloud. Allternit inverts that:

- **Own your backend.** Run `allternit-api` on a laptop, a VPS, or in your own cloud account.
- **Own your keys.** Register your own AWS KMS, Azure, or GCP keys via `/api/v1/admin/external-keys`.
- **Own your identity.** Use Clerk with your own tenant, or disable Clerk entirely for air-gapped deployments.
- **Own your data.** SQLite lives on your filesystem by default; the cloud API can point at your own database.
- **Own your agents.** Agent skills, tools, and runtime logic are source-available in the monorepo, not a black-box API.

## Reference architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web/Desktop   │────▶│  allternit-api  │────▶│   SQLite (local)│
│   iOS surface   │     │  (per device)   │     │   KMS key (BYO) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │ allternit-cloud-│
                        │ api (optional)  │
                        │   Fly.io / VPS  │
                        └─────────────────┘
```

## Next steps

1. Build `allternit-api` and verify it starts on `http://127.0.0.1:8013`.
2. Configure Clerk or enable self-hosted mode.
3. Create an organization and admin workspace.
4. Register an external KMS key and validate it.
5. Deploy `allternit-cloud-api` to Fly.io if you need centralized tenancy.
