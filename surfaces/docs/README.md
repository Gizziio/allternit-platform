# Allternit Documentation

Documentation site for Allternit platform, built with [Mintlify](https://mintlify.com).

## Development

```bash
# Install Mintlify CLI
npm install -g @mintlify/cli

# Start dev server
mintlify dev
```

## Deployment

### Option 1: Mintlify Cloud (Recommended)

1. Push to GitHub
2. Connect repo at [dashboard.mintlify.com](https://dashboard.mintlify.com)
3. Auto-deploys on push to main

### Option 2: Cloudflare Pages (Current)

Build locally and upload to Cloudflare Pages:

```bash
# Build static site
mintlify build

# Upload dist/ folder to Cloudflare Pages
# Via dashboard: https://dash.cloudflare.com → Pages → docs-allternit
```

### Option 3: Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

## Structure

```
docs/
├── docs.json          # Mintlify configuration
├── introduction.mdx   # Landing page
├── quickstart.mdx     # Quick start guide
├── architecture.mdx   # Platform architecture
├── core/              # Core concepts
│   ├── gizzi-runtime.mdx
│   ├── communication.mdx
│   ├── git-dag.mdx
│   └── skills.mdx
├── byoc/              # BYOC deployment
│   ├── overview.mdx
│   ├── installation.mdx
│   ├── configuration.mdx
│   └── deployment.mdx
├── surfaces/          # User interfaces
│   ├── desktop.mdx
│   ├── platform.mdx
│   └── cli.mdx
├── api/               # API reference
│   ├── authentication.mdx
│   ├── endpoints.mdx
│   └── event-stream.mdx
└── sdk/               # SDK documentation
    ├── typescript.mdx
    └── python.mdx
```

## URLs

- Production: https://docs.allternit.com
- Preview: https://docs-allternit.pages.dev

## Contributing

1. Edit files in this directory
2. Test locally with `mintlify dev`
3. Submit PR
4. Auto-deploys on merge

## Custom Domain

Already configured in `docs.json`:
- Primary: docs.allternit.com
- Fallback: docs-allternit.pages.dev
