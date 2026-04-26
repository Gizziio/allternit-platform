# Node.js + TypeScript Environment Template

A modern, production-ready development environment for Node.js with TypeScript.

## ✨ Features

- **Node.js 20 LTS** - Latest stable Node.js version
- **TypeScript 5.3** - Full type safety with strict mode
- **pnpm** - Fast, disk space efficient package manager
- **Vitest** - Next generation testing framework
- **ESLint + Prettier** - Code quality and formatting
- **tsx** - TypeScript execution and hot reload
- **Husky + lint-staged** - Git hooks for code quality
- **Conventional Commits** - Structured commit messages

## 🚀 Quick Start

### Using Dev Container (Recommended)

1. Open the project in VS Code
2. Press `F1` → "Dev Containers: Reopen in Container"
3. Wait for the container to build and initialize
4. The project will be automatically set up

### Manual Setup

```bash
# Copy template files to your project
cp -r nodejs-typescript/* /path/to/your/project/

# Build and start the container
cd /path/to/your/project
docker-compose up -d

# Initialize the project
docker-compose exec nodejs-dev bash /workspace/.devcontainer/scripts/init-project.sh
```

## 📁 Template Structure

```
nodejs-typescript/
├── template.json           # Template metadata and configuration
├── Dockerfile              # Container image definition
├── docker-compose.yml      # Multi-service orchestration
├── devcontainer.json       # VS Code Dev Container config
├── config/                 # Configuration templates
│   ├── package.json.template
│   ├── tsconfig.json
│   ├── .eslintrc.json
│   └── .prettierrc
├── scripts/
│   └── init-project.sh     # Project initialization script
└── README.md               # This file
```

## ⚙️ Configuration Variables

| Variable | Type | Options | Default | Description |
|----------|------|---------|---------|-------------|
| `NODE_VERSION` | select | 18, 20, 21 | 20 | Node.js version to use |
| `PACKAGE_MANAGER` | select | pnpm, npm, yarn | pnpm | Package manager preference |
| `ENABLE_TESTS` | boolean | true, false | true | Include Vitest testing setup |

## 🔧 Generated Project Structure

After initialization, your project will have:

```
your-project/
├── src/
│   ├── index.ts         # Entry point
│   └── utils.ts         # Utility functions
├── test/
│   ├── index.test.ts    # Entry point tests
│   └── utils.test.ts    # Utility tests
├── dist/                # Compiled output
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vitest.config.ts     # Vitest configuration
├── .eslintrc.json       # ESLint rules
├── .prettierrc          # Prettier formatting
├── .editorconfig        # Editor settings
├── .gitignore           # Git ignore patterns
└── .husky/              # Git hooks
    ├── pre-commit
    └── commit-msg
```

## 🐳 Services

The Docker Compose setup includes:

| Service | Port | Description |
|---------|------|-------------|
| `nodejs-dev` | 3000, 8080, 9229 | Main development container |
| `postgres` | 5432 | PostgreSQL database (optional) |
| `redis` | 6379 | Redis cache (optional) |

## 🧪 Testing

Tests are configured with Vitest:

```bash
# Run tests in watch mode
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests with UI
pnpm test:ui
```

## 📜 Conventional Commits

This template enforces [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`

Examples:
```
feat(auth): add JWT authentication
fix(api): handle null response
chore(deps): update dependencies
docs(readme): update installation instructions
```

## 🔍 VS Code Extensions

The devcontainer includes these pre-configured extensions:

- ESLint
- Prettier
- TypeScript Importer
- GitLens
- Vitest Explorer
- GitHub Copilot
- And more...

## 📝 License

MIT - Part of the Allternit Infrastructure templates.
