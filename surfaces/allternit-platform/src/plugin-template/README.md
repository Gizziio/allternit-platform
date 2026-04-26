# 🧩 Allternit Plugin Template

> A production-ready template for creating plugins for the Allternit (Agent-to-Resource) Platform.

[![Use this template](https://img.shields.io/badge/Use%20this%20template-2ea44f?style=for-the-badge&logo=github)](https://github.com/new?template_name=allternit-plugin-template&template_owner=allternit)
[![Validate](https://img.shields.io/github/actions/workflow/status/YOUR_USERNAME/YOUR_REPO/validate.yml?style=for-the-badge&logo=github&label=Validation)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

---

## 🚀 Quick Start

### Option 1: Use GitHub Template (Recommended)

1. Click the **"Use this template"** button above (or [click here](https://github.com/new?template_name=allternit-plugin-template&template_owner=allternit))
2. Choose a name for your repository (e.g., `my-allternit-plugin`)
3. Select **"Create a new repository"**
4. Clone your new repository locally

### Option 2: Clone and Setup Manually

```bash
# Clone the template
git clone https://github.com/allternit/allternit-plugin-template.git my-plugin
cd my-plugin
rm -rf .git
git init
git add .
git commit -m "Initial commit"
```

---

## 🛠️ Setup After Creating From Template

### Step 1: Initialize Your Plugin

Run the initialization script to replace placeholders:

```bash
node scripts/init.js
```

This will prompt you for:
- Plugin name (e.g., `my-awesome-plugin`)
- Display name (e.g., `My Awesome Plugin`)
- Description
- Author name
- Author email
- GitHub username

### Step 2: Customize `plugin.json`

Edit the generated `plugin.json` file to match your plugin's requirements:

```json
{
  "id": "my-awesome-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "description": "Does amazing things",
  "author": "Your Name <you@example.com>",
  "entry": "src/index.js",
  "permissions": ["storage", "network"]
}
```

See [plugin.json documentation](#pluginjson-reference) for all available fields.

### Step 3: Implement Your Plugin

Replace the stub in `src/index.ts` (or `src/index.js`) with your plugin code:

```typescript
import { AllternitPlugin } from '@allternit/platform';

export default class MyPlugin extends AllternitPlugin {
  async onActivate() {
    console.log('My plugin is activated!');
    // Your initialization code here
  }

  async onDeactivate() {
    console.log('My plugin is deactivated!');
    // Your cleanup code here
  }
}
```

### Step 4: Add Documentation

Update `docs/README.md` with:
- Detailed feature descriptions
- Configuration options
- Usage examples
- API documentation

### Step 5: Test Locally

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build plugin
npm run build

# Validate plugin structure
npm run validate
```

---

## 📦 Plugin Structure

```
my-allternit-plugin/
├── .github/
│   └── workflows/
│       └── validate.yml      # CI validation
├── docs/
│   └── README.md             # Plugin documentation
├── examples/
│   └── basic-usage.js        # Usage examples
├── scripts/
│   └── init.js               # Initialization script (deletes itself after run)
├── src/
│   └── index.ts              # Plugin entry point
├── LICENSE                   # MIT License
├── marketplace.json          # Marketplace listing info
├── package.json              # Node.js dependencies
├── plugin.json               # Plugin manifest (REQUIRED)
└── README.md                 # This file
```

---

## 🔧 Plugin.json Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (kebab-case, no spaces) |
| `name` | string | Human-readable display name |
| `version` | string | SemVer version (e.g., "1.0.0") |
| `description` | string | Short description (max 200 chars) |
| `author` | string | Author name and email |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `entry` | string | Entry point file (default: "src/index.js") |
| `permissions` | string[] | Required permissions |
| `dependencies` | object | Plugin dependencies |
| `settings` | object | Configuration schema |
| `icon` | string | Icon path or URL |
| `repository` | string | Git repository URL |
| `homepage` | string | Plugin homepage URL |
| `license` | string | SPDX license identifier |

### Example Complete plugin.json

```json
{
  "id": "data-visualizer",
  "name": "Data Visualizer",
  "version": "1.2.0",
  "description": "Create beautiful charts and graphs from your data",
  "author": "Jane Doe <jane@example.com>",
  "entry": "dist/index.js",
  "icon": "assets/icon.svg",
  "permissions": ["storage", "network", "clipboard"],
  "dependencies": {
    "@allternit/core": "^2.0.0"
  },
  "settings": {
    "theme": {
      "type": "string",
      "enum": ["light", "dark", "auto"],
      "default": "auto",
      "description": "UI theme preference"
    },
    "autoSave": {
      "type": "boolean",
      "default": true,
      "description": "Auto-save charts"
    }
  },
  "repository": "https://github.com/janedoe/allternit-data-visualizer",
  "homepage": "https://janedoe.github.io/allternit-data-visualizer",
  "license": "MIT"
}
```

---

## 🧪 Testing Locally

### Prerequisites

- Node.js 18+ or Bun 1.0+
- Allternit Platform CLI (optional): `npm install -g @allternit/cli`

### Test Commands

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run type checking (TypeScript)
npm run typecheck

# Lint code
npm run lint

# Build for production
npm run build

# Validate plugin manifest
npm run validate

# Full validation (runs all checks)
npm run validate:full
```

### Manual Testing

1. Build your plugin:
   ```bash
   npm run build
   ```

2. Link locally in Allternit Platform:
   ```bash
   allternit plugin link ./dist
   ```

3. Or copy to plugins directory:
   ```bash
   cp -r dist ~/.allternit/plugins/my-awesome-plugin
   ```

---

## 📤 Publishing to Marketplace

### Step 1: Prepare for Release

1. Update version in `plugin.json` and `package.json`
2. Update `CHANGELOG.md` with new features/fixes
3. Commit all changes:
   ```bash
   git add .
   git commit -m "Release v1.0.0"
   ```

### Step 2: Create GitHub Release

1. Go to your repository on GitHub
2. Click **"Create a new release"**
3. Choose a tag (e.g., `v1.0.0`)
4. Add release notes
5. Attach your built plugin (`dist/` folder as zip)
6. Publish release

### Step 3: Submit to Allternit Marketplace

1. Go to [Allternit Marketplace](https://marketplace.allternit.dev)
2. Click **"Submit Plugin"**
3. Fill in the form with your repository URL
4. Your plugin will be reviewed and published

### Automated Publishing (Optional)

Add this workflow to `.github/workflows/publish.yml`:

```yaml
name: Publish
on:
  push:
    tags:
      - 'v*'
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm run validate
      # Add marketplace publishing step here
```

---

## 🎨 Best Practices

### Naming Conventions

- **Plugin ID**: Use kebab-case (e.g., `my-awesome-plugin`)
- **Display Name**: Use Title Case (e.g., `My Awesome Plugin`)
- **Repository**: Prefix with `allternit-` (e.g., `allternit-my-plugin`)

### Versioning

Follow [Semantic Versioning](https://semver.org/):
- `MAJOR.MINOR.PATCH`
- Breaking changes → bump MAJOR
- New features → bump MINOR
- Bug fixes → bump PATCH

### Security

- Never commit secrets or API keys
- Use environment variables for sensitive data
- Validate all user inputs
- Request minimum necessary permissions

### Performance

- Lazy load heavy dependencies
- Use code splitting where possible
- Cache expensive operations
- Profile memory usage

---

## 📚 Documentation Template

Update your `docs/README.md` with:

```markdown
# My Plugin

## Features
- Feature 1: Description
- Feature 2: Description

## Installation
\`\`\`bash
allternit plugin install my-plugin
\`\`\`

## Configuration
\`\`\`json
{
  "setting1": "value1",
  "setting2": "value2"
}
\`\`\`

## Usage
\`\`\`javascript
import { myPlugin } from '@allternit/plugin-my-plugin';

myPlugin.doSomething();
\`\`\`

## API Reference
See [API.md](./API.md)
```

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This template is [MIT](LICENSE) licensed.

---

## 💬 Support

- 📖 [Allternit Platform Documentation](https://docs.allternit.dev)
- 🐛 [Report Issues](https://github.com/allternit/allternit-plugin-template/issues)
- 💬 [Discord Community](https://discord.gg/allternit)

---

<p align="center">
  Made with ❤️ for the Allternit Community
</p>
