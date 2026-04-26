# ALLTERNIT BRAND AUTHORITY

**Version:** 1.0  
**Date:** 2026-03-29  
**Status:** DEFINITIVE - DO NOT DEVIATE  
**Applies To:** All code, documentation, configs, and assets in the allternit codebase

---

## ⚠️ CRITICAL DIRECTIVE

**THIS DOCUMENT IS THE SINGLE SOURCE OF TRUTH FOR ALL BRANDING.**

All agents, developers, and systems MUST use these exact naming conventions. **DO NOT** revert to old branding under any circumstances.

**Old branding that must NEVER be used:**
- ❌ allternit
- ❌ allternit
- ❌ allternit
- ❌ allternit (as standalone brand name)
- ❌ A://TERNIT
- ❌ A://TERNIT
- ❌ @allternit/* (NPM scope)
- ❌ @allternit/* (NPM scope)
- ❌ com.allternit.* (bundle ID)
- ❌ com.allternit.* (bundle ID)
- ❌ allternit.com (domain)
- ❌ allternit.com (domain)

---

## 🏗️ BRAND ARCHITECTURE (OFFICIAL)

```
┌─────────────────────────────────────────────┐
│              ALLTERNIT                      │
│           (Company/Product)                 │
│         Use: "allternit"                    │
└─────────────────────────────────────────────┘
                │
                │ offers
                ▼
┌─────────────────────────────────────────────┐
│        Allternit Protocol                   │
│      (Formal system name)                   │
│    Use: "Allternit Protocol"                │
└─────────────────────────────────────────────┘
                │
                │ symbolized as
                ▼
┌─────────────────────────────────────────────┐
│                a://                         │
│     (URI scheme / protocol symbol)          │
│        Use: "a://" (like http://)           │
└─────────────────────────────────────────────┘
                │
                │ stylized as
                ▼
┌─────────────────────────────────────────────┐
│            A://TERNIT                       │
│       (Visual brand lockup)                 │
│      Use: "A://TERNIT"                      │
└─────────────────────────────────────────────┘
```

---

## 📋 OFFICIAL NAMING CONVENTIONS

### 1. Company & Product Name

**Official:** `allternit` (lowercase)

| Context | Usage | Example |
|---------|-------|---------|
| Company name | allternit | "Welcome to allternit" |
| Product name | allternit | "Built with allternit" |
| Adjective | allternit | "allternit platform" |
| Possessive | allternit's | "allternit's features" |

**NEVER USE:** allternit, allternit, allternit, allternit

---

### 2. Protocol Name

**Official:** `Allternit Protocol` (capital A, capital P)

| Context | Usage | Example |
|---------|-------|---------|
| Formal name | Allternit Protocol | "Built on the Allternit Protocol" |
| Specification | Allternit Protocol v1.0 | "Allternit Protocol v1.0 Specification" |
| Technical docs | Allternit Protocol | "The Allternit Protocol defines..." |
| Informal | Allternit Protocol | "Powered by Allternit Protocol" |

**NEVER USE:** allternit protocol, allternit protocol

---

### 3. URI Scheme / Protocol Symbol

**Official:** `a://` (lowercase a, double slash)

| Context | Usage | Example |
|---------|-------|---------|
| Commands | a:// | `a://browser open https://example.com` |
| Code | a:// | `if (input.startsWith('a://'))` |
| Documentation | a:// | "The a:// URI scheme" |
| Deep links | a:// | `a://capture screen` |

**NEVER CHANGE:** This is the functional protocol symbol (like http://)

---

### 4. Visual Brand Lockup

**Official:** `A://TERNIT` (capital A, double slash, TERNIT in caps)

| Context | Usage | Example |
|---------|-------|---------|
| UI messages | A://TERNIT | "A://TERNIT ready. Keep the diff small." |
| ASCII logo | A://TERNIT | `"      A://TERNIT       "` |
| Status text | A://TERNIT | "A://TERNIT agent sync complete" |
| Visual branding | A://TERNIT | `<span>A://TERNIT</span>` |

**NEVER USE:** A://TERNIT, A://TERNIT, A:// (alone), "A Protocol"

---

### 5. NPM Package Scope

**Official:** `@allternit/` (lowercase)

| Old | New |
|-----|-----|
| @allternit/sdk | @allternit/sdk |
| @allternit/types | @allternit/types |
| @allternit/runtime | @allternit/runtime |
| @allternit/shell-electron | @allternit/shell-electron |

**NEVER USE:** @allternit/, @allternit/

---

### 6. Rust Crate Names

**Official:** `allternit-` prefix (lowercase, hyphen)

| Old | New |
|-----|-----|
| allternit-sdk-core | allternit-sdk-core |
| allternit-messaging | allternit-messaging |
| allternit-runtime | allternit-runtime |
| allternit-driver-interface | allternit-driver-interface |

**NEVER USE:** allternit-*, allternit-*

---

### 7. Bundle IDs (macOS/iOS)

**Official:** `com.allternit.` (reverse domain notation)

| Old | New |
|-----|-----|
| com.allternit.platform | com.allternit.platform |
| com.allternit.desktop | com.allternit.desktop |
| com.allternit.gizzi | com.allternit.gizzi |

**NEVER USE:** com.allternit.*, com.allternit.*

---

### 8. Domains

**Official:** `allternit.com` (primary domain)

| Purpose | Old Domain | New Domain |
|---------|-----------|------------|
| Main website | allternit.com | allternit.com |
| Documentation | docs.allternit.com | docs.allternit.com |
| Install scripts | install.allternit.com | install.allternit.com |
| API | api.allternit.com | api.allternit.com |
| Control plane | control.allternit.com | control.allternit.com |
| Kernel sync | kernel.allternit.com | kernel.allternit.com |
| Platform website | allternit.com | gizziio.com |
| Platform auth | platform.allternit.com | platform.gizziio.com |

**NEVER USE:** allternit.com, allternit.com, allternit.xyz

---

## 🎨 VISUAL IDENTITY

### Logo

**Primary Logo:**
```
A://TERNIT
```

**Typography:**
- Font: Monospace
- Weight: Bold (700)
- Color: `#D97757` (orange)

**SVG Example:**
```svg
<text x="0" y="0" font-family="monospace" font-size="20" font-weight="700" fill="#D97757">A://TERNIT</text>
```

**NEVER USE:** A://TERNIT, A://TERNIT, A:// (alone without TERNIT)

---

### Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Primary Orange | `#D97757` | Logo, primary accents |
| Dark Background | `#0A0A0A` | Main backgrounds |
| Light Text | `#E5E5E5` | Primary text |
| Muted Gray | `#9B9B9B` | Secondary text |
| Gold/Yellow | `#F6C453` | Status chips, highlights |

---

## 📝 USAGE BY CONTEXT

### Code Comments

```typescript
// ✅ CORRECT:
// Allternit Protocol command handler
// a:// is the Allternit Protocol URI scheme
if (input.startsWith('a://browser')) {
  context.mode = 'vision';
}

// ❌ WRONG - NEVER DO THIS:
// allternit command handler
// Handling a:// and @ triggers
// allternit protocol
```

### UI Messages

```typescript
// ✅ CORRECT:
const MESSAGES = [
  'A://TERNIT ready. Keep the diff small and the bragging rights large.',
  'A://TERNIT means business. Also mild sarcasm. Mostly business.',
  'A://TERNIT agent sync complete. We can move now, but we still move clean.',
] as const;

// ❌ WRONG - NEVER DO THIS:
const MESSAGES = [
  'A://TERNIT ready...',
  'A://TERNIT agent sync.',
  'A://TERNIT ready.',  // Too ambiguous
  'A Protocol ready.',  // Ambiguous
];
```

### Package Configuration

```json
// ✅ CORRECT (package.json):
{
  "name": "@allternit/sdk",
  "description": "Allternit SDK",
  "author": "Allternit Team <team@allternit.com>",
  "homepage": "https://allternit.com"
}

// ❌ WRONG - NEVER DO THIS:
{
  "name": "@allternit/sdk",
  "author": "allternit Team",
  "homepage": "https://allternit.com"
}
```

### Rust Configuration

```toml
# ✅ CORRECT (Cargo.toml):
[package]
name = "allternit-sdk-core"
authors = ["Allternit Team <team@allternit.com>"]
repository = "https://github.com/allternit/allternit"

# ❌ WRONG - NEVER DO THIS:
[package]
name = "allternit-sdk-core"
authors = ["Allternit Team <team@allternit.com>"]
repository = "https://github.com/allternit/allternit"
```

### Documentation

```markdown
# ✅ CORRECT:

## Building with Allternit Protocol

The Allternit Protocol (`a://`) defines a standard for runtime commands.

### A://TERNIT Commands

Commands use the `a://` URI scheme:

```bash
a://browser open https://example.com
```

# ❌ WRONG - NEVER DO THIS:

## Building with allternit

The allternit protocol (allternit) provides...
```

---

## 🚫 PROHIBITED PATTERNS

### NEVER Use These Patterns

| Pattern | Why Prohibited | Replacement |
|---------|---------------|-------------|
| `allternit` | Old company name | `allternit` |
| `allternit` | Old product name | `allternit` |
| `allternit` | Legacy brand | `allternit` |
| `allternit` (standalone) | Ambiguous abbreviation | `allternit` |
| `A://TERNIT` | Old ASCII logo | `A://TERNIT` |
| `A://TERNIT` | Old ASCII logo | `A://TERNIT` |
| `A://` (alone in UI) | Ambiguous | `A://TERNIT` |
| `A Protocol` | Ambiguous, looks like variable | `A://TERNIT` |
| `@allternit/` | Old NPM scope | `@allternit/` |
| `@allternit/` | Old NPM scope | `@allternit/` |
| `allternit-*` (crates) | Old Rust prefix | `allternit-*` |
| `allternit-*` | Old Rust prefix | `allternit-*` |
| `com.allternit.*` | Old bundle ID | `com.allternit.*` |
| `com.allternit.*` | Old bundle ID | `com.allternit.*` |
| `allternit.com` | Old domain | `allternit.com` |
| `allternit.com` | Old domain | `gizziio.com` |

---

## ✅ APPROVED PATTERNS

### Always Use These Patterns

| Pattern | Context | Example |
|---------|---------|---------|
| `allternit` | Company/product | "Welcome to allternit" |
| `Allternit Protocol` | Formal protocol | "Built on Allternit Protocol" |
| `a://` | URI scheme | `a://browser open ...` |
| `A://TERNIT` | Visual brand | "A://TERNIT ready" |
| `@allternit/` | NPM scope | `@allternit/sdk` |
| `allternit-*` | Rust crates | `allternit-sdk-core` |
| `com.allternit.*` | Bundle IDs | `com.allternit.platform` |
| `allternit.com` | Main domain | `https://allternit.com` |
| `docs.allternit.com` | Docs domain | `https://docs.allternit.com` |
| `gizziio.com` | Platform | `https://gizziio.com` |
| `platform.gizziio.com` | Auth | `https://platform.gizziio.com` |

---

## 🔧 MIGRATION REFERENCE

### File-by-File Changes Required

#### 1. Root Configuration Files

**package.json:**
```json
{
  "name": "allternit",
  "description": "Allternit - AI Governance and Workflow System",
  "author": "Allternit Team <team@allternit.com>"
}
```

**Cargo.toml:**
```toml
[workspace.package]
repository = "https://github.com/allternit/allternit"
authors = ["Allternit Team <team@allternit.com>"]

[workspace.dependencies]
allternit-sdk-core = { path = "packages/@allternit/sdk/typescript/sdk-core" }
```

#### 2. Distribution Scripts

**build-electron.sh:**
```bash
# Bundle ID
BUNDLE_ID="com.allternit.desktop"

# Binary names
BINARY_NAME="allternit"
API_BINARY="allternit-api"
```

#### 3. UI Components

**CodeLaunchBranding.tsx:**
```typescript
const MESSAGES = [
  'A://TERNIT ready. Keep the diff small.',
  'A://TERNIT means business.',
] as const;
```

**favicon.svg:**
```svg
<svg viewBox="0 0 80 30">
  <text x="4" y="22" font-family="monospace" font-size="13" font-weight="700" fill="#D97757">A://TERNIT</text>
</svg>
```

#### 4. LaunchAgents

**com.allternit.platform.plist:**
```xml
<key>Label</key>
<string>com.allternit.platform</string>
```

#### 5. Native Messaging Hosts

**com.allternit.desktop.json:**
```json
{
  "name": "com.allternit.desktop",
  "description": "Allternit Native Messaging Host"
}
```

---

## 📊 BREAKAGE RISK MITIGATION

### CRITICAL RISK (System Breaking)

**Files:**
- package.json (root and all packages)
- Cargo.toml (root and all crates)
- pnpm-workspace.yaml
- bun.lock (will regenerate)
- Build scripts (.sh files)
- LaunchAgent plists
- Native messaging JSON configs

**Mitigation:**
1. Update ALL config files BEFORE building
2. Delete node_modules, run `pnpm install`
3. Delete Cargo.lock, run `cargo build`
4. Regenerate bun.lock automatically
5. Test all imports after changes

**Testing:**
```bash
# After changes
cd ~/Desktop/allternit-workspace/allternit
rm -rf node_modules
pnpm install
cargo build
pnpm test
```

### HIGH RISK (User Visible)

**Files:**
- Electron menu files
- UI components with logos
- App page components
- Favicon
- Domain URLs in code

**Mitigation:**
1. Update all UI text before release
2. Replace all logo assets
3. Update all hardcoded URLs
4. Test all user-facing screens

**Testing:**
```bash
# Search for missed references
grep -r "allternit" surfaces/ --include="*.tsx" --include="*.ts"
grep -r "A://TERNIT" surfaces/ --include="*.tsx" --include="*.ts"
```

### MEDIUM RISK (Runtime Logic)

**Files:**
- Database connection strings
- Function/service IDs
- Rust crate imports
- API endpoints

**Mitigation:**
1. Update database paths
2. Update all function IDs
3. Update all import statements
4. Test all API calls

**Testing:**
```bash
# Verify imports work
pnpm build
cargo test

# Check database connections
# Test API endpoints
```

### LOW RISK (Documentation)

**Files:**
- .md documentation files
- Comments in code
- Schema $id URLs

**Mitigation:**
1. Update all documentation titles
2. Update inline comments
3. Update schema identifiers

**Testing:**
```bash
# Verify docs build
# Check for broken links
```

---

## 🛡️ ENFORCEMENT

### For AI Agents

**DIRECTIVE:** When working with this codebase, ALWAYS:

1. Use `allternit` for company/product names
2. Use `Allternit Protocol` for formal protocol references
3. Use `a://` for URI schemes in code
4. Use `A://TERNIT` for visual branding in UI
5. Use `@allternit/` for NPM packages
6. Use `allternit-*` for Rust crates
7. Use `com.allternit.*` for bundle IDs
8. Use `allternit.com` for domains

**NEVER:**
- Suggest using old branding
- Revert branding changes
- Use ambiguous abbreviations
- Mix old and new branding

### For Developers

**Code Review Checklist:**
- [ ] No `allternit` in code
- [ ] No `allternit` in code
- [ ] No `@allternit/` imports
- [ ] No `allternit-*` crate names
- [ ] No `com.allternit.*` bundle IDs
- [ ] No `A://TERNIT` in UI
- [ ] No old domains in URLs

### Automated Checks

Add to CI/CD:
```yaml
# .github/workflows/brand-check.yml
name: Brand Compliance Check

on: [push, pull_request]

jobs:
  brand-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Check for old branding
        run: |
          ! grep -r "allternit" --include="*.ts" --include="*.tsx" --include="*.json" . || exit 1
          ! grep -r "allternit" --include="*.ts" --include="*.tsx" --include="*.json" . || exit 1
          ! grep -r "A://TERNIT" --include="*.ts" --include="*.tsx" . || exit 1
```

---

## 📞 REFERENCE DOCUMENTS

| Document | Purpose |
|----------|---------|
| `ALLTERNIT_MIGRATION_PLAN.md` | Complete migration plan |
| `allternit-migration/README.md` | Quick reference |
| `allternit-migration/BRAND_GUIDELINES.md` | Brand usage guidelines |
| `allternit-migration/A_PROTOCOL_BRANDING.md` | A://TERNIT concept |
| `allternit-migration/BRAND_EVOLUTION.md` | Brand journey |
| `allternit-migration/THIS_SUMMARY.md` | Migration summary |
| `allternit-migration/A_PROTOCOL_USAGE.md` | a:// usage analysis |

---

## 🔄 VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-29 | Initial definitive brand authority |

---

## ✨ ACKNOWLEDGMENT

**By working with this codebase, you acknowledge that:**

1. The old branding (allternit, allternit, allternit) is DEPRECATED
2. The new branding (allternit, Allternit Protocol, A://TERNIT) is MANDATORY
3. This document is the SINGLE SOURCE OF TRUTH
4. Deviations from this standard are NOT PERMITTED

---

**END OF BRAND AUTHORITY DOCUMENT**
