# Gizzi Code Installation Methods

Complete reference for installing Gizzi Code. The package is `gizzi-code`, the command is `gizzi`.

## Quick Install

### macOS / Linux

```bash
curl -fsSL https://gizzi.sh/install.sh | bash
```

### Windows (PowerShell)

```powershell
irm https://gizzi.sh/install.ps1 | iex
```

---

## Package Managers

### Homebrew (macOS)

```bash
brew tap a2r/gizzi-code
brew install gizzi-code
```

### npm (All Platforms)

```bash
npm install -g @a2r/gizzi-code
```

### Winget (Windows)

```powershell
winget install A2R.GizziCode
```

### Scoop (Windows)

```powershell
scoop bucket add gizzi-code https://github.com/a2r/scoop-gizzi-code
scoop install gizzi-code
```

---

## Manual Installation

### Download Binary

1. Download the latest release from GitHub:
   ```bash
   # macOS
   curl -LO https://github.com/a2r/gizzi-code/releases/latest/download/gizzi-code-macos
   
   # Linux
   curl -LO https://github.com/a2r/gizzi-code/releases/latest/download/gizzi-code-linux
   
   # Windows
   curl -LO https://github.com/a2r/gizzi-code/releases/latest/download/gizzi-code-win.exe
   ```

2. Make executable (macOS/Linux):
   ```bash
   chmod +x gizzi-code-*
   ```

3. Move to PATH as `gizzi`:
   ```bash
   # macOS/Linux
   mv gizzi-code-* /usr/local/bin/gizzi
   
   # Windows - rename to gizzi.exe and add to PATH
   ```

### Build from Source

```bash
# Clone repository
git clone https://github.com/a2r/gizzi-code.git
cd gizzi-code/cli-package

# Install dependencies
bun install

# Build
bun run build

# Install globally
npm link
```

---

## Docker

```bash
# Pull image
docker pull a2r/gizzi-code:latest

# Run
docker run -it --rm a2r/gizzi-code:latest

# With volume mount
docker run -it --rm -v $(pwd):/workspace a2r/gizzi-code:latest
```

---

## Verification

After installation, verify with:

```bash
gizzi --version
gizzi --help
```

---

## Post-Installation

### Shell Completions

Add to your shell profile:

**Bash:**
```bash
eval "$(gizzi completion bash)"
```

**Zsh:**
```zsh
eval "$(gizzi completion zsh)"
```

**Fish:**
```fish
gizzi completion fish | source
```

### System Service

**macOS:**
```bash
gizzi service install
gizzi service start
```

**Linux:**
```bash
gizzi service install --user
gizzi service start
```

---

## Uninstallation

### curl/bash Install

```bash
rm ~/.local/bin/gizzi
rm -rf ~/.config/gizzi
```

### Homebrew

```bash
brew uninstall gizzi-code
brew untap a2r/gizzi-code
```

### npm

```bash
npm uninstall -g @a2r/gizzi-code
```

### Winget

```powershell
winget uninstall A2R.GizziCode
```

---

## Troubleshooting

### Command not found

```bash
# Check if in PATH
which gizzi

# Add to PATH
export PATH="$HOME/.local/bin:$PATH"
```

### Permission denied

```bash
chmod +x $(which gizzi)
```

### Outdated version

```bash
# Update via your package manager
brew upgrade gizzi-code       # Homebrew
npm update -g @a2r/gizzi-code # npm
winget upgrade A2R.GizziCode  # Winget
```

---

## Support

- **Documentation**: https://docs.gizzi.sh
- **Issues**: https://github.com/a2r/gizzi-code/issues
- **Discord**: https://discord.gg/a2r
