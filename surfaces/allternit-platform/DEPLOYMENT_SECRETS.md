# Allternit Platform - Deployment Secrets

## Quick Setup Guide

### Option 1: GitHub Repository Secrets (Recommended)

**URL:** https://github.com/Gizziio/allternit-platform/settings/secrets/actions

Add these 4 repository secrets:

| Secret Name | Value |
|-------------|-------|
| `VERCEL_TOKEN` | Get from https://vercel.com/account/tokens |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_Y2xlcmsucGxhdGZvcm0uYWxsdGVybml0LmNvbSQ` |
| `CLERK_SECRET_KEY` | `sk_live_tKPyrpqLdkUdA4skiH8Leqhxd5RNVA7dEiMyAFhzMK` |
| `ENCRYPTION_KEY` | `4f7dc578c279c2dfaf82eda84b7fc90301f038cd9f0c0e9abf02da02fca7e05d` |

Once added, GitHub Actions will auto-deploy on every push to main.

---

### Option 2: Vercel Dashboard

**URL:** https://vercel.com/gizzi-io-6138s-projects/platform/settings/environment-variables

Add the same 4 variables above, then click **Redeploy**.

---

## Environment Variables Explained

### VERCEL_TOKEN
- **Purpose:** Authenticates GitHub Actions with Vercel
- **How to get:** Go to https://vercel.com/account/tokens → Create Token
- **Required for:** GitHub Actions CI/CD

### NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
- **Purpose:** Clerk authentication (public key for browser)
- **How to get:** https://dashboard.clerk.com → API Keys
- **Required for:** User authentication

### CLERK_SECRET_KEY
- **Purpose:** Clerk authentication (server-side)
- **How to get:** https://dashboard.clerk.com → API Keys
- **Required for:** Server-side auth verification

### ENCRYPTION_KEY
- **Purpose:** Encrypts backend credentials stored in Clerk metadata
- **How to generate:** `openssl rand -hex 32`
- **Required for:** Backend credential security

---

## Deployment Status

- [x] Code pushed to GitHub
- [ ] GitHub Secrets added (pending)
- [ ] Vercel deployment triggered (pending)

## Next Steps

1. Add the secrets above to GitHub or Vercel
2. Push any change to main (or manually trigger deploy)
3. Platform will be live at: https://platform-xyz.vercel.app
