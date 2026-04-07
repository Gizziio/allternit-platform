# Allternit Platform Deployment Guide

## Current Status

✅ **Build**: Working - Next.js compiles successfully  
⚠️ **Deploy**: Blocked by Vercel rate limit (100 deployments/day) - will reset in ~12 hours  
🔧 **Configuration**: Needs manual fix in Vercel dashboard

## The Problem

The Vercel project has **incorrect settings** that cause path duplication errors:

```
Error: ENOENT: no such file or directory, 
  lstat '/.../surfaces/platform/surfaces/platform/.next/routes-manifest.json'
                                                     ^^^^^^^^^^^^^^^^^
                                                     Path is duplicated!
```

## Required Fix (Action Needed)

You need to update the Vercel project settings in the dashboard:

### Step 1: Go to Vercel Dashboard

Open: https://vercel.com/gizzi-io-6138s-projects/platform/settings

### Step 2: Update Build & Output Settings

Navigate to **Settings → Build & Output Settings**

Change these values:

| Setting | Current (Wrong) | Change To (Correct) |
|---------|-----------------|---------------------|
| **Root Directory** | `.` | `surfaces/platform` |
| **Build Command** | `cd surfaces/platform && next build` | `next build` |
| **Output Directory** | `surfaces/platform/out` | `.next` |
| **Install Command** | `pnpm install --no-frozen-lockfile` | `pnpm install --no-frozen-lockfile --ignore-scripts` |

### Step 3: Verify Environment Variables

Navigate to **Settings → Environment Variables**

Ensure these are set for Production:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
ENCRYPTION_KEY=your-encryption-key
DATABASE_URL=your-database-url
```

### Step 4: Save and Deploy

1. Click **Save** at the bottom of the page
2. Go to the **Deployments** tab
3. Click **Redeploy** on the latest deployment

## Alternative: Use Git Integration (Recommended)

If the CLI deployment keeps having issues, you can use Vercel's native Git integration:

1. In Vercel dashboard, go to **Settings → Git**
2. Ensure GitHub repository is connected
3. After fixing the settings above, the project will auto-deploy on every push to main

## What We've Fixed Already

1. ✅ Import fixes (`@a2r` → `@allternit`)
2. ✅ SDK dist committed to git for CI builds
3. ✅ Added missing exports for agent hooks and components
4. ✅ Created `.vercelignore` to exclude conflicting Rust files
5. ✅ Created GitHub Actions workflow with rate limit handling
6. ✅ Added `vercel.json` in `surfaces/platform/` with correct settings
7. ✅ Workflow now runs all commands from `surfaces/platform/` directory

## Workflow Details

The GitHub Actions workflow (`.github/workflows/deploy-platform.yml`) will:

1. **On every PR**: Build the app and verify output (no deployment)
2. **On main branch push**: 
   - Build the app
   - Deploy to Vercel (if not rate limited)
   - If rate limited, build succeeds but shows warning

## If You Hit Rate Limits

Free tier allows 100 deployments per day. If you see:
```
Error: Resource is limited - try again in 24 hours
```

Options:
1. Wait 24 hours for the limit to reset
2. Upgrade to Vercel Pro ($20/month) for unlimited deployments
3. Use the Git integration instead (counts toward the same limit but more reliable)

## Testing Locally

```bash
cd surfaces/platform

# Install dependencies
pnpm install --ignore-scripts

# Generate Prisma client
pnpm prisma generate

# Build
pnpm next build

# Verify output
ls -la .next/
```

## Troubleshooting

### Build succeeds but deploy fails with path error

The Vercel dashboard settings are wrong. Follow "Required Fix" above.

### "Module not found" errors

Make sure `sdk/allternit-sdk/dist/` is committed to git:
```bash
git add sdk/allternit-sdk/dist/
git commit -m "Update SDK dist"
```

### "Conflicting star exports" warning

This is a non-fatal warning in `src/lib/agents/index.ts`. Can be ignored for now.

### Rate limit errors

Wait 24 hours or upgrade to Vercel Pro.

## Project Information

- **Project ID**: `prj_veXmWY1vWUn6N9aBWA4gTRyeSmrx`
- **Org ID**: `team_95y07fz0Hfm77hZMHdsQj4mQ`
- **Framework**: Next.js 15.5.14
- **Node Version**: 20 (CI) / 24 (Vercel default)
- **Package Manager**: pnpm 8
- **Repository**: https://github.com/Gizziio/allternit-platform

## Support

If issues persist:
1. Check GitHub Actions logs: https://github.com/Gizziio/allternit-platform/actions
2. Check Vercel deployment logs: https://vercel.com/gizzi-io-6138s-projects/platform
3. Verify dashboard settings match this guide
