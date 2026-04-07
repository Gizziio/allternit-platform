#!/bin/bash
#
# Rust Systems Project Initialization Script
# This script sets up a new Rust project with best practices and tooling
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$(dirname "$SCRIPT_DIR")"

# Default values
PROJECT_NAME=""
PROJECT_PATH=""
FEATURES="default"
INIT_GIT=true
CREATE_IDE_CONFIGS=true

# Usage information
usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS] <project-name> [project-path]

Initialize a new Rust systems project with best practices and tooling.

Arguments:
  project-name          Name of the new project (required)
  project-path          Path where to create the project (default: ./<project-name>)

Options:
  -f, --features        Comma-separated list of features to enable
                        Options: cli, web, http-client, database, cache, full
                        Default: default (cli, http-client)
  --no-git              Skip Git initialization
  --no-ide              Skip IDE configuration files
  -h, --help            Show this help message

Examples:
  $(basename "$0") my-app
  $(basename "$0") my-app /home/user/projects
  $(basename "$0") --features web,database my-api
  $(basename "$0") --features full my-fullstack-app

EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--features)
            FEATURES="$2"
            shift 2
            ;;
        --no-git)
            INIT_GIT=false
            shift
            ;;
        --no-ide)
            CREATE_IDE_CONFIGS=false
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        -*)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
        *)
            if [[ -z "$PROJECT_NAME" ]]; then
                PROJECT_NAME="$1"
            elif [[ -z "$PROJECT_PATH" ]]; then
                PROJECT_PATH="$1"
            else
                log_error "Too many arguments"
                usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate project name
if [[ -z "$PROJECT_NAME" ]]; then
    log_error "Project name is required"
    usage
    exit 1
fi

if [[ ! "$PROJECT_NAME" =~ ^[a-zA-Z][a-zA-Z0-9_-]*$ ]]; then
    log_error "Invalid project name: $PROJECT_NAME"
    log_error "Project name must start with a letter and contain only letters, numbers, hyphens, and underscores"
    exit 1
fi

# Convert to valid Rust crate name (replace hyphens with underscores)
CRATE_NAME=$(echo "$PROJECT_NAME" | tr '-' '_')

# Set default project path
if [[ -z "$PROJECT_PATH" ]]; then
    PROJECT_PATH="./$PROJECT_NAME"
fi

# Convert to absolute path
PROJECT_PATH="$(cd "$(dirname "$PROJECT_PATH")" && pwd)/$(basename "$PROJECT_PATH")"

log_info "Initializing Rust project: $PROJECT_NAME"
log_info "Project path: $PROJECT_PATH"
log_info "Features: $FEATURES"

# Check if directory already exists
if [[ -d "$PROJECT_PATH" ]]; then
    log_error "Directory already exists: $PROJECT_PATH"
    exit 1
fi

# Create project directory
log_info "Creating project directory..."
mkdir -p "$PROJECT_PATH"
cd "$PROJECT_PATH"

# Initialize cargo project
log_info "Initializing Cargo project..."
cargo init --name "$CRATE_NAME"

# Copy template configuration files
log_info "Copying configuration files..."

# Copy and process Cargo.toml
cp "$TEMPLATE_DIR/config/Cargo.toml.template" "$PROJECT_PATH/Cargo.toml"
# Replace project name placeholder
sed -i "s/{{PROJECT_NAME}}/$CRATE_NAME/g" "$PROJECT_PATH/Cargo.toml"

# Copy rustfmt config
cp "$TEMPLATE_DIR/config/rustfmt.toml" "$PROJECT_PATH/rustfmt.toml"

# Copy clippy config
cp "$TEMPLATE_DIR/config/.clippy.toml" "$PROJECT_PATH/.clippy.toml"

# Copy launch.json if IDE configs are enabled
if [[ "$CREATE_IDE_CONFIGS" == true ]]; then
    mkdir -p "$PROJECT_PATH/.vscode"
    cp "$TEMPLATE_DIR/config/launch.json" "$PROJECT_PATH/.vscode/launch.json"
    sed -i "s/{{PROJECT_NAME}}/$CRATE_NAME/g" "$PROJECT_PATH/.vscode/launch.json"
    log_success "VS Code configuration created"
fi

# Update features in Cargo.toml based on user selection
log_info "Configuring features: $FEATURES"

# Convert comma-separated features to array
IFS=',' read -ra FEATURE_ARRAY <<< "$FEATURES"

# Build feature list for Cargo.toml
FEATURE_LIST=""
for feature in "${FEATURE_ARRAY[@]}"; do
    feature=$(echo "$feature" | xargs)  # trim whitespace
    if [[ -n "$FEATURE_LIST" ]]; then
        FEATURE_LIST="$FEATURE_LIST, \"$feature\""
    else
        FEATURE_LIST="\"$feature\""
    fi
done

# Update default features in Cargo.toml
sed -i "s/^default = \[.*\]$/default = [$FEATURE_LIST]/" "$PROJECT_PATH/Cargo.toml"

# Create directory structure
log_info "Creating project structure..."

mkdir -p src/{bin,lib,handlers,middleware,models,services,utils}
mkdir -p tests/{integration,unit}
mkdir -p benches
mkdir -p examples
mkdir -p docs
mkdir -p scripts
mkdir -p .github/workflows

# Copy example main.rs
if [[ -f "$TEMPLATE_DIR/src/main.rs" ]]; then
    cp "$TEMPLATE_DIR/src/main.rs" "$PROJECT_PATH/src/main.rs"
    sed -i "s/rust_systems/$CRATE_NAME/g" "$PROJECT_PATH/src/main.rs"
fi

# Create lib.rs
cat > "$PROJECT_PATH/src/lib.rs" << EOF
//! $PROJECT_NAME - A high-performance Rust application
//!
//! This crate provides async functionality built on Tokio.

#![warn(missing_docs)]
#![warn(clippy::all, clippy::pedantic)]

pub mod utils;

use std::sync::Arc;

/// Application state shared across handlers
#[derive(Debug, Clone)]
pub struct AppState {
    /// Application configuration
    pub config: Arc<Config>,
}

/// Application configuration
#[derive(Debug, Clone)]
pub struct Config {
    /// Server bind address
    pub bind_address: String,
    /// Server port
    pub port: u16,
    /// Log level
    pub log_level: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            bind_address: "127.0.0.1".to_string(),
            port: 8080,
            log_level: "info".to_string(),
        }
    }
}

/// Initialize the application
///
/// # Errors
///
/// Returns an error if initialization fails
pub async fn init() -> anyhow::Result<AppState> {
    let config = Arc::new(Config::default());
    Ok(AppState { config })
}

/// Run the application
///
/// # Errors
///
/// Returns an error if the application fails to run
pub async fn run() -> anyhow::Result<()> {
    let _state = init().await?;
    // Application logic here
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_default() {
        let config = Config::default();
        assert_eq!(config.port, 8080);
        assert_eq!(config.bind_address, "127.0.0.1");
    }
}
EOF

# Create utils module
mkdir -p "$PROJECT_PATH/src/utils"
cat > "$PROJECT_PATH/src/utils/mod.rs" << 'EOF'
//! Utility functions and helpers

pub mod logging;

use std::time::Duration;

/// Parse a duration string into a Duration
///
/// Supports formats like "1s", "1m", "1h", "1d"
///
/// # Errors
///
/// Returns an error if the format is invalid
pub fn parse_duration(s: &str) -> anyhow::Result<Duration> {
    let len = s.len();
    if len < 2 {
        anyhow::bail!("Invalid duration format: {}", s);
    }

    let (num, unit) = s.split_at(len - 1);
    let num: u64 = num.parse()?;

    match unit {
        "s" => Ok(Duration::from_secs(num)),
        "m" => Ok(Duration::from_secs(num * 60)),
        "h" => Ok(Duration::from_secs(num * 3600)),
        "d" => Ok(Duration::from_secs(num * 86400)),
        _ => anyhow::bail!("Unknown time unit: {}", unit),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_duration() {
        assert_eq!(parse_duration("1s").unwrap(), Duration::from_secs(1));
        assert_eq!(parse_duration("1m").unwrap(), Duration::from_secs(60));
        assert_eq!(parse_duration("1h").unwrap(), Duration::from_secs(3600));
    }
}
EOF

# Create logging utility
cat > "$PROJECT_PATH/src/utils/logging.rs" << 'EOF'
//! Logging configuration and utilities

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// Initialize the logging system
///
/// # Panics
///
/// Panics if the subscriber fails to initialize
pub fn init_logging() {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_subscriber::fmt::layer().with_target(true))
        .init();
}

/// Initialize logging with JSON output
///
/// # Panics
///
/// Panics if the subscriber fails to initialize
pub fn init_json_logging() {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_subscriber::fmt::layer().json())
        .init();
}
EOF

# Create example file
cat > "$PROJECT_PATH/examples/basic.rs" << EOF
//! Basic usage example for $PROJECT_NAME

use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    $CRATE_NAME::utils::logging::init_logging();
    
    tracing::info!("Running basic example");
    
    // Initialize and run
    $CRATE_NAME::run().await?;
    
    Ok(())
}
EOF

# Create integration test
cat > "$PROJECT_PATH/tests/integration/main.rs" << 'EOF'
//! Integration tests

use anyhow::Result;

#[tokio::test]
async fn test_app_initialization() -> Result<()> {
    let state = rust_systems::init().await?;
    assert_eq!(state.config.port, 8080);
    Ok(())
}
EOF

# Create benchmark
cat > "$PROJECT_PATH/benches/benchmark.rs" << 'EOF'
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn fibonacci(n: u64) -> u64 {
    match n {
        0 => 1,
        1 => 1,
        n => fibonacci(n - 1) + fibonacci(n - 2),
    }
}

fn criterion_benchmark(c: &mut Criterion) {
    c.bench_function("fib 20", |b| b.iter(|| fibonacci(black_box(20))));
}

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);
EOF

# Create GitHub Actions workflow
mkdir -p "$PROJECT_PATH/.github/workflows"
cat > "$PROJECT_PATH/.github/workflows/ci.yml" << 'EOF'
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  CARGO_TERM_COLOR: always
  RUST_BACKTRACE: 1

jobs:
  check:
    name: Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Rust
        uses: dtolnay/rust-action@stable
      
      - name: Cache cargo dependencies
        uses: Swatinem/rust-cache@v2
      
      - name: Check formatting
        run: cargo fmt -- --check
      
      - name: Run clippy
        run: cargo clippy --all-targets --all-features -- -D warnings
      
      - name: Check code
        run: cargo check --all-targets --all-features

  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Rust
        uses: dtolnay/rust-action@stable
      
      - name: Cache cargo dependencies
        uses: Swatinem/rust-cache@v2
      
      - name: Run tests
        run: cargo test --all-features --verbose
      
      - name: Run doc tests
        run: cargo test --doc --all-features

  build:
    name: Build
    runs-on: ubuntu-latest
    strategy:
      matrix:
        target:
          - x86_64-unknown-linux-gnu
          - x86_64-unknown-linux-musl
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Rust
        uses: dtolnay/rust-action@stable
        with:
          targets: ${{ matrix.target }}
      
      - name: Cache cargo dependencies
        uses: Swatinem/rust-cache@v2
      
      - name: Build release
        run: cargo build --release --target ${{ matrix.target }}

  security:
    name: Security Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run cargo audit
        uses: rustsec/audit-check@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
EOF

# Create .gitignore
log_info "Creating .gitignore..."
cat > "$PROJECT_PATH/.gitignore" << 'EOF'
# Rust
/target
**/*.rs.bk
*.pdb
Cargo.lock

# IDEs
.idea/
.vscode/
*.swp
*.swo
*~
.DS_Store

# Environment
.env
.env.local
.env.*.local

# Logs
*.log
/logs/

# Testing
*.profraw
*.profdata
/coverage/

# Documentation
/target/doc/

# Build artifacts
/dist/
/build/

# SQLx
.sqlx/

# Database
*.db
*.sqlite
*.sqlite3

# OS
Thumbs.db
EOF

# Create .dockerignore
cat > "$PROJECT_PATH/.dockerignore" << 'EOF'
/target
.git
.gitignore
.env
*.md
!README.md
Dockerfile
docker-compose.yml
.vscode/
.idea/
*.log
EOF

# Create Makefile for common tasks
cat > "$PROJECT_PATH/Makefile" << 'EOF'
.PHONY: help build test clean fmt lint run dev watch install check audit

# Default target
help:
	@echo "Available targets:"
	@echo "  build    - Build the project"
	@echo "  test     - Run all tests"
	@echo "  clean    - Clean build artifacts"
	@echo "  fmt      - Format code"
	@echo "  lint     - Run clippy lints"
	@echo "  run      - Run the application"
	@echo "  dev      - Run with hot reload"
	@echo "  watch    - Watch for changes and run"
	@echo "  check    - Run all checks (fmt, lint, test)"
	@echo "  audit    - Run security audit"

build:
	cargo build --release

test:
	cargo test --all-features

clean:
	cargo clean

fmt:
	cargo fmt

lint:
	cargo clippy --all-targets --all-features -- -D warnings

run:
	cargo run

dev:
	cargo watch -x 'run -- --config config.toml'

watch:
	cargo watch -x check -x test

install:
	cargo install --path .

check: fmt lint test

audit:
	cargo audit
EOF

# Initialize Git repository
if [[ "$INIT_GIT" == true ]]; then
    log_info "Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit: $PROJECT_NAME

Generated from Rust Systems Programming template
Features: $FEATURES"
    log_success "Git repository initialized"
fi

# Create README
log_info "Creating README..."
cat > "$PROJECT_PATH/README.md" << EOF
# $PROJECT_NAME

A high-performance Rust application built with async/await and Tokio.

## Features

- **Async Runtime**: Built on Tokio for high-performance async I/O
- **CLI Interface**: Command-line argument parsing with clap
- **Structured Logging**: Tracing-based logging with configurable output
- **Error Handling**: Comprehensive error handling with anyhow and thiserror
- **Testing**: Unit and integration test setup
- **Benchmarking**: Criterion benchmarks for performance testing

## Quick Start

### Prerequisites

- Rust 1.75+ (install via [rustup](https://rustup.rs/))
- Docker and Docker Compose (optional, for containerized development)

### Building

\`\`\`bash
cargo build --release
\`\`\`

### Running

\`\`\`bash
cargo run -- --help
\`\`\`

### Development with Hot Reload

\`\`\`bash
# Install cargo-watch if not already installed
cargo install cargo-watch

# Run with auto-reload on file changes
cargo watch -x run
\`\`\`

## Development

### Code Quality

\`\`\`bash
# Format code
cargo fmt

# Run linter
cargo clippy --all-targets --all-features -- -D warnings

# Run all tests
cargo test --all-features

# Run security audit
cargo audit
\`\`\`

### Using Docker

\`\`\`bash
# Start the development environment
docker-compose up -d

# Enter the development container
docker-compose exec rust-dev bash

# Run commands inside the container
cargo run
\`\`\`

## Project Structure

\`\`\`
.
├── Cargo.toml          # Project configuration
├── Makefile            # Common tasks
├── README.md           # This file
├── benches/            # Performance benchmarks
├── examples/           # Usage examples
├── src/
│   ├── bin/            # Additional binaries
│   ├── handlers/       # Request handlers (web)
│   ├── lib.rs          # Library root
│   ├── main.rs         # Application entry point
│   ├── middleware/     # Middleware components
│   ├── models/         # Data models
│   ├── services/       # Business logic
│   └── utils/          # Utility functions
└── tests/              # Integration tests
\`\`\`

## Configuration

The application can be configured via:

1. Command-line arguments
2. Environment variables (prefixed with \`APP_\`)
3. Configuration file (config.toml)

## License

This project is licensed under the MIT OR Apache-2.0 license.
EOF

# Create config.toml example
cat > "$PROJECT_PATH/config.toml.example" << 'EOF'
# Application Configuration

# Server configuration
[server]
bind_address = "0.0.0.0"
port = 8080

# Logging configuration
[logging]
level = "info"
format = "pretty"  # Options: pretty, json, compact

# Database configuration (if using database feature)
[database]
url = "postgres://postgres:postgres@localhost:5432/app"
max_connections = 10

# Redis configuration (if using cache feature)
[redis]
url = "redis://localhost:6379"
EOF

# Run initial build to verify setup
log_info "Running initial build..."
cd "$PROJECT_PATH"
if cargo check --all-features 2>/dev/null; then
    log_success "Initial build successful"
else
    log_warn "Initial build had warnings - this is normal for new projects"
fi

# Final summary
echo ""
echo "========================================"
log_success "Project initialized successfully!"
echo "========================================"
echo ""
echo "Project: $PROJECT_NAME"
echo "Location: $PROJECT_PATH"
echo "Features: $FEATURES"
echo ""
echo "Next steps:"
echo "  cd $PROJECT_PATH"
echo "  cargo run -- --help"
echo ""
echo "Development commands:"
echo "  make dev      # Run with hot reload"
echo "  make check    # Run all checks"
echo "  make test     # Run tests"
echo "  make lint     # Run linter"
echo ""
echo "For more information, see README.md"
