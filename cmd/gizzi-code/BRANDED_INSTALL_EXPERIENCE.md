# Gizzi Code - Branded Install Experience

## Brand Colors (from Gizzi Mascot)

| Color | Hex | ANSI | Usage |
|-------|-----|------|-------|
| **Orange** | `#d97757` | `\033[38;5;173m` | Primary accent, bullets, highlights |
| **Beige** | `#d4b08c` | `\033[38;5;180m` | Secondary text, version info, paths |
| **Brown** | `#8f6f56` | `\033[38;5;95m` | Tertiary, subtle elements |
| **Dark** | `#111318` | `\033[38;5;233m` | Eyes, dark accents |

## Gizzi Mascot ASCII Art

```
      ▄▄      
   ▄▄▄  ▄▄▄   
 ▄██████████▄ 
 █  ●    ●  █ 
 █  A : / / █ 
  ▀████████▀  
   █ █  █ █   
   ▀ ▀  ▀ ▀   
```

**Color breakdown:**
- Lines 1: Orange (#d97757) - head top
- Lines 2-6: Beige (#d4b08c) - face
- Lines 7-8: Brown (#8f6f56) - body/legs
- Eyes: Dark (#111318)

## Install Experience Preview

When user runs `curl -fsSL https://gizzi.sh/install | bash`:

```
      ▄▄      
   ▄▄▄  ▄▄▄   
 ▄██████████▄ 
 █  ●    ●  █ 
 █  A : / / █ 
  ▀████████▀  
   █ █  █ █   
   ▀ ▀  ▀ ▀   

              GIZZI CODE - AI Terminal Interface
                    for the A2R Ecosystem

ℹ Platform: macos
ℹ Architecture: arm64
ℹ Install directory: /Users/user/.local/bin

● Checking dependencies...
✓ curl found

● Fetching latest version...
✓ Latest version: v1.0.0

● Installing via npm...
✓ Successfully installed via npm

╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   Installation Complete!                                     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

Get started:
  gizzi-code              Start the TUI
  gizzi-code --help       Show all commands
  gizzi-code --version    Check version

Documentation:
  https://docs.allternit.com
  https://github.com/Gizziio/gizzi-code
```

## Files Updated with Brand Colors

| File | Brand Elements |
|------|----------------|
| `cli-package/install/install.sh` | Mascot, colors, success/error icons |
| `cli-package/install/install.ps1` | Mascot, colors, PowerShell styling |
| `install-site/public/index.html` | Mascot display, orange glow, links |
| `assets/gizzi-ascii-art.txt` | Brand color reference |
| `PACKAGING_STATUS.md` | Brand documentation |

## Landing Page (gizzi.sh)

**Features:**
- Gizzi mascot displayed with brand colors
- Orange glow background (#d97757 at 15% opacity)
- Copy-to-clipboard button (orange)
- Links to docs.allternit.com

**Color scheme:**
- Background: #0a0a0f
- Cards: #12121a
- Primary accent: #d97757 (orange)
- Links: #d97757 → #d4b08c on hover

## Next Steps

1. **Deploy install site** to Cloudflare Pages
2. **Configure DNS** for gizzi.sh
3. **Test install** on different platforms
4. **Publish npm package** @gizzi/gizzi-code

## Install Commands (Ready)

```bash
# macOS/Linux
curl -fsSL https://gizzi.sh/install | bash

# Windows PowerShell
irm https://gizzi.sh/install.ps1 | iex

# npm
npm install -g @gizzi/gizzi-code
```
