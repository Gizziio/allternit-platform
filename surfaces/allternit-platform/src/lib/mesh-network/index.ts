/**
 * Allternit Mesh Network - BYOC WireGuard Integration
 * 
 * Production-grade mesh networking for BYOC users.
 * Users host their own Headscale/Tailscale, Allternit joins as peer.
 */

// Types
export * from './types';

// Agent
export { MeshAgent } from './agent/agent';
export { generateInstallScript } from './agent/install';

// Deployment
export { 
  generateHeadscaleServerScript, 
  generateHeadscaleUpdateScript 
} from './deploy/headscale-install';

// Platform Integration
export { PlatformMeshService, HeadscaleSetupHelper } from './platform-integration';

// VPS Setup Integration
export * from './integrations/vps-setup';

// WireGuard
export { WireGuard } from './wireguard-platform';

// Version
export const MESH_NETWORK_VERSION = '1.0.0';
