# Rust Systems Programming Template

A high-performance Rust development environment for systems programming, async services, and CLI tools.

## Overview

This template provides a production-ready Rust development environment with:

- **Rust 1.75+** with latest toolchain features
- **Tokio** async runtime for high-performance I/O
- **cargo-watch** for hot reload during development
- **clippy & rustfmt** for code quality
- **cargo-expand** for macro debugging
- **cargo-audit** for security scanning
- **Cross-compilation** support for multiple targets
- **LLDB** debugging configuration
- **Docker & Docker Compose** for containerized development
- **PostgreSQL & Redis** services included

## Features

### Core Features

- **Async Runtime**: Built on Tokio with full feature set
- **Structured Logging**: Tracing-based with configurable output formats
- **CLI Framework**: clap for robust argument parsing
- **Error Handling**: anyhow for easy error propagation
- **Development Tools**: cargo-watch, hot reload, fast linking with mold
- **Build Optimization**: sccache for faster incremental builds

### Optional Features

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| `cli` | Command-line interface | clap |
| `web` | Web server (axum-based) | axum, tower, tower-http |
| `http-client` | HTTP client capabilities | reqwest |
| `database` | Database connectivity (PostgreSQL) | sqlx |
| `cache` | Redis caching | redis |

## Quick Start

### Using Docker (Recommended)

```bash
# Clone or copy this template
cd rust-systems

# Start the development environment
docker-compose up -d

# Enter the development container
docker-compose exec rust-dev bash

# Inside the container
cargo run -- --help
cargo watch -x run  # Hot reload mode
```

### Local Development

```bash
# Ensure you have Rust 1.75+ installed
rustc --version

# Install development tools
cargo install cargo-watch cargo-expand cargo-audit

# Run the application
cargo run -- --help

# Development with hot reload
cargo watch -x 'run -- --verbose'
```

## Project Structure

```
rust-systems/
├── Cargo.toml              # Project configuration
├── Cargo.toml.template     # Template for new projects
├── Dockerfile              # Development container
├── docker-compose.yml      # Service orchestration
├── Makefile                # Common tasks
├── README.md               # This file
├── config/                 # Configuration templates
│   ├── .clippy.toml       # Linting configuration
│   ├── Cargo.toml.template # Project template
│   ├── launch.json        # VS Code debug config
│   └── rustfmt.toml       # Formatting configuration
├── scripts/               # Utility scripts
│   └── init-project.sh    # Project initialization
└── src/                   # Source code
    └── main.rs            # Application entry point
```

## Usage

### Initialize a New Project

```bash
# Make the script executable
chmod +x scripts/init-project.sh

# Create a new project
./scripts/init-project.sh my-awesome-app

# With specific features
./scripts/init-project.sh --features web,database my-api-server

# With all features
./scripts/init-project.sh --features full my-fullstack-app
```

### Development Commands

```bash
# Build the project
cargo build --release

# Run with hot reload
cargo watch -x run

# Run tests
cargo test --all-features

# Run linter
cargo clippy --all-targets --all-features -- -D warnings

# Format code
cargo fmt

# Security audit
cargo audit

# Expand macros (for debugging)
cargo expand

# Build for different targets
cargo build --target x86_64-unknown-linux-musl
cargo build --target aarch64-unknown-linux-gnu
```

## CLI Usage

The template includes a comprehensive CLI with multiple subcommands:

```bash
# Default mode (shows info)
cargo run

# Run the web server
cargo run -- serve --host 0.0.0.0 --port 8080

# Run database migrations
cargo run -- migrate up
cargo run -- migrate down --steps 1

# Health checks
cargo run -- health --check-db --check-cache

# Generate documentation
cargo run -- docs --open

# With verbose logging
cargo run -- --verbose serve
```

## Docker Services

### Included Services

| Service | Port | Description |
|---------|------|-------------|
| rust-dev | - | Development container |
| postgres | 5432 | PostgreSQL database |
| redis | 6379 | Redis cache |
| pgadmin | 5050 | PostgreSQL management (optional) |
| redis-commander | 8081 | Redis management (optional) |

### Running Optional Services

```bash
# Start with management tools
docker-compose --profile tools up -d

# Access pgAdmin at http://localhost:5050
# Access Redis Commander at http://localhost:8081
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RUST_LOG` | Log level filter | `debug` |
| `RUST_BACKTRACE` | Enable backtraces | `1` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:postgres@postgres:5432/app` |
| `REDIS_URL` | Redis connection string | `redis://redis:6379` |
| `TOKIO_CONSOLE_BIND` | Tokio console bind address | `0.0.0.0:6669` |

### Template Variables

When creating a new project from this template:

| Variable | Description | Options | Default |
|----------|-------------|---------|---------|
| `RUST_VERSION` | Rust toolchain version | stable, beta, nightly | stable |
| `ENABLE_WASM` | Add WASM target | true, false | false |

## Cross-Compilation

Pre-configured targets:

- `x86_64-unknown-linux-gnu` (default)
- `x86_64-unknown-linux-musl` (static linking)
- `aarch64-unknown-linux-gnu` (ARM64)
- `aarch64-unknown-linux-musl` (ARM64 static)
- `x86_64-pc-windows-gnu` (Windows)
- `wasm32-wasi` (WebAssembly)

```bash
# Build for ARM64
cargo build --target aarch64-unknown-linux-gnu --release

# Build static binary
cargo build --target x86_64-unknown-linux-musl --release
```

## Debugging

### VS Code

The template includes `.vscode/launch.json` with debug configurations:

- Debug Rust Application
- Debug with Arguments
- Debug Release Build
- Debug Tests
- Debug Single Test

### LLDB

```bash
# Install LLDB tools
cargo install cargo-lldb

# Debug with LLDB
cargo lldb
```

### Tokio Console

Profile async applications:

```bash
# Start with Tokio console enabled
TOKIO_CONSOLE_BIND=0.0.0.0:6669 cargo run

# Connect with tokio-console
tokio-console http://localhost:6669
```

## Build Optimization

### Fast Development Builds

The template includes several optimizations:

1. **mold linker**: Faster linking than default ld
2. **sccache**: Shared compilation cache
3. **sparse registry**: Faster crate downloads
4. **incremental compilation**: Enabled by default

### Release Profile

```toml
[profile.release]
opt-level = 3          # Maximum optimization
lto = "thin"          # Link-time optimization
codegen-units = 1     # Better optimization
panic = "abort"       # Smaller binaries
strip = true          # Remove debug symbols
```

## Testing

```bash
# Run all tests
cargo test --all-features

# Run with coverage
cargo tarpaulin --out Html

# Property-based testing
cargo test proptest

# Integration tests
cargo test --test '*'
```

## CI/CD

The init script creates a GitHub Actions workflow with:

- Code formatting checks
- Clippy linting
- Test execution
- Multi-target builds
- Security auditing with cargo-audit

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `make check` to verify
5. Submit a pull request

## License

This template is provided under MIT OR Apache-2.0 license.

## Resources

- [Rust Book](https://doc.rust-lang.org/book/)
- [Tokio Documentation](https://tokio.rs/)
- [Clap Documentation](https://docs.rs/clap/)
- [Tracing Documentation](https://tracing.rs/)
- [The Rust Programming Language - Async/Await](https://rust-lang.github.io/async-book/)

---

Built with ❤️ by Allternit
