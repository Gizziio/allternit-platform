# Cloudflare Pages Deployment - Handoff Document

**Date:** April 9, 2026
**Status (2026-09-14):** Historical. Vercel hosting is retired. Web surfaces
deploy to Cloudflare Pages via `.github/workflows/deploy-cloudflare-pages.yml`.
Do not wait on a Vercel rate-limit reset and do not revert to Vercel.
**Last Commit:** 73024ca0

---

## What We Were Trying To Do

Move the Allternit Platform off the old Next.js host onto Cloudflare Pages.

---

## Current State

### ✅ Completed
1. Created Cloudflare Pages deployment workflow (`.github/workflows/deploy-cloudflare-pages.yml`)
2. Configured `wrangler.toml` with build settings
3. Updated `next.config.ts` to support `output: 'export'` when `CLOUDFLARE_PAGES=1`
4. Fixed numerous import paths after folder restructuring:
   - `src/capsules/browser/index.ts`
   - `src/capsules/browser/BrowserNativeComposer.tsx`
   - `src/capsules/browser/BrowserExtensionPane.tsx`
   - `src/capsules/browser/browserExtensionPane.adapter.ts`
   - `src/capsules/browser/BrowserExtensionViews.tsx`
5. Removed problematic dynamic routes temporarily:
   - `src/app/shell/pair/[code]/page.tsx` (DELETED)
   - `src/app/shell/session/[id]/page.tsx` (DELETED)
6. Added `generateStaticParams()` to remaining dynamic routes:
   - `src/app/sign-in/[[...sign-in]]/page.tsx`
   - `src/app/sign-up/[[...sign-up]]/page.tsx`

### ❌ Blockers

**PRIMARY ISSUE:** Next.js static export (`output: 'export'`) is fundamentally incompatible with this app's architecture:

1. **API Routes** - The app has ~40 API routes in `src/app/api/`. These don't work with static export.
   - Current workaround: Deleted `src/app/api/` during build
   - Problem: This breaks all backend functionality

2. **Dynamic Routes** - Routes like `/shell/pair/[code]`, `/sign-in/[[...sign-in]]` require `generateStaticParams()`
   - We added this function but Next.js still fails to recognize it
   - Error persists: `Page "/sign-in/[[...sign-in]]" is missing "generateStaticParams()"`

3. **Server Components** - Many pages use server-side features that don't work with static export

4. **Monorepo Path Issues** - The `@cloudflare/next-on-pages` approach (Functions instead of static export) fails due to path resolution issues in the monorepo structure

### 🔴 Current Error (Last Build)
```
[Error: Page "/sign-in/[[...sign-in]]" is missing "generateStaticParams()" 
so it cannot be used with "output: 'export'" config.]
```

Despite `generateStaticParams()` being present in the file.

---

## Files Changed

### Workflow
- `.github/workflows/deploy-cloudflare-pages.yml` - Deployment workflow

### Configuration
- `wrangler.toml` - Cloudflare Pages config
- `surfaces/allternit-platform/next.config.ts` - Next.js export config

### Deleted Routes (Temporary Removal)
- `surfaces/allternit-platform/src/app/shell/pair/[code]/page.tsx`
- `surfaces/allternit-platform/src/app/shell/session/[id]/page.tsx`

### Modified Routes
- `surfaces/allternit-platform/src/app/sign-in/[[...sign-in]]/page.tsx`
- `surfaces/allternit-platform/src/app/sign-up/[[...sign-up]]/page.tsx`

### Fixed Imports
- `surfaces/allternit-platform/src/capsules/browser/index.ts`
- `surfaces/allternit-platform/src/capsules/browser/BrowserNativeComposer.tsx`
- `surfaces/allternit-platform/src/capsules/browser/BrowserExtensionPane.tsx`
- `surfaces/allternit-platform/src/capsules/browser/browserExtensionPane.adapter.ts`
- `surfaces/allternit-platform/src/capsules/browser/BrowserExtensionViews.tsx`

---

## Recommended Path Forward

Vercel is not a path. The live deploy is Cloudflare Pages (Vite static export).

### Option 1: Docker/VPS Deployment
**Pros:**
- Full Next.js server functionality
- No static export limitations
- API routes work normally

**Cons:**
- More setup/maintenance
- Need to manage infrastructure

**Action:**
- Build Docker image with `docker build`
- Deploy to Railway, Fly.io, or VPS
- Set up environment variables

### Option 2: Netlify
**Pros:**
- Next.js server functions supported
- Easy migration

**Cons:**
- May still hit edge function limits
- Need to test compatibility

**Action:**
- Create `netlify.toml`
- Use `@netlify/plugin-nextjs`
- Deploy via GitHub integration

---

## Cloudflare Pages Functions (Abandoned Approach)

We tried using `@cloudflare/next-on-pages` to deploy with API routes as Edge Functions. Failed due to:

1. Monorepo path issues - tool couldn't resolve paths correctly
2. Postinstall script failures from other packages in workspace
3. Error: `ENOENT: no such file or directory, lstat '.../surfaces/platform/surfaces/platform/.next/...'`

**Files:**
- Workflow had steps to install and run `@cloudflare/next-on-pages@latest`
- Removed in later commits

---

## Environment Variables Needed

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
ENCRYPTION_KEY=
DATABASE_URL=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
```

---

## Next Steps

1. **Current:** Cloudflare Pages via GitHub Actions (see `surfaces/ai.allternit.com/DEPLOYMENT.md`)
2. **If Docker:** Create Dockerfile, docker-compose.yml, deploy to VPS
3. **If Netlify:** Create netlify.toml, install Netlify Next.js plugin

---

## Time Spent

~8 hours attempting various approaches:
- Static export configuration
- Fixing import paths after folder restructuring
- Trying to add `generateStaticParams()` to dynamic routes
- Attempting `@cloudflare/next-on-pages` approach
- Debugging monorepo path issues

---

## Key Lesson

**Static export is not viable for this application.** The app requires:
- API routes (40+ endpoints)
- Server-side rendering
- Dynamic routes with runtime parameters
- Database connections (Prisma)

These were incompatible with a Next.js static export. The later Vite SPA rewrite is what made Cloudflare Pages the live path. Do not go back to Vercel.

---

**Document prepared for handoff to next developer or for future reference.**
