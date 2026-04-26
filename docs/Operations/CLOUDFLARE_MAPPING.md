# Cloudflare Pages Project Mapping

Quick reference for Cloudflare Pages projects and their domains.

## Active Projects

| Cloudflare Project | Domain(s) | Local Source | Deploy Package | Status |
|-------------------|-----------|--------------|----------------|--------|
| **allternit-docs** | allternit-docs.pages.dev + 1 other | `projects/allternit-docs/source/` | `projects/allternit-docs/deploy.zip` (127K) | ✅ Ready |
| **gizzi-code-docs** | gizzi-code-docs.pages.dev + 1 other | `projects/gizzi-code-docs/source/` | `projects/gizzi-code-docs/deploy.zip` (63K) | ✅ Ready |
| **gizziio** | gizziio.pages.dev + 2 other domains | `projects/gizziio/source/` | `projects/gizziio/deploy.zip` (11K) | ✅ Ready |
| **allternit** | allternit.pages.dev + 1 other | `projects/allternit/source/` | None | ✅ Source only |
| **platform-allternit** | platform-allternit.pages.dev | `projects/platform-allternit/source/` | None | ⚠️ Empty |
| **allternit-protocol-institute** | allternit-protocol-institute.pages.dev + 1 other | `projects/allternit-protocol-institute/source/` | Create from build | ✅ Moved from allternit/ |

## Deployment Status

### Ready to Deploy (Built packages available)
1. **allternit-docs** - Upload `projects/allternit-docs/deploy.zip`
2. **gizzi-code-docs** - Upload `projects/gizzi-code-docs/deploy.zip`
3. **gizziio** - Upload `projects/gizziio/deploy.zip`

### Needs Build First
4. **allternit** - Run `rebuild.sh` to create deploy package
5. **allternit-protocol-institute** - Run `rebuild.sh` to create deploy package

### Needs Source Code
6. **platform-allternit** - No source code in folder yet

## Last Updated

- allternit-docs: 2024-04-08 13:11
- gizzi-code-docs: 2024-04-08 13:11
- gizziio: 2024-04-08 13:11
- allternit-protocol-institute: 2024-04-08 13:30 (moved from allternit/)

## How to Deploy

1. Go to https://dash.cloudflare.com
2. Click on the Pages project name
3. Click "Upload assets" or drag-and-drop
4. Select the corresponding `deploy.zip` file

## Brand Colors

- Gizzi Mascot: `#D4B08C` (beige/tan)
- Gizzi Accents: `#D97757` (orange/coral)
- Allternit: `#B08D6E` (brown)
