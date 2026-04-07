# Allternit Platform Deployment Guide

## Overview

This Next.js application is deployed to Vercel. Due to the monorepo structure (`surfaces/platform/`), special configuration is required.

## Deployment Methods

### Method 1: Git Integration (Recommended)

Vercel can automatically deploy when you push to GitHub.

**Setup:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select the `platform` project
3. Go to **Settings → Git**
4. Ensure GitHub repository is connected
5. Configure:
   - **Production Branch**: `main`
   - **Root Directory**: `surfaces/platform`
   - **Build Command**: `next build`
   - **Output Directory**: `.next`
   - **Install Command**: `pnpm install --no-frozen-lockfile --ignore-scripts`

**Environment Variables** (set in Vercel Dashboard → Settings → Environment Variables):
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
ENCRYPTION_KEY=your-encryption-key
DATABASE_URL=your-database-url
```

### Method 2: GitHub Actions (CLI)

The repository includes `.github/workflows/deploy-platform.yml` for CI/CD deployment.

**Required GitHub Secrets:**
- `VERCEL_TOKEN` - Vercel API token
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `ENCRYPTION_KEY`
- `DATABASE_URL`

**Workflow Features:**
- Build verification on every PR
- Automatic deployment on merge to main
- Artifact upload for debugging

### Method 3: Manual CLI Deployment

```bash
# From repo root
cd surfaces/platform

# Install Vercel CLI
npm install -g vercel

# Login (first time only)
vercel login

# Link to existing project
vercel link

# Deploy
vercel --prod
```

## Troubleshooting

### Path Duplication Error

**Error:**
```
ENOENT: no such file or directory, lstat '.../surfaces/platform/surfaces/platform/.next/...'
```

**Cause:**
Vercel project has Root Directory set to `surfaces/platform`, but commands are run from that directory in CI.

**Solutions:**

1. **Fix Vercel Dashboard Settings:**
   - Set Root Directory to `./` (repo root)
   - Update Build Command to: `cd surfaces/platform && next build`
   - Update Install Command to: `cd surfaces/platform && pnpm install --no-frozen-lockfile --ignore-scripts`

2. **Or Fix CI Workflow:**
   - Remove `working-directory: surfaces/platform` from all steps
   - Run all commands from repo root

### Rate Limiting

**Error:**
```
Error: Resource is limited - try again in 24 hours (more than 100, code: "api-deployments-free-per-day")
```

**Solution:**
- Free tier allows 100 deployments per day
- Wait 24 hours or upgrade to Pro plan
- Use Git integration instead of CLI for fewer deployments

### Build Failures

**Check:**
1. All environment variables are set
2. Prisma client is generated (`pnpm prisma generate`)
3. Dependencies are installed (`pnpm install`)
4. No conflicting star exports in `src/lib/agents/index.ts`

## Current Configuration

- **Vercel Project**: `gizzi-io-6138s-projects/platform`
- **Project ID**: `prj_veXmWY1vWUn6N9aBWA4gTRyeSmrx`
- **Org ID**: `team_95y07fz0Hfm77hZMHdsQj4mQ`
- **Framework**: Next.js 15.5.14
- **Node Version**: 20
- **Package Manager**: pnpm 8

## Important Notes

1. **Skip Postinstall**: We use `--ignore-scripts` because extension packages have failing postinstall hooks
2. **SDK Dist**: The `sdk/allternit-sdk/dist/` folder is committed to git for CI builds
3. **Vercel Ignore**: Root `.vercelignore` excludes Rust files that conflict with TypeScript on case-insensitive filesystems
