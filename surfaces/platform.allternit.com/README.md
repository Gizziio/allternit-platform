# platform.allternit.com

The Allternit Platform cloud console — organization management, compute, billing, API keys, and docs.

## Run locally

```bash
cd surfaces/platform.allternit.com
cp .env.local.example .env.local
# edit .env.local and add your Clerk publishable key
pnpm install
pnpm dev
```

The dev server runs on http://localhost:3016.

## Environment variables

Create `.env.local`:

```bash
# Required for authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_... # or pk_live_...

# Optional
VITE_ALLTERNIT_GATEWAY_URL=https://api.allternit.com
VITE_ALLTERNIT_CLOUD_API_URL=https://allternit-cloud-api.fly.dev
VITE_DEV_AUTH_BYPASS=1                 # only in local dev; mocks a signed-in user when no Clerk key is present
```

## Build

```bash
pnpm build
```

Build output is written to `dist/` and served by Cloudflare Pages (`wrangler.toml` project name: `allternit-platform`).

## Typecheck

```bash
pnpm typecheck
```

## Project layout

- `src/clerkConfig.ts` – Clerk environment configuration.
- `src/lib/platform-auth-client.tsx` – Clerk provider and platform-shaped auth hooks.
- `src/lib/api-client.ts` – Minimal gateway API client with bearer-token sync.
- `src/lib/hosted-compute.ts` – Managed runtime API wrappers.
- `src/components/ConsoleLayout.tsx` – Responsive sidebar + header shell.
- `src/pages/*.tsx` – Route pages.
- `src/components/settings/*` – Shared settings UI primitives and reused panels.

## Deployment

```bash
pnpm build
# Deploy via wrangler to the allternit-platform Pages project
npx wrangler pages deploy dist
```
