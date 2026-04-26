# Allternit Plugin CLI Guide

## Installation

```bash
npm install -g @allternit/plugin-sdk

# Verify
allternit-plugin --version
```

---

## Three Ways to Create Plugins

### 1️⃣ From Scratch (No Template)

Create a blank plugin with skeleton code and TODOs.

```bash
# Interactive creation
allternit-plugin create my-plugin

# With options
allternit-plugin create my-plugin \
  --category analyze \
  --adapters mcp,cli

# Output:
# my-plugin/
#   src/index.ts      # Skeleton with TODOs
#   manifest.json
#   package.json
#   tsconfig.json
#   README.md
```

**Best for:** Building completely custom plugins.

---

### 2️⃣ From Template (Scaffold)

Use an existing template as a starting point for customization.

```bash
# Use market-research template as base
allternit-plugin create my-research --template market-research

# Specify templates directory
allternit-plugin create my-analyzer \
  --template market-research \
  --templates-dir ./my-templates

# Output:
# my-research/
#   src/index.ts              # Plugin wrapper
#   docs/original-template.txt # Original template for reference
#   manifest.json
#   ...
```

**What happens:**
- Template code is saved to `docs/original-template.txt`
- `src/index.ts` is generated with plugin wrapper
- You adapt the template logic to PluginHost interface

**Best for:** Developers who want to customize existing templates.

---

### 3️⃣ Convert Existing Templates (Batch)

Convert all your templates to ready-to-use plugins at once.

```bash
# Convert single template
allternit-plugin convert \
  --input ./templates/MarketResearchCard.tsx \
  --output ./plugins/market-research-plugin

# Batch convert all templates
allternit-plugin convert-all \
  --input ./templates \
  --output ./plugins \
  --adapters mcp,http,cli

# Or use the script
./scripts/convert-all.sh
```

**Output:**
```
plugins/
  market-research-plugin/
  code-review-plugin/
  image-gen-plugin/
  ... (76 plugins)
```

**Best for:** Publishing template library as installable plugins.

---

## Command Reference

### `create` - Create New Plugin

```bash
allternit-plugin create <name> [options]

Options:
  -t, --template <name>       Use template as starting point
  -d, --templates-dir <path>  Templates directory (default: /Users/macbook/allternit/templates)
  --adapters <list>           Comma-separated adapters (default: mcp,http,cli)
  --category <type>           Plugin category (default: custom)

Examples:
  # From scratch
  allternit-plugin create my-tool

  # From template
  allternit-plugin create my-tool --template market-research

  # Specific adapters only
  allternit-plugin create my-tool --adapters mcp,cli
```

---

### `convert` - Convert Single Template

```bash
allternit-plugin convert [options]

Options:
  -i, --input <file>    Template file path (required)
  -o, --output <dir>    Output directory (required)

Examples:
  allternit-plugin convert \
    -i ./templates/MarketResearchCard.tsx \
    -o ./plugins/market-research-plugin
```

---

### `convert-all` - Batch Convert

```bash
allternit-plugin convert-all [options]

Options:
  -i, --input <dir>     Templates directory (required)
  -o, --output <dir>    Output directory (required)
  --adapters <list>     Adapters to include (default: mcp,http,cli)

Examples:
  allternit-plugin convert-all \
    -i ./templates \
    -o ./plugins \
    --adapters mcp,http,cli,vscode
```

---

### `run` - Execute Plugin

```bash
allternit-plugin run [plugin] [options]

Options:
  -i, --input <text>    Input text or JSON
  --stdin               Read input from stdin
  -a, --adapter <type>  Adapter type (default: cli)

Examples:
  # Run with text input
  allternit-plugin run market-research --input "electric vehicles"

  # Run with JSON input
  allternit-plugin run market-research --input '{"topic":"AI"}'

  # Run from stdin
  echo '{"topic":"AI"}' | allternit-plugin run market-research --stdin

  # Run local plugin
  allternit-plugin run ./my-plugin --input "test"
```

---

### `serve` - Start HTTP Server

```bash
allternit-plugin serve [options]

Options:
  -p, --port <number>   Port number (default: 3000)
  -h, --host <address>  Host address (default: 0.0.0.0)
  --adapter <type>      Server adapter (default: http)

Examples:
  # Default server
  allternit-plugin serve

  # Custom port
  allternit-plugin serve --port 8080

  # Production
  allternit-plugin serve --host 0.0.0.0 --port 80
```

Endpoints:
- `GET /v1/plugins` - List available plugins
- `POST /v1/execute/:id` - Execute a plugin
- `GET /v1/plugins/:id/manifest` - Get plugin manifest

---

### `validate` - Check Plugin

```bash
allternit-plugin validate [plugin]

Examples:
  # Validate current directory
  cd my-plugin && allternit-plugin validate

  # Validate specific plugin
  allternit-plugin validate ./my-plugin

  # Validate all in directory
  for d in */; do allternit-plugin validate "$d"; done
```

---

### `package` - Create Distribution

```bash
allternit-plugin package [plugin] [options]

Options:
  -o, --output <file>   Output file name

Examples:
  # Package current directory
  cd my-plugin && allternit-plugin package

  # Package with custom name
  allternit-plugin package my-plugin --output my-plugin-v1.allp
```

---

## Workflow Examples

### Scenario A: Template Library Owner (You)

```bash
# 1. Convert all 76 templates to plugins
./scripts/convert-all.sh

# 2. Review and customize each
vim plugins/market-research-plugin/src/index.ts

# 3. Build all
for d in plugins/*/; do
  (cd "$d" && npm install && npm run build)
done

# 4. Publish to NPM
for d in plugins/*/; do
  (cd "$d" && npm publish --access public)
done
```

### Scenario B: Developer Using Templates

```bash
# 1. Scaffold from template
allternit-plugin create my-research --template market-research

# 2. Customize
cd my-research
vim src/index.ts  # Adapt template logic
vim manifest.json # Update parameters

# 3. Build
npm install
npm run build

# 4. Test
allternit-plugin run --input "test topic"

# 5. Publish
npm publish --access public
```

### Scenario C: End User (No Coding)

```bash
# 1. Install SDK
npm install -g @allternit/plugin-sdk

# 2. Install plugins
npm install -g @allternit/market-research-plugin
npm install -g @allternit/code-review-plugin

# 3. Use in Claude Desktop
# (Add to claude_desktop_config.json)

# 4. Or use via CLI
allternit-plugin run market-research --input "AI assistants"
```

---

## File Structure Comparison

### From Scratch (`create`)
```
my-plugin/
├── src/
│   └── index.ts          # Skeleton with TODOs
├── manifest.json         # Basic structure
├── package.json
├── tsconfig.json
└── README.md             # Generic template
```

### From Template (`create --template`)
```
my-plugin/
├── src/
│   └── index.ts          # Plugin wrapper
├── docs/
│   └── original-template.txt  # Original template code
├── manifest.json         # Based on template
├── package.json
├── tsconfig.json
└── README.md             # References template
```

### Converted Template (`convert`)
```
market-research-plugin/
├── src/
│   └── index.ts          # Fully converted plugin
├── manifest.json         # Complete manifest
├── package.json          # Ready to publish
├── tsconfig.json
└── README.md             # Usage instructions
```

---

## Environment Variables

```bash
# Templates directory
export ALLTERNIT_TEMPLATES_DIR=/path/to/templates

# Default adapters
export ALLTERNIT_DEFAULT_ADAPTERS=mcp,http,cli

# Plugin registry URL (for custom registry)
export ALLTERNIT_REGISTRY=https://registry.mycompany.com
```

---

## Troubleshooting

### "Template not found"
```bash
# Check templates directory
ls $ALLTERNIT_TEMPLATES_DIR

# Or specify explicitly
allternit-plugin create my-plugin --template X --templates-dir ./templates
```

### "Cannot find module"
```bash
# Install dependencies
cd my-plugin
npm install

# Or link SDK locally
npm link @allternit/plugin-sdk
```

### "Build errors"
```bash
# Check TypeScript
npx tsc --version

# Clean build
rm -rf dist/
npm run build
```

---

## Quick Reference Card

```bash
# Create
allternit-plugin create my-plugin                    # From scratch
allternit-plugin create my-plugin -t market-research # From template

# Convert
allternit-plugin convert -i template.tsx -o ./plugin     # Single
allternit-plugin convert-all -i ./templates -o ./plugins # Batch

# Run
allternit-plugin run my-plugin --input "test"
allternit-plugin run ./my-plugin --input '{"key":"val"}'

# Server
allternit-plugin serve --port 3000

# Validate
allternit-plugin validate
allternit-plugin validate ./my-plugin
```
