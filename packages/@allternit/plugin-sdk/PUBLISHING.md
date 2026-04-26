# Publishing Guide

## NPM Package Publishing

### Prerequisites

1. **NPM Account**
   ```bash
   npm login
   # Enter your username, password, and email
   ```

2. **Organization Access**
   - Ensure you have access to `@allternit` scope
   - Or use your own scope (e.g., `@yourname/plugin-sdk`)

### Manual Publishing

```bash
# 1. Update version (patch, minor, or major)
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0

# 2. Build the package
npm run build

# 3. Test
npm test

# 4. Publish to NPM
npm publish --access public

# 5. Push git tags
git push && git push --tags
```

### Automated Publishing (GitHub Actions)

The repository includes automatic publishing:

1. **Push a version tag:**
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

2. **GitHub Actions will:**
   - Build the package
   - Run tests
   - Publish to NPM
   - Create GitHub Release

### NPM Token Setup

1. Go to [npmjs.com](https://www.npmjs.com) → Access Tokens → Generate New Token
2. In GitHub repo → Settings → Secrets → New repository secret
3. Add `NPM_TOKEN` with your npm token

### Package Structure

What gets published to NPM:

```
@allternit/plugin-sdk/
├── dist/              # Compiled JavaScript
│   ├── index.js
│   ├── types.js
│   └── adapters/
│       ├── mcp/
│       ├── http/
│       ├── cli/
│       ├── vscode/
│       └── langchain/
├── bin/               # CLI scripts
│   └── allternit-plugin.js
├── README.md
├── LICENSE
└── package.json
```

## Converting & Publishing Your 76 Templates

### Step 1: Convert Templates

```bash
# Install SDK globally
npm install -g @allternit/plugin-sdk

# Convert your templates
cd /path/to/allternit-platform

allternit-plugin convert \
  --input src/components/chat/TemplatePreviewCards.tsx \
  --output ../../allternit-plugins
```

### Step 2: Individual Plugin Packages

Each of the 76 plugins can be published separately:

```bash
cd allternit-plugins/market-research

# Initialize npm package
npm init -y

# Update package.json
{
  "name": "@allternit/plugin-market-research",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@allternit/plugin-sdk": "^1.0.0"
  }
}

# Publish
npm publish --access public
```

### Step 3: Plugin Registry

Create a meta-package that lists all 76 plugins:

```json
// @allternit/plugins/package.json
{
  "name": "@allternit/plugins",
  "version": "1.0.0",
  "description": "All 76 Allternit plugins",
  "dependencies": {
    "@allternit/plugin-market-research": "^1.0.0",
    "@allternit/plugin-competitor-intel": "^1.0.0",
    "@allternit/plugin-code-react": "^1.0.0",
    "...": "..."
  }
}
```

Users can install all plugins:
```bash
npm install @allternit/plugins
```

## Distribution Channels

### 1. NPM Registry (Primary)

```bash
# Public packages
npm publish --access public

# Scoped packages (recommended)
npm publish --access public --scope @allternit
```

### 2. GitHub Packages

```json
// package.json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

### 3. Private Registry

```bash
# Verdaccio, Artifactory, etc.
npm config set registry https://private.registry.com
npm publish
```

### 4. GitHub Releases

Upload `.allp` files to GitHub Releases:

```bash
# Package plugin
allternit-plugin package ./market-research -o market-research-v1.0.0.allp

# Upload to GitHub Release (manual or via CI)
```

## Versioning Strategy

### Semantic Versioning

- **Patch** (1.0.1): Bug fixes, docs updates
- **Minor** (1.1.0): New features, backwards compatible
- **Major** (2.0.0): Breaking changes

### SDK vs Plugins

| Package | Version | Strategy |
|---------|---------|----------|
| `@allternit/plugin-sdk` | 1.x.x | Stable SDK |
| `@allternit/plugin-*` | Match SDK | Update with SDK changes |

### Changelog

Maintain `CHANGELOG.md`:

```markdown
# Changelog

## [1.0.1] - 2024-01-15
### Fixed
- CLI argument parsing
- HTTP adapter CORS

## [1.0.0] - 2024-01-10
### Added
- Initial release
- 6 adapters (MCP, HTTP, CLI, VS Code, LangChain, Native)
- CLI tool
```

## Testing Before Publish

```bash
# Link locally
npm link

# Test in another project
cd /tmp/test-project
npm link @allternit/plugin-sdk

# Test CLI
npx allternit-plugin --help

# If good, unlink and publish
cd /path/to/plugin-sdk
npm unlink
npm publish
```

## Troubleshooting

### "You do not have permission"
```bash
# Ensure you're logged in
npm login

# Check who you are
npm whoami
```

### "Package name too similar"
```bash
# Use scoped package
npm publish --scope @allternit
```

### "Cannot find module"
```bash
# Ensure dist/ exists
npm run build
ls dist/
```

## Checklist Before Publishing

- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] Version updated in `package.json`
- [ ] `CHANGELOG.md` updated
- [ ] README.md has install instructions
- [ ] `.npmignore` or `files` in package.json correct
- [ ] NPM_TOKEN set in GitHub secrets (for CI)
- [ ] Tagged release: `git tag v1.0.0`

## Post-Publish

1. **Verify on NPM:**
   ```bash
   npm view @allternit/plugin-sdk
   ```

2. **Test installation:**
   ```bash
   npm install -g @allternit/plugin-sdk
   allternit-plugin --version
   ```

3. **Update documentation:**
   - Add version badge to README
   - Update installation instructions
   - Announce release

4. **Monitor issues:**
   - Watch GitHub issues
   - Respond to NPM feedback
