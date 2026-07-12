# Cloudflare Deployment

OpenConnector supports Cloudflare Workers as a metadata and runtime-state deployment target. The
Worker runtime uses:

- Workers for the HTTP runtime.
- D1 for connections, OAuth config/state, runtime tokens, and run logs.
- R2 for temporary transit files.
- Static Assets for the Web Console.

## Prerequisites

- A Cloudflare account with Workers, D1, and R2 access.
- Wrangler available through `npx wrangler`.
- Node.js 22 or newer.

## Create Local Config

Install dependencies and copy the example Wrangler config:

```bash
npm install
cp wrangler.example.jsonc wrangler.local.jsonc
```

`wrangler.local.jsonc` is ignored by git. Fill it with your Cloudflare resource IDs before remote
deployment.

## Log In With Wrangler

Skip this step if you are already logged in:

```bash
npx wrangler login
```

## Create Cloudflare Resources

Create the D1 database and R2 bucket:

```bash
npx wrangler d1 create open-connector
npx wrangler r2 bucket create open-connector-transit-files
```

Put the returned D1 `database_id` into `wrangler.local.jsonc`. All Wrangler commands that read the
Worker config should use `--config wrangler.local.jsonc`.

## Remote Deployment

Apply migrations remotely:

```bash
npx wrangler d1 migrations apply open-connector --remote --config wrangler.local.jsonc
```

Set required secrets with Wrangler:

```bash
npx wrangler secret put OOMOL_CONNECT_ADMIN_TOKEN --config wrangler.local.jsonc
npx wrangler secret put OOMOL_CONNECT_ENCRYPTION_KEY --config wrangler.local.jsonc
```

Deploy:

```bash
npm run deploy:cloudflare
```

`npm run deploy:cloudflare` generates the catalog, builds the Web Console, copies catalog assets,
and runs `wrangler deploy --config wrangler.local.jsonc`. The copied `wrangler.local.jsonc` already
maps the built Web Console assets to the `ASSETS` binding used by the Worker.

## Local Worker Preview

Use this optional flow when you want to test the Worker runtime locally:

```bash
npx wrangler d1 migrations apply open-connector --local --config wrangler.local.jsonc
npm run dev:cloudflare
```

`npm run dev:cloudflare` generates the catalog, builds the Web Console, copies catalog assets, and
runs `wrangler dev --config wrangler.local.jsonc`. The local Worker preview uses the same generated
provider Action executor registry as the Node runtime.

## Runtime Behavior

The Cloudflare runtime serves catalog metadata, `/api` and `/v1` metadata endpoints, connections,
runtime tokens, OAuth config/state, R2-backed transit files, and the generated provider Action
executor registry.

Configure an R2 lifecycle rule for the transit bucket if you want unread expired transit files
cleaned up automatically.

## Configuration

Cloudflare uses the same environment variable names for origin, auth tokens, action policy, transit
file limits, and credential encryption. `PORT`, `HOST`, and `OOMOL_CONNECT_DATA_DIR` are local
Node-only settings on Workers.

See [configuration.md](configuration.md) for all runtime environment variables.
