# A2R Infrastructure Examples

This directory contains usage examples for the A2R Infrastructure runtime.

## Files

### basic-usage.ts
Complete examples showing:
- Node.js environment provisioning
- Nix environment setup
- Sandbox creation
- Remote SSH targets
- Cloud instance provisioning
- Event handling
- Direct runtime usage

### Running Examples

```bash
# From the project root
npm run build
npx tsx examples/basic-usage.ts
```

## Example Snippets

### Quick Start - Local Dev Container

```typescript
import { EnvironmentEngine } from '@allternit/infrastructure';

const engine = new EnvironmentEngine();

const env = await engine.provision({
  id: 'my-app',
  type: 'devcontainer',
  template: 'node-typescript',
  target: { type: 'local' },
});

// Your environment is ready!
console.log(env.endpoints);

// Clean up when done
await engine.destroy(env.id);
```

### Remote Development

```typescript
const env = await engine.provision({
  id: 'remote-dev',
  type: 'devcontainer',
  template: 'rust-systems',
  target: {
    type: 'ssh',
    host: 'dev.example.com',
    username: 'developer',
    privateKey: '~/.ssh/id_rsa',
  },
});
```

### Secure Sandbox

```typescript
const sandbox = await engine.provision({
  id: 'secure-sandbox',
  type: 'sandbox',
  target: { type: 'local' },
  resources: { cpu: 0.5, memory: '256Mi' },
  networking: { networkMode: 'none' },
});
```
