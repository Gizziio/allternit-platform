# Gizzi Code Documentation Spec

**Version:** 1.0.0  
**Status:** Draft - Ready for Implementation  
**Location:** docs.gizziio.com

---

## Overview

This spec defines the documentation structure and content requirements for Gizzi Code to match the depth and organization of Claude Code's documentation.

---

## Part 1: Install Scripts Status & Fix Plan

### Current State: NONE WORK

| Install Method | Status | Why It Fails | Fix Required |
|----------------|--------|--------------|--------------|
| `curl \| bash` | ❌ BROKEN | Points to `anomalyco/opencode` repo | Update to `Gizziio/gizzi-code` |
| `npm install -g` | ❌ BROKEN | Package `@gizzi/gizzi-code` doesn't exist | Publish to NPM or fix package name |
| `brew install` | ❌ BROKEN | SHA256 placeholders, no releases | Create releases, update SHA256s |
| `irm \| iex` (Windows) | ❌ BROKEN | Script exists but no releases | Deploy script, create releases |

### Fix Checklist

- [ ] **Step 1:** Create GitHub Releases for Gizziio/gizzi-code
  - Build binaries for: macOS (arm64/x64), Linux (arm64/x64), Windows (x64)
  - Upload to GitHub releases with version tags
  
- [ ] **Step 2:** Fix `install` script (bash)
  - Change `APP=a2r` → `APP=gizzi-code`
  - Change repo from `anomalyco/opencode` → `Gizziio/gizzi-code`
  - Update install path from `~/.a2r/bin` → `~/.gizzi/bin`
  - Deploy to `install.gizziio.com/install`

- [ ] **Step 3:** Fix `install.ps1` (PowerShell)
  - Update package name references
  - Deploy to `install.gizziio.com/install.ps1`

- [ ] **Step 4:** Update Homebrew formula
  - Calculate real SHA256s for each binary
  - Submit to homebrew-core or create tap

- [ ] **Step 5:** Fix NPM
  - Either: Rename package to `@gizzi/gizzi-code`
  - Or: Update docs to use `@a2r/gizzi-code`
  - Publish to npm registry

---

## Part 2: Documentation Structure

### URL Structure
```
docs.gizziio.com/
├── /                          # Landing page with mascot + install
├── /getting-started/
│   ├── /                      # Getting started index
│   ├── installation           # All install methods
│   └── quickstart             # First 5 minutes tutorial
├── /user-guide/
│   ├── /                      # User guide index
│   ├── commands/              # Every command documented
│   │   ├── index              # Command reference overview
│   │   ├── init               # Initialize project
│   │   ├── chat               # Chat with AI
│   │   ├── edit               # Edit files
│   │   ├── bash               # Run bash commands
│   │   ├── grep               # Search codebase
│   │   ├── codebase           # Codebase context
│   │   └── ...                # Every command
│   ├── workflows/
│   │   ├── debugging          # Debug with Gizzi
│   │   ├── refactoring        # Refactor code
│   │   ├── code-review        # Review changes
│   │   └── git-workflows      # Git integration
│   ├── context/
│   │   ├── @-mentions         # Using @ mentions
│   │   ├── files              # Working with files
│   │   ├── codebase-search    # Search functionality
│   │   └── git-integration    # Git context
│   └── tips                   # Best practices
├── /reference/
│   ├── configuration          # Settings/options
│   ├── keyboard-shortcuts     # All keyboard shortcuts
│   ├── system-requirements    # What you need
│   └── troubleshooting        # Common issues
├── /advanced/
│   ├── custom-tools           # Building custom tools
│   ├── local-models           # Using local LLMs
│   └── api                    # Programmatic API
└── /changelog                 # Release notes
```

---

## Part 3: Content Requirements Per Page

### Landing Page (`/`)
**Purpose:** Convert visitors to users in 30 seconds

**Required Sections:**
1. Gizzi mascot ASCII art (branded)
2. One-line value prop: "AI-powered terminal interface for developers"
3. Install command: `curl -fsSL https://install.gizziio.com/install | bash`
4. 3-surface badges (Terminal, VS Code, Desktop)
5. Links to: Quickstart, GitHub, Allternit Docs

---

### Installation Page (`/getting-started/installation`)
**Purpose:** Get every user installed successfully

**Required Content:**
```markdown
# Installation

## macOS & Linux (curl)
\`\`\`bash
curl -fsSL https://install.gizziio.com/install | bash
\`\`\`

## Windows (PowerShell)
\`\`\`powershell
irm https://install.gizziio.com/install.ps1 | iex
\`\`\`

## Homebrew (macOS/Linux)
\`\`\`bash
brew install gizzi-code
\`\`\`

## NPM (Cross-platform)
\`\`\`bash
npm install -g @gizzi/gizzi-code
\`\`\`

## Requirements
- Node.js 18+ (for npm install)
- macOS 11+, Linux (glibc), Windows 10+

## Verify Installation
\`\`\`bash
gizzi-code --version
\`\`\`
```

---

### Quickstart (`/getting-started/quickstart`)
**Purpose:** User's first successful interaction

**Structure:**
1. **Goal statement:** "In 5 minutes, you'll use Gizzi to modify code"
2. **Prerequisites:** Installation complete, terminal open
3. **Step-by-step:**
   - Navigate to a project: `cd ~/my-project`
   - Start Gizzi: `gizzi-code`
   - First command: "List all files"
   - Success criteria: User sees file list
4. **Next steps:** Link to User Guide

---

### Command Reference Pages (`/user-guide/commands/{command}`)
**Purpose:** Complete reference for every command

**Template for each command:**
```markdown
# {CommandName}

## Description
One sentence what it does.

## Usage
\`\`\`
{command} [flags] [arguments]
\`\`\`

## Examples

### Basic usage
\`\`\`
> {example input}
{example output}
\`\`\`

### With flags
\`\`\`
> {example with flags}
{output}
\`\`\`

## Flags
| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| --flag | -f | What it does | value |

## Error Cases
- Error: "message" → Solution

## Related Commands
- [Other command](/user-guide/commands/other)
```

**Required Commands to Document:**
- [ ] `init` - Initialize a project
- [ ] `chat` - Start chat mode
- [ ] `edit` - Edit files
- [ ] `bash` - Run shell commands
- [ ] `grep` - Search codebase
- [ ] `codebase` - Codebase context operations
- [ ] `@` - Context mentions (files, symbols)
- [ ] `git` - Git operations

---

### Troubleshooting (`/reference/troubleshooting`)
**Purpose:** Fix problems without support tickets

**Required Sections:**
```markdown
# Troubleshooting

## Installation Issues

### "command not found: gizzi-code"
**Cause:** PATH not updated
**Fix:** 
\`\`\`bash
export PATH="$HOME/.gizzi/bin:$PATH"
\`\`\`

### Download fails
**Cause:** Network or GitHub rate limit
**Fix:** Use npm method instead

## Runtime Issues

### Gizzi won't start
**Cause:** Port conflict, missing config
**Fix:** Check port 3000, reset config

### AI not responding
**Cause:** API key missing
**Fix:** Run `gizzi-code config set api.key=...`
```

---

## Part 4: Content Style Guide

### Writing Principles

1. **Lead with code:** Every concept must have a working example
2. **Progressive disclosure:** Basic → Advanced within each page
3. **Error-aware:** Document what can go wrong and how to fix it
4. **Copy-paste friendly:** Code blocks should work without modification

### Formatting Rules

- **Commands:** Always use `inline code` with full syntax
- **File paths:** Use `/unix/style/paths` consistently
- **UI elements:** Use **bold** for buttons/labels
- **Keys:** Use `Ctrl+K` format

### Code Block Requirements

Every code block must be:
1. **Runnable:** User can copy and run it
2. **Complete:** No missing context
3. **Tested:** Verified to work
4. **Annotated:** Comments explain non-obvious parts

---

## Part 5: Implementation Priority

### Phase 1: Core (Week 1)
- [ ] Landing page
- [ ] Installation page
- [ ] Quickstart guide
- [ ] Top 5 commands documented

### Phase 2: Reference (Week 2-3)
- [ ] All commands documented
- [ ] Configuration reference
- [ ] Troubleshooting guide

### Phase 3: Polish (Week 4)
- [ ] Workflows section
- [ ] Advanced topics
- [ ] Search functionality
- [ ] Changelog

---

## Part 6: Technical Requirements

### Build System
- Framework: React + Vite + TypeScript
- Styling: Tailwind CSS with brand colors
- Search: Pagefind (client-side, free)
- Deployment: Cloudflare Pages

### Assets Needed
- [ ] Gizzi mascot SVG
- [ ] Favicon (orange #D97757)
- [ ] Social preview image (1200x630)

### Cross-Links Required
- docs.gizziio.com → docs.allternit.com (Platform docs)
- docs.gizziio.com → install.gizziio.com
- docs.allternit.com → docs.gizziio.com

---

## Summary

**To make docs.gizziio.com work:**
1. First fix install scripts (so users can actually install)
2. Then write documentation (so users know what to do)
3. Finally deploy to Cloudflare Pages

**Current Blocker:** No working install method = no users = no point in docs yet.

**Recommended Order:**
1. Create GitHub releases with binaries
2. Fix and deploy install scripts
3. Build documentation site
4. Publish docs
