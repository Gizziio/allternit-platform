# Allternit Runtime Environment Templates

This directory contains pre-built environment templates for Railway-style one-click environment provisioning.

## Available Templates

### 1. node-typescript
**Purpose**: Modern Node.js development with TypeScript

**Includes**:
- Node.js 20 LTS
- TypeScript 5.x
- pnpm (fast package manager)
- Vitest (testing)
- ESLint + Prettier
- VS Code extensions pre-configured

**Ports**: 3000, 8080, 9229 (debug)

**Usage**:
```typescript
const engine = new EnvironmentEngine();
const env = await engine.provision({
  id: 'my-node-app',
  type: 'devcontainer',
  template: 'node-typescript',
  target: { type: 'local' }
});
```

---

### 2. python-ml
**Purpose**: Machine Learning and Data Science with Python

**Includes**:
- Python 3.12
- PyTorch 2.x
- JupyterLab
- Transformers (Hugging Face)
- NumPy, Pandas, Scikit-learn
- Weights & Biases, MLflow
- CUDA support (with GPU)

**Ports**: 8888 (Jupyter), 6006 (TensorBoard), 5000, 8501 (Streamlit)

**Usage**:
```typescript
const env = await engine.provision({
  id: 'my-ml-project',
  type: 'devcontainer',
  template: 'python-ml',
  target: { type: 'local' }
});
```

---

### 3. rust-systems
**Purpose**: Systems programming with Rust

**Includes**:
- Rust 1.75+
- cargo-watch (auto-rebuild)
- cargo-expand, cargo-audit
- rust-analyzer
- LLDB debugger
- VS Code extensions pre-configured

**Ports**: 8080, 3000, 9090

**Usage**:
```typescript
const env = await engine.provision({
  id: 'my-rust-project',
  type: 'devcontainer',
  template: 'rust-systems',
  target: { type: 'local' }
});
```

---

### 4. go-backend
**Purpose**: Backend development with Go

**Includes**:
- Go 1.21+
- Air (hot reload)
- Delve debugger
- gopls (language server)
- golangci-lint
- Kubectl & Helm

**Ports**: 8080, 9090, 3000, 40000 (debug)

**Usage**:
```typescript
const env = await engine.provision({
  id: 'my-go-api',
  type: 'devcontainer',
  template: 'go-backend',
  target: { type: 'local' }
});
```

---

### 5. fullstack-web
**Purpose**: Full-stack web development with Next.js

**Includes**:
- Next.js + React + TypeScript
- Tailwind CSS
- PostgreSQL (container)
- Redis (container)
- Prisma ORM
- Mailpit (email testing)
- MinIO (S3-compatible storage)

**Ports**: 3000 (Next.js), 5432 (Postgres), 6379 (Redis), 5555 (Prisma Studio), 8025 (Mailpit)

**Usage**:
```typescript
const env = await engine.provision({
  id: 'my-fullstack-app',
  type: 'devcontainer',
  template: 'fullstack-web',
  target: { type: 'local' }
});
```

---

### 6. nix-unified
**Purpose**: Universal development environment with Nix

**Includes**:
- All major languages (Node, Python, Rust, Go, Zig)
- Docker, Kubectl, Terraform
- Common CLI tools (ripgrep, fd, fzf)
- Reproducible builds with Nix flakes

**Ports**: 3000, 8080, 9000

**Usage**:
```typescript
const env = await engine.provision({
  id: 'my-nix-project',
  type: 'nix',
  template: 'nix-unified',
  target: { type: 'local' }
});
```

---

## Template Structure

Each template is a JSON file with the following structure:

```json
{
  "id": "template-id",
  "name": "Human Readable Name",
  "description": "What this template is for",
  "version": "1.0.0",
  "image": "base-docker-image",
  "features": ["ghcr.io/devcontainers/features/..."],
  "ports": [3000, 8080],
  "postCreateCommand": "command to run after creation",
  "customizations": {
    "vscode": {
      "extensions": [...],
      "settings": {...}
    }
  },
  "variables": {
    "ENV_VAR": {
      "default": "default_value",
      "description": "What this variable does"
    }
  }
}
```

## Creating Custom Templates

1. Copy an existing template as a starting point
2. Modify the `image`, `features`, and `postCreateCommand` as needed
3. Add any required `ports` for your application
4. Specify VS Code extensions in `customizations.vscode.extensions`
5. Define environment variables in `variables`

## Template Registry

Templates can be loaded from:
- Local filesystem (`./templates/*.json`)
- Remote URL (HTTP/HTTPS)
- Git repository
- Container registry

## Environment Variables

All templates support these standard variables:

- `DEVCONTAINER`: Set to `true` when running in a devcontainer
- `Allternit_ENV_ID`: The ID of the provisioned environment
- `Allternit_ENV_TYPE`: The type of environment (devcontainer/nix/sandbox)
