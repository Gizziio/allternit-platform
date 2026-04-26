# N5 Environment Specification API

## Overview

The Environment Specification API (N5) provides a unified interface for defining, resolving, and converting execution environments across multiple sources.

## Supported Sources

| Source | Format | Use Case |
|--------|--------|----------|
| **DevContainer** | `devcontainer.json` | VS Code dev containers |
| **Nix Flake** | `flake.nix` | Reproducible Nix environments |
| **OCI Image** | `docker.io/library/ubuntu:22.04` | Direct container images |
| **Dockerfile** | `Dockerfile` | Custom Docker builds |

## Quick Start

### Rust API

```rust
use allternit_environment_spec::{EnvironmentSpecLoader, EnvironmentSource};

// Create loader with caching
let loader = EnvironmentSpecLoader::new()?;

// Load from any source
let spec = loader.load("mcr.microsoft.com/devcontainers/rust:1").await?;

// Convert to rootfs for MicroVM
let rootfs_path = loader.to_rootfs(&spec).await?;
```

### HTTP API

```bash
# Resolve environment
POST /api/v1/environment/resolve
Content-Type: application/json

{
  "source": "mcr.microsoft.com/devcontainers/rust:1"
}

# Response
{
  "source_type": "oci",
  "spec": {
    "source": "oci",
    "source_uri": "mcr.microsoft.com/devcontainers/rust:1",
    "image": "mcr.microsoft.com/devcontainers/rust:1",
    "workspace_folder": "/workspace",
    "env_vars": {},
    "packages": [],
    "features": [],
    "mounts": [],
    "post_create_commands": [],
    "resources": {},
    "allternit_config": {"enable_prewarm": false}
  },
  "cached": false,
  "resolve_time_ms": 1234
}
```

## API Reference

### Core Types

#### `EnvironmentSpec`

```rust
pub struct EnvironmentSpec {
    /// Source type (devcontainer, nix, oci, dockerfile)
    pub source: EnvironmentSource,
    
    /// Original source URI
    pub source_uri: String,
    
    /// Resolved OCI image reference
    pub image: String,
    
    /// Image digest for reproducibility
    pub image_digest: Option<String>,
    
    /// Working directory inside environment
    pub workspace_folder: String,
    
    /// Environment variables
    pub env_vars: HashMap<String, String>,
    
    /// Packages to install
    pub packages: Vec<String>,
    
    /// Dev container features
    pub features: Vec<FeatureSpec>,
    
    /// Mount configurations
    pub mounts: Vec<MountSpec>,
    
    /// Commands to run after creation
    pub post_create_commands: Vec<String>,
    
    /// Resource requirements
    pub resources: ResourceRequirements,
    
    /// Allternit-specific configuration
    pub allternit_config: AllternitEnvironmentConfig,
}
```

#### `ResourceRequirements`

```rust
pub struct ResourceRequirements {
    /// CPU cores (or millicores if < 1)
    pub cpus: Option<f32>,
    
    /// Memory in GB
    pub memory_gb: Option<f32>,
    
    /// Disk space in GB
    pub disk_gb: Option<f32>,
}
```

### HTTP Endpoints

#### `POST /api/v1/environment/resolve`

Resolve an environment specification from a source.

**Request:**
```json
{
  "source": "string",
  "force": false
}
```

**Response:**
```json
{
  "source_type": "oci|devcontainer|nix|dockerfile",
  "spec": { /* EnvironmentSpec */ },
  "cached": true,
  "resolve_time_ms": 1234
}
```

#### `POST /api/v1/environment/convert`

Convert environment to target format (rootfs/initramfs).

**Request:**
```json
{
  "source": "string",
  "format": "rootfs|initramfs"
}
```

**Response:**
```json
{
  "path": "/cache/rootfs/xxx.ext4",
  "size_bytes": 1073741824,
  "format": "rootfs",
  "conversion_time_ms": 5678
}
```

#### `GET /api/v1/environment/templates`

List predefined environment templates.

**Response:**
```json
[
  {
    "id": "rust",
    "name": "Rust Development",
    "description": "Official Rust dev container",
    "source_type": "devcontainer",
    "source": "mcr.microsoft.com/devcontainers/rust:1",
    "tags": ["rust", "official", "language"]
  }
]
```

#### `GET /api/v1/environment/health`

Check environment service health.

**Response:**
```json
{
  "status": "healthy",
  "service": "environment-spec",
  "features": ["devcontainer", "nix", "dockerfile", "oci"],
  "converters": ["rootfs", "initramfs"],
  "timestamp": 1700000000
}
```

## Examples

### DevContainer Example

```json
{
  "name": "My Project",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:18",
  "features": {
    "ghcr.io/devcontainers/features/docker-in-docker:2": {}
  },
  "containerEnv": {
    "NODE_ENV": "development"
  },
  "postCreateCommand": "npm install",
  "customizations": {
    "allternit": {
      "driver": "process",
      "enablePrewarm": true
    }
  }
}
```

### Nix Flake Example

```nix
{
  description = "My Project Environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }: {
    devShells.default = nixpkgs.legacyPackages.x86_64-linux.mkShell {
      buildInputs = with nixpkgs.legacyPackages.x86_64-linux; [
        nodejs_18
        yarn
        git
      ];
    };
  };
}
```

### Using with Shell UI

```typescript
import { useEnvironmentStore } from './stores/environmentStore';

// Set environment
const { setEnvironmentUri, setEnvironmentSource } = useEnvironmentStore();

setEnvironmentSource('devcontainer');
setEnvironmentUri('mcr.microsoft.com/devcontainers/rust:1');

// Access resolved environment
const resolved = useEnvironmentStore((state) => state.environment.resolved);
```

## Caching

The loader maintains a cache directory at:
- Linux/macOS: `~/.cache/allternit/environments/`
- Windows: `%LOCALAPPDATA%/allternit/environments/`

Cache contents:
- Resolved OCI image manifests
- Downloaded and extracted image layers
- Converted rootfs images

To clear cache:
```bash
DELETE /api/v1/environment/cache
```

## Error Handling

Common error types:

| Error | Cause | Resolution |
|-------|-------|------------|
| `ParseError` | Invalid configuration file | Check JSON syntax |
| `ResolutionError` | Image not found in registry | Verify image reference |
| `ConversionError` | Missing tools (skopeo/crane) | Install container tools |
| `RegistryError` | Authentication or network | Check credentials/network |

## Integration with Drivers

Environment specs are passed to execution drivers:

```rust
// Process driver example
let spec = loader.load("ubuntu:22.04").await?;
let handle = driver.spawn(SpawnSpec {
    env: spec,
    ..Default::default()
}).await?;

// Execute in specified environment
let result = driver.exec(&handle, cmd).await?;
```

## Testing

Run integration tests:
```bash
cargo test -p allternit-environment-spec --test integration_test
```

Test fixtures are in `tests/fixtures/`.

## Troubleshooting

### Image Resolution Fails

1. Check image reference format: `registry/image:tag`
2. Verify network connectivity
3. For private registries, configure auth

### Rootfs Conversion Fails

1. Install required tools: `skopeo` or `crane`
2. Ensure sufficient disk space
3. Check permissions on cache directory

### DevContainer Parsing Fails

1. Validate JSON syntax
2. Check feature references exist
3. Verify mount paths are valid

## See Also

- [Architecture](../ARCHITECTURE.md)
- [Driver Interface](../allternit-driver-interface/README.md)
- [Process Driver](../../execution/allternit-process-driver/README.md)
