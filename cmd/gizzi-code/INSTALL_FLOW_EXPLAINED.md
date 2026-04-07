# How Installation Scripts Work

## The Flow

### User Runs Command
```bash
curl -fsSL https://gizzi.sh/install | bash
```

### Step-by-Step

```
1. curl fetches https://gizzi.sh/install
         ↓
   Cloudflare Pages (gizzi.sh)
         ↓
2. Redirects to GitHub raw content:
   https://raw.githubusercontent.com/Gizziio/gizzi-code/main/cli-package/install/install.sh
         ↓
3. GitHub serves the raw script
         ↓
4. Pipe to bash executes it
         ↓
5. Script downloads binary from GitHub Releases
```

## File Locations

### Source Files (in your repo)
```
gizzi-code/
├── cli-package/
│   └── install/
│       ├── install.sh        # ← bash script for macOS/Linux
│       └── install.ps1       # ← PowerShell script for Windows
│
└── install-site/             # ← Cloudflare Pages site
    └── public/
        ├── _redirects        # ← redirect rules
        ├── index.html        # ← landing page
        └── .well-known/
            └── version.json  # ← version API
```

### Where They're Served From

| URL | Redirects To | Purpose |
|-----|-------------|---------|
| `https://gizzi.sh/install` | GitHub raw `install.sh` | Main install script |
| `https://gizzi.sh/install.ps1` | GitHub raw `install.ps1` | Windows script |
| `https://gizzi.sh/version` | `version.json` (direct) | Version info |
| `https://gizzi.sh/` | `index.html` (direct) | Landing page |

## The Redirect File

`install-site/public/_redirects`:
```
/install        https://raw.githubusercontent.com/Gizziio/gizzi-code/main/cli-package/install/install.sh      302
/install.sh     https://raw.githubusercontent.com/Gizziio/gizzi-code/main/cli-package/install/install.sh      302
/install.ps1    https://raw.githubusercontent.com/Gizziio/gizzi-code/main/cli-package/install/install.ps1     302
/version        /.well-known/version.json                                    200
/               https://github.com/Gizziio/gizzi-code                         302
```

## Why This Setup?

| Approach | Pros | Cons |
|----------|------|------|
| **Our way**: Short URL → GitHub raw | Free, version controlled, short branded URL | Needs Cloudflare setup |
| Direct GitHub raw URL | Free, version controlled | Long ugly URL |
| Self-hosted server | Full control | Costs money, maintenance |
| CDN-hosted file | Fast, reliable | Costs money |

## The Install Script Logic

```bash
# 1. Detect platform (macOS/Linux)
platform=$(detect_platform)   # "macos" or "linux"
arch=$(detect_arch)           # "arm64" or "x64"

# 2. Choose install method
if npm is installed:
    npm install -g @gizzi/gizzi-code  # Easy, universal
else:
    # Download pre-built binary
    curl -o gizzi-code https://github.com/Gizziio/gizzi-code/releases/download/v1.0.0/gizzi-code-${platform}
    
# 3. Install to ~/.local/bin/gizzi-code

# 4. Add to PATH if needed

# 5. Verify installation
```

## Binary Distribution

Built binaries are stored in **GitHub Releases**:
```
https://github.com/Gizziio/gizzi-code/releases/latest/download/gizzi-code-macos-arm64
https://github.com/Gizziio/gizzi-code/releases/latest/download/gizzi-code-macos-x64
https://github.com/Gizziio/gizzi-code/releases/latest/download/gizzi-code-linux-arm64
https://github.com/Gizziio/gizzi-code/releases/latest/download/gizzi-code-linux-x64
https://github.com/Gizziio/gizzi-code/releases/latest/download/gizzi-code-win.exe
```

Built by GitHub Actions on every tag push.

## Summary

1. **Scripts live in**: `cli-package/install/` (in your repo)
2. **Served via**: Cloudflare Pages redirects to GitHub raw URLs
3. **Short URL**: `gizzi.sh/install` (your branded domain)
4. **Binaries from**: GitHub Releases (built by GitHub Actions)
