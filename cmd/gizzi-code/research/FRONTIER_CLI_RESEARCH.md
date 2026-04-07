# Frontier CLI Packaging Research

Research on how modern companies package and brand their CLI tools.

---

## 1. Anthropic Claude Code

### Install Methods
| Method | Command |
|--------|---------|
| curl (macOS/Linux) | `curl -fsSL https://claude.ai/install.sh \| bash` |
| PowerShell (Windows) | `irm https://claude.ai/install.ps1 \| iex` |
| npm | `npm install -g @anthropic-ai/claude-code` |

### Domain Strategy
- **Main domain**: `claude.ai` (short, branded)
- **Install path**: `/install.sh` and `/install.ps1` (separate scripts)
- **No subdomain**: Uses main domain path for simplicity

### Install Script Analysis
- Uses **Google Cloud Storage** for binaries (not GitHub Releases directly)
- Downloads to `$HOME/.claude/downloads`
- Supports version selection: `stable`, `latest`, or specific version
- Validates version format with regex
- Graceful handling of missing dependencies (curl/wget)
- Optional `jq` support for better parsing

### Branding Elements
- Package name: `@anthropic-ai/claude-code`
- Command: `claude` (short, not `claude-code`)
- npm unpacked size: 44.5 MB
- Clean, simple install experience

---

## 2. Vercel CLI

### Install Methods
| Method | Command |
|--------|---------|
| npm (recommended) | `npm i -g vercel` |
| curl | `curl -fsSL https://vercel.com/install \| bash` |
| Homebrew | `brew install vercel-cli` |

### Domain Strategy
- **Main domain**: `vercel.com` 
- **Install path**: `/install`
- npm package: `vercel` (short, same as company name)

### Key Differences
- Provides **both** `vc` and `vercel` commands
- npm unpacked size: 8.4 MB (smaller than Claude)
- Apache-2.0 license
- 949 versions (very active development)

---

## 3. Fly.io (flyctl)

### Install Methods
| Method | Command |
|--------|---------|
| curl | `curl -fsSL https://fly.io/install.sh \| sh` |
| Homebrew | `brew install flyctl` |

### Domain Strategy
- **Main domain**: `fly.io`
- **Install path**: `/install.sh`
- Uses **API endpoint** to get download URL: `api.fly.io/app/flyctl_releases/$os/$arch/$version`

### Install Script Features
- Based on **Deno installer** (auditable design)
- Arguments support:
  - `--non-interactive`
  - `--setup-path`
  - version selection (`latest`, `prerel`, or specific)
- Install location: `$HOME/.fly/bin`
- Smart OS/arch detection
- Error handling for unsupported platforms

### Branding
- Command: `flyctl` (distinct from company name)
- Also provides `fly` symlink
- Modern, developer-friendly messaging

---

## 4. Turso CLI

### Install Methods
| Method | Command |
|--------|---------|
| curl | `curl -sSfL https://get.tur.so/install.sh \| bash` |
| Homebrew | `brew install turso` |

### Domain Strategy
- **Subdomain approach**: `get.tur.so`
- Separates install experience from main site
- Clean, focused domain

### Branding (BEST IN CLASS)
- **ASCII Art Logo**: Stunning terminal logo with bright blue colors
- Color codes:
  ```bash
  reset="\033[0m"
  bright_blue="${reset}\033[34;1m"
  ```
- Full-screen ASCII art during install
- Very memorable visual experience

### Install Script Features
- Explicit architecture support check
- Explicit OS support check
- Clear error messages for unsupported platforms
- Clean, minimal script design

---

## 5. GitHub CLI (gh)

### Install Methods
| Method | Command |
|--------|---------|
| GitHub Releases | Manual download |
| Package managers | brew, apt, yum, etc. |
| GitHub Actions | `cli/cli` action |

### Release Naming Convention
```
gh_2.89.0_linux_386.deb
gh_2.89.0_linux_amd64.deb
gh_2.89.0_linux_arm64.deb
gh_2.89.0_macOS_amd64.zip
gh_2.89.0_macOS_arm64.zip
gh_2.89.0_windows_amd64.zip
```

### Pattern
- `{tool}_{version}_{os}_{arch}.{ext}`
- Multiple package formats per platform (deb, rpm, tar.gz)
- Consistent naming across all assets

---

## Key Patterns Discovered

### 1. Domain Strategies

| Strategy | Example | Pros | Cons |
|----------|---------|------|------|
| **Main domain path** | `claude.ai/install` | Simple, branded | Clutters main domain |
| **Subdomain** | `get.tur.so` | Clean separation | Extra DNS setup |
| **Short domain** | `fly.io/install.sh` | Memorable | Domain availability |

### 2. Binary Distribution

| Approach | Used By | Pros | Cons |
|----------|---------|------|------|
| **Google Cloud Storage** | Claude | Fast, reliable | Vendor lock-in |
| **GitHub Releases** | Most common | Free, integrated | Rate limits |
| **API endpoint** | Fly.io | Dynamic URLs | More complex |

### 3. Install Locations

| Location | Used By | Notes |
|----------|---------|-------|
| `$HOME/.{tool}/bin` | Claude, Fly.io | Hidden directory |
| `$HOME/.local/bin` | Standard | XDG compliant |
| `/usr/local/bin` | System-wide | Requires sudo |

### 4. Branding Approaches

| Level | Example | Effect |
|-------|---------|--------|
| **Minimal** | Claude | Clean, professional |
| **Colorful** | Turso | Memorable, fun |
| **Silent** | Fly.io | Gets job done |

### 5. Command Naming

| Pattern | Example | When to Use |
|---------|---------|-------------|
| **Short** | `claude`, `vercel` | Well-known brand |
| **Descriptive** | `flyctl`, `gizzi-code` | Avoids conflicts |
| **Dual** | `vc` + `vercel` | User preference |

---

## Recommendations for Gizzi Code

### 1. Domain: Use Main Domain Path
```
https://gizzi.sh/install       # Primary
https://gizzi.sh/install.ps1   # Windows
```

**Rationale**: 
- Simple and memorable
- Follows Claude's pattern (most similar product)
- No extra DNS setup

### 2. Install Location
```
$HOME/.local/bin/gizzi-code    # Already done ✓
```

**Rationale**:
- XDG compliant
- No hidden directories
- User-local, no sudo needed

### 3. Add Turso-Style ASCII Art
```bash
bright_blue="\033[34;1m"
reset="\033[0m"

printf "${bright_blue}
   ╔═══════════════════════════════════════╗
   ║      GIZZI CODE                       ║
   ║      AI Terminal Interface            ║
   ╚═══════════════════════════════════════╝
${reset}\n"
```

### 4. Binary Naming
```
gizzi-code-1.0.0-darwin-arm64
gizzi-code-1.0.0-darwin-x64
gizzi-code-1.0.0-linux-arm64
gizzi-code-1.0.0-linux-x64
gizzi-code-1.0.0-windows-x64.exe
```

### 5. Multiple Package Formats
- Raw binary (for install script)
- .tar.gz (for manual download)
- .deb (for Debian/Ubuntu)
- .rpm (for RHEL/CentOS)
- .zip (for Windows, macOS)

### 6. Version Selection Support
Allow:
```bash
curl -fsSL https://gizzi.sh/install | bash              # latest
curl -fsSL https://gizzi.sh/install | VERSION=1.0.0 bash # specific
```

---

## Implementation Checklist

### Phase 1: Core (DONE)
- [x] Install scripts (`install.sh`, `install.ps1`)
- [x] npm package (`@gizzi/gizzi-code`)
- [x] Binary naming (`gizzi-code`)
- [x] GitHub release workflow

### Phase 2: Branding (NEXT)
- [ ] Add ASCII art to install script (Turso-style)
- [ ] Color scheme for terminal output
- [ ] Progress indicators
- [ ] Better error messages with colors

### Phase 3: Landing Page (NEXT)
- [ ] Deploy `gizzi.sh` landing page
- [ ] Copy-to-clipboard for install command
- [ ] Dark mode design
- [ ] Terminal-style code blocks

### Phase 4: Distribution (FUTURE)
- [ ] Homebrew formula
- [ ] .deb and .rpm packages
- [ ] Windows installer (.msi)
- [ ] Checksum files (.sha256)
- [ ] GPG signatures

### Phase 5: Advanced (FUTURE)
- [ ] Version API endpoint
- [ ] Analytics on installs
- [ ] Auto-update mechanism
