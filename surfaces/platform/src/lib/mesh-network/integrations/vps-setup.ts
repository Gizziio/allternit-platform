/**
 * VPS Setup Integration with Mesh Network
 * 
 * Integrates mesh network setup into the VPS setup flow.
 * Users can choose to enable mesh networking during VPS onboarding.
 */

import { 
  generateHeadscaleServerScript, 
  generateHeadscaleUpdateScript 
} from '../deploy/headscale-install';
import { generateInstallScript } from '../agent/install';
import type { 
  HeadscaleServerConfig, 
  MeshProvider, 
  VPSRegistrationResponse 
} from '../types';

// ============================================================================
// VPS Setup Flow Types
// ============================================================================

export interface VPSWithMeshSetup {
  // VPS Details
  vpsId: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'key';
  
  // Mesh Configuration
  enableMesh: boolean;
  meshProvider: MeshProvider;
  meshServerUrl?: string;
  meshApiKey?: string;
  
  // Installation
  installAgent: boolean;
  autoConfigureFirewall: boolean;
}

export interface VPSSetupResult {
  vpsId: string;
  connected: boolean;
  meshConnected: boolean;
  meshIp?: string;
  installScriptUrl: string;
  agentInstallCommand: string;
  headscaleInstallCommand?: string;
}

// ============================================================================
// VPS Setup Service
// ============================================================================

export class VPSSetupService {
  /**
   * Complete VPS setup with optional mesh networking
   */
  async setupVPS(params: VPSWithMeshSetup): Promise<VPSSetupResult> {
    const result: VPSSetupResult = {
      vpsId: params.vpsId,
      connected: false,
      meshConnected: false,
      installScriptUrl: '',
      agentInstallCommand: '',
    };
    
    // Step 1: Test basic SSH connectivity
    const sshTest = await this.testSSHConnection({
      host: params.host,
      port: params.port,
      username: params.username,
      authMethod: params.authMethod,
    });
    
    if (!sshTest.success) {
      throw new Error(`SSH connection failed: ${sshTest.error}`);
    }
    
    result.connected = true;
    
    // Step 2: Setup mesh if enabled
    if (params.enableMesh) {
      if (params.meshProvider === 'headscale') {
        // Check if Headscale server exists
        if (!params.meshServerUrl) {
          // User wants us to help set up Headscale on their VPS
          const headscaleSetup = await this.setupHeadscaleOnVPS(params);
          result.headscaleInstallCommand = headscaleSetup.installCommand;
          result.meshServerUrl = `https://${params.host}`;
        } else {
          // Use existing Headscale server
          result.meshServerUrl = params.meshServerUrl;
        }
        
        // Register VPS with mesh
        const meshRegistration = await this.registerVPSWithMesh(params);
        result.meshConnected = meshRegistration.success;
        result.meshIp = meshRegistration.meshIp;
        
        // Generate agent install command
        result.agentInstallCommand = this.generateAgentInstallCommand({
          vpsId: params.vpsId,
          meshProvider: 'headscale',
          meshServerUrl: result.meshServerUrl!,
          meshApiKey: params.meshApiKey,
        });
      }
    } else {
      // Traditional SSH-only setup (no mesh)
      result.agentInstallCommand = this.generateTraditionalSetupCommand(params);
    }
    
    return result;
  }
  
  /**
   * Setup Headscale server on the user's VPS
   */
  private async setupHeadscaleOnVPS(
    params: VPSWithMeshSetup
  ): Promise<{ installCommand: string; domain: string }> {
    const domain = params.host; // Use VPS IP or domain
    
    const installScript = generateHeadscaleServerScript({
      domain,
      port: 8080,
      withWebUI: true,
    });
    
    // The script would be executed on the VPS via SSH
    const installCommand = `curl -fsSL https://install.allternit.com/headscale | sudo bash -s -- --domain ${domain}`;
    
    return {
      installCommand,
      domain,
    };
  }
  
  /**
   * Register VPS with mesh network
   */
  private async registerVPSWithMesh(
    params: VPSWithMeshSetup
  ): Promise<{ success: boolean; meshIp?: string }> {
    // This would call the Headscale API to register the node
    // and return the assigned mesh IP
    
    // Placeholder implementation
    return {
      success: true,
      meshIp: `100.64.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
    };
  }
  
  /**
   * Test SSH connection to VPS
   */
  private async testSSHConnection(params: {
    host: string;
    port: number;
    username: string;
    authMethod: 'password' | 'key';
  }): Promise<{ success: boolean; error?: string }> {
    // This would use the existing SSH test infrastructure
    // Placeholder for now
    return { success: true };
  }
  
  /**
   * Generate one-line agent install command
   */
  private generateAgentInstallCommand(params: {
    vpsId: string;
    meshProvider: MeshProvider;
    meshServerUrl: string;
    meshApiKey?: string;
  }): string {
    const setupToken = this.generateSetupToken(params.vpsId);
    
    return `curl -fsSL https://install.allternit.com/agent | sudo bash -s -- \\
  --vps-id ${params.vpsId} \\
  --mesh-provider ${params.meshProvider} \\
  --mesh-server ${params.meshServerUrl} \\
  --setup-token ${setupToken}`;
  }
  
  /**
   * Generate traditional (non-mesh) setup command
   */
  private generateTraditionalSetupCommand(params: VPSWithMeshSetup): string {
    // For users who don't want mesh, we can still offer a lightweight agent
    return `curl -fsSL https://install.allternit.com/agent-minimal | sudo bash -s -- --vps-id ${params.vpsId}`;
  }
  
  /**
   * Generate setup token for VPS authentication
   */
  private generateSetupToken(vpsId: string): string {
    // In production: JWT or similar
    return `tok_${Buffer.from(`${vpsId}:${Date.now()}`).toString('base64url')}`;
  }
}

// ============================================================================
// Onboarding Wizard Integration
// ============================================================================

export interface MeshOnboardingStep {
  id: 'choose-method' | 'existing-server' | 'new-server' | 'verify' | 'connect';
  title: string;
  description: string;
}

export const MESH_ONBOARDING_STEPS: MeshOnboardingStep[] = [
  {
    id: 'choose-method',
    title: 'Choose Mesh Setup Method',
    description: 'Use your own Headscale server or let us help you set one up',
  },
  {
    id: 'existing-server',
    title: 'Connect Existing Server',
    description: 'Enter your Headscale or Tailscale server details',
  },
  {
    id: 'new-server',
    title: 'Setup New Server',
    description: 'We\'ll install Headscale on your VPS',
  },
  {
    id: 'verify',
    title: 'Verify Connection',
    description: 'Test connectivity to your mesh server',
  },
  {
    id: 'connect',
    title: 'Connect VPS',
    description: 'Install agent on your VPS and join the mesh',
  },
];

/**
 * Generate onboarding wizard data
 */
export function generateOnboardingData(userId: string): {
  invitationId: string;
  setupUrl: string;
  installCommands: {
    headscale: string;
    agent: string;
  };
} {
  const invitationId = `inv_${Buffer.from(`${userId}:${Date.now()}`).toString('base64url').slice(0, 16)}`;
  
  return {
    invitationId,
    setupUrl: `https://allternit.com/setup/mesh/${invitationId}`,
    installCommands: {
      headscale: 'curl -fsSL https://install.allternit.com/headscale | sudo bash',
      agent: `curl -fsSL https://install.allternit.com/agent | sudo bash -s -- --invite ${invitationId}`,
    },
  };
}

// ============================================================================
// UI Components Data
// ============================================================================

export interface MeshSetupOption {
  id: 'skip' | 'existing' | 'new';
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  recommended?: boolean;
}

export const MESH_SETUP_OPTIONS: MeshSetupOption[] = [
  {
    id: 'skip',
    title: 'Traditional SSH Only',
    description: 'Connect to your VPS via SSH only, no mesh network',
    pros: ['Simple setup', 'Works everywhere', 'No additional software'],
    cons: ['SSH keys required', 'No automatic failover', 'Manual network config'],
  },
  {
    id: 'existing',
    title: 'Use My Headscale/Tailscale',
    description: 'Connect Allternit to your existing mesh server',
    pros: ['You control everything', 'Already configured', 'Existing network'],
    cons: ['Requires existing server', 'Manual API key setup'],
  },
  {
    id: 'new',
    title: 'Setup New Mesh Server',
    description: 'Install Headscale on this VPS automatically',
    pros: ['One-click setup', 'Fully automated', 'Zero configuration', 'Free forever'],
    cons: ['Uses extra resources', 'Requires port 8080'],
    recommended: true,
  },
];

// ============================================================================
// Settings Panel Integration
// ============================================================================

export interface MeshSettingsState {
  enabled: boolean;
  provider: MeshProvider | null;
  serverStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  serverUrl?: string;
  nodes: Array<{
    id: string;
    name: string;
    ip: string;
    status: 'online' | 'offline' | 'unknown';
    lastSeen: string;
  }>;
  errorMessage?: string;
}

export function getDefaultMeshSettings(): MeshSettingsState {
  return {
    enabled: false,
    provider: null,
    serverStatus: 'disconnected',
    nodes: [],
  };
}
