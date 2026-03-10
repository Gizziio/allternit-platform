#!/bin/bash
# Full Stack Web Template - Project Initialization Script
# This script sets up a new Next.js project with all dependencies

set -e

echo "🚀 Initializing Full Stack Web Project..."
echo "=========================================="

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

# Check if running in Docker
if [ -f /.dockerenv ]; then
    log_info "Running inside Docker container"
    IN_DOCKER=true
else
    IN_DOCKER=false
fi

# Check Node.js version
log_info "Checking Node.js version..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        log_success "Node.js version: $(node --version)"
    else
        log_error "Node.js 18+ required, found: $(node --version)"
        exit 1
    fi
else
    log_error "Node.js not found"
    exit 1
fi

# Initialize package.json if it doesn't exist
if [ ! -f package.json ]; then
    log_info "Creating package.json..."
    cat > package.json << 'EOF'
{
  "name": "fullstack-web-app",
  "version": "1.0.0",
  "private": true,
  "description": "Full Stack Web Application",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate:dev": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:generate": "prisma generate",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.3.0"
  }
}
EOF
    log_success "Created package.json"
fi

# Install dependencies
log_info "Installing npm dependencies..."
if [ -f package-lock.json ]; then
    npm ci
else
    npm install
fi
log_success "Dependencies installed"

# Set up environment files
log_info "Setting up environment files..."

# .env.local
if [ ! -f .env.local ]; then
    cat > .env.local << EOF
# Development Environment Variables
NODE_ENV=development

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/myapp"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"

# OAuth Providers (optional - configure as needed)
# GITHUB_CLIENT_ID="your-github-client-id"
# GITHUB_CLIENT_SECRET="your-github-client-secret"
# GOOGLE_CLIENT_ID="your-google-client-id"
# GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Redis
REDIS_URL="redis://localhost:6379"

# Email (Mailpit for local testing)
EMAIL_SERVER="smtp://localhost:1025"
EMAIL_FROM="noreply@localhost"

# Stripe (optional)
# STRIPE_PUBLIC_KEY="pk_test_..."
# STRIPE_SECRET_KEY="sk_test_..."
# STRIPE_WEBHOOK_SECRET="whsec_..."
EOF
    log_success "Created .env.local"
else
    log_warning ".env.local already exists, skipping"
fi

# .env.example
if [ ! -f .env.example ]; then
    cat > .env.example << 'EOF'
# Environment Variables Example
NODE_ENV=development

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/myapp"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# OAuth Providers (optional)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Redis
REDIS_URL="redis://localhost:6379"

# Email
EMAIL_SERVER="smtp://localhost:1025"
EMAIL_FROM="noreply@localhost"

# Stripe (optional)
STRIPE_PUBLIC_KEY=""
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
EOF
    log_success "Created .env.example"
fi

# Set up Prisma
log_info "Setting up Prisma..."
mkdir -p prisma

# schema.prisma
if [ ! -f prisma/schema.prisma ]; then
    cp config/prisma/schema.prisma.template prisma/schema.prisma 2>/dev/null || cat > prisma/schema.prisma << 'EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@map("users")
}
EOF
    log_success "Created prisma/schema.prisma"
fi

# Prisma seed file
if [ ! -f prisma/seed.ts ]; then
    cat > prisma/seed.ts << 'EOF'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create sample users
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
    },
  })

  console.log(`✅ Created user: ${user.email}`)
  console.log('🌱 Seeding complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
EOF
    log_success "Created prisma/seed.ts"
fi

# Generate Prisma client
log_info "Generating Prisma client..."
npx prisma generate

# Wait for database if in Docker
if [ "$IN_DOCKER" = true ]; then
    log_info "Waiting for database to be ready..."
    npx wait-on tcp:postgres:5432 -t 60000 || {
        log_error "Database connection timeout"
        exit 1
    }
fi

# Run database migrations
log_info "Running database migrations..."
npx prisma migrate dev --name init || {
    log_warning "Migration may have already been applied or database not ready"
}

# Seed database
log_info "Seeding database..."
npx prisma db seed 2>/dev/null || {
    log_warning "Seeding skipped or failed (database may not be ready)"
}

# Set up TypeScript configuration
if [ ! -f tsconfig.json ]; then
    log_info "Creating tsconfig.json..."
    cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/app/*": ["./src/app/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/types/*": ["./src/types/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF
    log_success "Created tsconfig.json"
fi

# Set up Next.js configuration
if [ ! -f next.config.js ]; then
    log_info "Creating next.config.js..."
    cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
    ],
  },
}

module.exports = nextConfig
EOF
    log_success "Created next.config.js"
fi

# Set up Tailwind CSS configuration
if [ ! -f tailwind.config.ts ]; then
    log_info "Creating Tailwind CSS configuration..."
    cat > tailwind.config.ts << 'EOF'
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
EOF
    log_success "Created tailwind.config.ts"
fi

# Set up PostCSS configuration
if [ ! -f postcss.config.js ]; then
    log_info "Creating PostCSS configuration..."
    cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF
    log_success "Created postcss.config.js"
fi

# Create basic directory structure
log_info "Creating project structure..."
mkdir -p src/{app,components,lib,hooks,types}

# Create global CSS
if [ ! -f src/app/globals.css ]; then
    cat > src/app/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
EOF
    log_success "Created src/app/globals.css"
fi

# Create utility functions
if [ ! -f src/lib/utils.ts ]; then
    cat > src/lib/utils.ts << 'EOF'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
EOF
    log_success "Created src/lib/utils.ts"
fi

# Create Prisma client singleton
if [ ! -f src/lib/prisma.ts ]; then
    cat > src/lib/prisma.ts << 'EOF'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
EOF
    log_success "Created src/lib/prisma.ts"
fi

# Create basic layout
if [ ! -f src/app/layout.tsx ]; then
    cat > src/app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Full Stack Web App',
  description: 'Built with Next.js 14, PostgreSQL, and Redis',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
EOF
    log_success "Created src/app/layout.tsx"
fi

# Create home page
if [ ! -f src/app/page.tsx ]; then
    cat > src/app/page.tsx << 'EOF'
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold mb-4">
          Full Stack Web App
        </h1>
      </div>
      <p className="text-lg text-gray-600 dark:text-gray-400">
        Built with Next.js 14, PostgreSQL, and Redis
      </p>
      <div className="mt-8 flex gap-4">
        <a
          href="https://nextjs.org/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
        >
          Next.js Docs
        </a>
        <a
          href="/api/hello"
          className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
        >
          Test API
        </a>
      </div>
    </main>
  )
}
EOF
    log_success "Created src/app/page.tsx"
fi

# Create API route
if [ ! -f src/app/api/hello/route.ts ]; then
    mkdir -p src/app/api/hello
    cat > src/app/api/hello/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Test database connection
    const userCount = await prisma.user.count()
    
    return NextResponse.json({
      message: 'Hello from the API!',
      timestamp: new Date().toISOString(),
      users: userCount,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Database connection failed', details: String(error) },
      { status: 500 }
    )
  }
}
EOF
    log_success "Created src/app/api/hello/route.ts"
fi

echo ""
echo "=========================================="
log_success "Project initialization complete! 🎉"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Review your .env.local configuration"
echo "  2. Run 'npm run dev' to start the development server"
echo "  3. Open http://localhost:3000 in your browser"
echo "  4. Access Prisma Studio at http://localhost:5555"
echo "  5. Check email testing at http://localhost:8025 (Mailpit)"
echo ""
echo "Useful commands:"
echo "  npm run dev          - Start development server"
echo "  npm run db:studio    - Open Prisma Studio"
echo "  npm run db:migrate   - Run database migrations"
echo "  npm run test         - Run tests"
echo ""
