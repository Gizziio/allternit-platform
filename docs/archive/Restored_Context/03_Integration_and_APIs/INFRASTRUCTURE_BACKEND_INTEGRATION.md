# Allternit Infrastructure Backend Integration Architecture

## Current State

### Existing Components
1. **VPSConnectionsPanel** - Zustand store with local persistence
2. **CloudDeployApi** - REST client for deployments with WebSocket events
3. **ProviderAuthService** - AI model provider auth (separate concern)

## Integration Plan

### Phase 1: Wire Existing Components (Immediate)

#### Update InfrastructureSettings to use real stores:

```typescript
// Import existing stores
import { useVPSStore } from '@/stores/vpsConnections';
import { cloudDeployApi } from '@/views/cloud-deploy/lib/api-client';

// Wire data
const vpsConnections = useVPSStore(state => state.connections);
const deployments = useCloudDeploymentStore(); // Need to create
```

### Phase 2: Create Unified Infrastructure Store

```typescript
// stores/infrastructureStore.ts
interface InfrastructureState {
  vpsConnections: VPSConnection[];
  deployments: Deployment[];
  environments: Environment[];
  sshKeys: SSHKey[];
  
  // VPS Actions
  addVPSConnection: (conn: VPSConnectionInput) => Promise<void>;
  testVPSConnection: (id: string) => Promise<boolean>;
  
  // Cloud Actions  
  createDeployment: (config: DeploymentConfig) => Promise<Deployment>;
  cancelDeployment: (id: string) => Promise<void>;
  
  // Environment Actions
  provisionEnvironment: (templateId: string, target: string) => Promise<Environment>;
}
```

### Phase 3: Backend API Endpoints Needed

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/vps` | POST | Connect new VPS |
| `/api/v1/vps/:id/test` | GET | Test connection |
| `/api/v1/vps/:id/install` | POST | Install Allternit node |
| `/api/v1/deployments` | GET/POST | List/Create deployments |
| `/api/v1/deployments/:id/events` | WS | Real-time deployment logs |
| `/api/v1/environments/templates` | GET | List env templates |
| `/api/v1/environments` | POST | Provision environment |
| `/api/v1/ssh-keys` | GET/POST | Manage SSH keys |

### Phase 4: Provider Integration Priority

1. **Hetzner** - Already implemented, needs UI wiring
2. **DigitalOcean** - API ready, needs implementation
3. **AWS** - Requires IAM setup flow
4. **Contabo/RackNerd** - Affiliate links only (no API)

### Phase 5: Environment Runtime Support

| Runtime | Status | Use Case |
|---------|--------|----------|
| Dev Containers | Ready | Local dev with VS Code |
| Nix Flakes | Ready | Reproducible builds |
| Docker Sandbox | Ready | Agent isolation |
| Kata Containers | Planned | VM-level isolation |
| Firecracker | Planned | MicroVMs for agents |

## Implementation Checklist

- [ ] Wire InfrastructureSettings to VPS store
- [ ] Wire InfrastructureSettings to CloudDeployApi
- [ ] Create environment provisioning API
- [ ] Add SSH key management endpoints
- [ ] Implement provider credential validation
- [ ] Add real-time deployment progress (WebSocket)
- [ ] Create environment template execution engine
