#!/bin/bash
#
# Node.js + TypeScript Project Initialization Script
# This script sets up a new TypeScript project structure
#

set -e

echo "🚀 Initializing Node.js + TypeScript project..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Get project info from environment or defaults
PROJECT_NAME="${PROJECT_NAME:-$(basename $(pwd))}"
PROJECT_DESCRIPTION="${PROJECT_DESCRIPTION:-A modern TypeScript project}"
PACKAGE_MANAGER="${PACKAGE_MANAGER:-pnpm}"
ENABLE_TESTS="${ENABLE_TESTS:-true}"

log_info "Project: $PROJECT_NAME"
log_info "Package Manager: $PACKAGE_MANAGER"
log_info "Tests Enabled: $ENABLE_TESTS"

# Create project directories
echo ""
log_info "Creating project structure..."

mkdir -p src
mkdir -p test
mkdir -p dist
touch .gitignore

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Build output
dist/
build/
*.tsbuildinfo

# Testing
coverage/
.nyc_output/

# Environment variables
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Runtime
pids/
*.pid
*.seed
*.pid.lock

# Misc
.cache/
.temp/
.tmp/
.eslintcache
.prettiercache
EOF

log_success "Created .gitignore"

# Create package.json from template
log_info "Generating package.json..."

if [ -f ".devcontainer/config/package.json.template" ]; then
    cp .devcontainer/config/package.json.template package.json
    # Replace placeholders
    sed -i "s/{{PROJECT_NAME}}/$PROJECT_NAME/g" package.json
    sed -i "s/{{PROJECT_DESCRIPTION}}/$PROJECT_DESCRIPTION/g" package.json
else
    log_warning "Template not found, creating minimal package.json"
    cat > package.json << EOF
{
  "name": "$PROJECT_NAME",
  "version": "1.0.0",
  "description": "$PROJECT_DESCRIPTION",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write \"src/**/*.ts\"",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "tsx": "^4.7.0",
    "vitest": "^1.2.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0"
  }
}
EOF
fi

log_success "Created package.json"

# Copy TypeScript config
log_info "Setting up TypeScript configuration..."
if [ -f ".devcontainer/config/tsconfig.json" ]; then
    cp .devcontainer/config/tsconfig.json tsconfig.json
else
    log_warning "tsconfig.json template not found, creating default"
    cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
fi
log_success "Created tsconfig.json"

# Copy ESLint config
log_info "Setting up ESLint configuration..."
if [ -f ".devcontainer/config/.eslintrc.json" ]; then
    cp .devcontainer/config/.eslintrc.json .eslintrc.json
else
    log_warning ".eslintrc.json template not found, creating default"
    cat > .eslintrc.json << 'EOF'
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ]
}
EOF
fi
log_success "Created .eslintrc.json"

# Copy Prettier config
log_info "Setting up Prettier configuration..."
if [ -f ".devcontainer/config/.prettierrc" ]; then
    cp .devcontainer/config/.prettierrc .prettierrc
else
    log_warning ".prettierrc template not found, creating default"
    cat > .prettierrc << 'EOF'
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all"
}
EOF
fi
log_success "Created .prettierrc"

# Create vitest.config.ts
log_info "Setting up Vitest configuration..."
cat > vitest.config.ts << 'EOF'
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'test/',
        '**/*.d.ts',
        '**/*.config.ts',
      ],
    },
  },
});
EOF
log_success "Created vitest.config.ts"

# Create EditorConfig
log_info "Creating EditorConfig..."
cat > .editorconfig << 'EOF'
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.{yml,yaml}]
indent_size = 2
EOF
log_success "Created .editorconfig"

# Create sample source files
log_info "Creating sample source files..."

# Main entry point
cat > src/index.ts << 'EOF'
/**
 * Main entry point
 */

export function greet(name: string): string {
  return `Hello, ${name}! 👋`;
}

export function main(): void {
  const message = greet('TypeScript');
  console.log(message);
  console.log('Your development environment is ready! 🚀');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
EOF

# Example utility module
cat > src/utils.ts << 'EOF'
/**
 * Utility functions
 */

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format a date to ISO string
 */
export function formatDate(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Check if a value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
EOF

log_success "Created source files"

# Create test files
if [ "$ENABLE_TESTS" = "true" ]; then
    log_info "Creating test files..."
    
    cat > test/index.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import { greet } from '../src/index';

describe('index', () => {
  describe('greet', () => {
    it('should greet with the provided name', () => {
      expect(greet('World')).toBe('Hello, World! 👋');
    });

    it('should handle empty string', () => {
      expect(greet('')).toBe('Hello, ! 👋');
    });
  });
});
EOF

    cat > test/utils.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import { sleep, formatDate, isDefined } from '../src/utils';

describe('utils', () => {
  describe('sleep', () => {
    it('should resolve after the specified time', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });
  });

  describe('formatDate', () => {
    it('should format date as ISO string', () => {
      const date = new Date('2024-01-15');
      expect(formatDate(date)).toBe('2024-01-15T00:00:00.000Z');
    });

    it('should use current date when none provided', () => {
      const result = formatDate();
      expect(() => new Date(result)).not.toThrow();
    });
  });

  describe('isDefined', () => {
    it('should return true for defined values', () => {
      expect(isDefined(0)).toBe(true);
      expect(isDefined('')).toBe(true);
      expect(isDefined(false)).toBe(true);
      expect(isDefined({})).toBe(true);
    });

    it('should return false for null and undefined', () => {
      expect(isDefined(null)).toBe(false);
      expect(isDefined(undefined)).toBe(false);
    });
  });
});
EOF

    log_success "Created test files"
fi

# Install dependencies
echo ""
log_info "Installing dependencies with $PACKAGE_MANAGER..."

case $PACKAGE_MANAGER in
    pnpm)
        pnpm install
        ;;
    npm)
        npm install
        ;;
    yarn)
        yarn install
        ;;
    *)
        log_error "Unknown package manager: $PACKAGE_MANAGER"
        exit 1
        ;;
esac

log_success "Dependencies installed"

# Initialize git repository
if [ ! -d ".git" ]; then
    log_info "Initializing git repository..."
    git init
    git branch -m main 2>/dev/null || true
    
    # Initial commit
    git add .
    git commit -m "chore: initial commit" -m "Setup Node.js + TypeScript development environment"
    
    log_success "Git repository initialized"
fi

# Setup husky
log_info "Setting up Git hooks..."
if [ -d "node_modules/husky" ]; then
    npx husky 2>/dev/null || true
    
    # Create pre-commit hook
    if [ -d ".husky" ]; then
        cat > .husky/pre-commit << 'HUSKYEOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx lint-staged
HUSKYEOF
        chmod +x .husky/pre-commit
        log_success "Created pre-commit hook"
        
        # Create commit-msg hook
        cat > .husky/commit-msg << 'HUSKYEOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Conventional commit format check
commit_msg_file=$1
commit_msg=$(head -n1 "$commit_msg_file")

# Allow merge commits and revert commits
if echo "$commit_msg" | grep -qE "^Merge |^Revert |^fixup! |^squash! "; then
    exit 0
fi

# Check conventional commit format
if ! echo "$commit_msg" | grep -qE "^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+\))?!?: .+"; then
    echo "❌ Invalid commit message format."
    echo ""
    echo "Commit message must follow Conventional Commits:"
    echo "  type(scope): message"
    echo ""
    echo "Types: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert"
    echo ""
    echo "Example: feat(auth): add login functionality"
    exit 1
fi
HUSKYEOF
        chmod +x .husky/commit-msg
        log_success "Created commit-msg hook"
    fi
fi

# Create README
log_info "Creating README.md..."
cat > README.md << EOF
# $PROJECT_NAME

$PROJECT_DESCRIPTION

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) (recommended) or npm/yarn

### Installation

\`\`\`bash
# Install dependencies
$PACKAGE_MANAGER install

# Start development server
$PACKAGE_MANAGER dev
\`\`\`

## 📜 Available Scripts

| Script | Description |
|--------|-------------|
| \`dev\` | Start development server with hot reload |
| \`build\` | Compile TypeScript to JavaScript |
| \`start\` | Run compiled application |
| \`test\` | Run tests in watch mode |
| \`test:coverage\` | Run tests with coverage report |
| \`lint\` | Lint source files |
| \`lint:fix\` | Lint and fix source files |
| \`format\` | Format code with Prettier |
| \`typecheck\` | Type check without emitting |

## 📁 Project Structure

\`\`\`
.
├── src/              # Source code
│   └── index.ts      # Entry point
├── test/             # Test files
│   └── *.test.ts     # Unit tests
├── dist/             # Compiled output (gitignored)
├── package.json      # Project configuration
├── tsconfig.json     # TypeScript configuration
├── .eslintrc.json    # ESLint configuration
└── .prettierrc       # Prettier configuration
\`\`\`

## 🧪 Testing

This project uses [Vitest](https://vitest.dev/) for testing:

\`\`\`bash
# Run tests
$PACKAGE_MANAGER test

# Run tests with coverage
$PACKAGE_MANAGER test:coverage

# Run tests with UI
$PACKAGE_MANAGER test:ui
\`\`\`

## 📝 Code Quality

- **ESLint**: Linting for TypeScript
- **Prettier**: Code formatting
- **TypeScript**: Static type checking
- **Husky**: Git hooks for pre-commit checks

## 📄 License

MIT
EOF

log_success "Created README.md"

# Final summary
echo ""
echo "========================================"
log_success "Project initialized successfully! 🎉"
echo "========================================"
echo ""
echo "📁 Project: $PROJECT_NAME"
echo "📦 Package Manager: $PACKAGE_MANAGER"
echo "🧪 Tests: $ENABLE_TESTS"
echo ""
echo "Next steps:"
echo "  1. cd /workspace"
echo "  2. $PACKAGE_MANAGER dev"
echo ""
