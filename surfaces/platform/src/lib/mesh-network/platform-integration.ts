/**
 * Allternit Platform Mesh Integration
 * 
 * Allows Allternit platform to join user's mesh network as a peer.
 * User hosts Headscale/Tailscale, invites Allternit platform to join.
 */

import { WireGuard } from './wireguard-platform';
import type { 
  MeshInvitation, 
  PlatformPeerConfig, 
  MeshJoinRequest,
  HeadscaleServerConfig,
  TailscaleServerConfig,
  MeshProvider,
} from './types';

// ============================================================================
// Platform Mesh Service
// ============================================================================

export class PlatformMeshService {
  private wireguard: WireGuard;
  private activeMeshes: Map<string, PlatformPeerConfig> = new Map();
  
  constructor() {
    this.wireguard = new WireGuard();
  }
  
  /**
   * Create an invitation for a user to add their mesh server
   * This generates the config the user needs to set up their Headscale/Tailscale
   */
  async createInvitation(params: {
    userId: string;
    provider: MeshProvider;
  }): Promise<MeshInvitation> {
    const invitationId = crypto.randomUUID();
    
    // Generate a pre-auth key for the platform to use
    // User will configure this in their mesh server
    const preAuthKey = `allternit-${Buffer.from(crypto.randomUUID()).toString('base64url').slice(0, 16)}`;
    
    const invitation: MeshInvitation = {
      id: invitationId,
      userId: params.userId,
      provider: params.provider,
      serverUrl: '', // User will fill this in
      preAuthKey,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      createdAt: new Date().toISOString(),
      used: false,
      tags: ['allternit-platform', 'trusted'],
    };
    
    // Store invitation
    await this.storeInvitation(invitation);
    
    return invitation;
  }
  
  /**
   * User accepts invitation with their mesh server details
   * Platform joins their mesh network
   */
  async acceptInvitation(
    invitationId: string,
    serverConfig: HeadscaleServerConfig | TailscaleServerConfig
  ): Promise<PlatformPeerConfig> {
    const invitation = await this.getInvitation(invitationId);
    if (!invitation) {
      throw new Error('Invitation not found or expired');
    }
    
    if (invitation.used) {
      throw new Error('Invitation already used');
    }
    
    // Generate platform's WireGuard keys
    const keypair = await this.wireguard.generateKeypair();
    
    // Generate mesh IP
    const meshIp = await this.allocateMeshIp(invitation.userId);
    
    // Join the mesh
    let joinResult: { success: boolean; error?: string };
    
    if (invitation.provider === 'headscale') {
      joinResult = await this.joinHeadscale(
        serverConfig as HeadscaleServerConfig,
        keypair.publicKey,
        meshIp,
        invitation.tags
      );
    } else {
      joinResult = await this.joinTailscale(
        serverConfig as TailscaleServerConfig,
        keypair.publicKey,
        meshIp,
        invitation.tags
      );
    }
    
    if (!joinResult.success) {
      throw new Error(`Failed to join mesh: ${joinResult.error}`);
    }
    
    // Create platform peer config
    const peerConfig: PlatformPeerConfig = {
      userId: invitation.userId,
      meshId: invitationId,
      privateKey: keypair.privateKey,
      publicKey: keypair.publicKey,
      meshIp,
      routes: ['10.64.0.0/10'], // Allow access to user's mesh
      dns: [],
    };
    
    // Configure WireGuard interface
    await this.configurePlatformPeer(peerConfig, serverConfig);
    
    // Store active mesh
    this.activeMeshes.set(invitation.userId, peerConfig);
    
    // Mark invitation as used
    await this.markInvitationUsed(invitationId);
    
    return peerConfig;
  }
  
  /**
   * Leave user's mesh network
   */
  async leaveMesh(userId: string): Promise<void> {
    const peerConfig = this.activeMeshes.get(userId);
    if (!peerConfig) {
      throw new Error('Not connected to user mesh');
    }
    
    // Remove WireGuard interface
    await this.wireguard.removeInterface(`allternit-${userId}`);
    
    // Remove from active meshes
    this.activeMeshes.delete(userId);
    
    // Notify mesh server (best effort)
    try {
      await this.deregisterFromMesh(peerConfig);
    } catch {
      // Ignore errors during deregistration
    }
  }
  
  /**
   * Get connection status to user's mesh
   */
  async getMeshStatus(userId: string): Promise<{
    connected: boolean;
    meshIp?: string;
    latency?: number;
    peers?: string[];
  }> {
    const peerConfig = this.activeMeshes.get(userId);
    if (!peerConfig) {
      return { connected: false };
    }
    
    try {
      const interfaceName = `allternit-${userId}`;
      const status = await this.wireguard.getStatus(interfaceName);
      
      // Ping mesh IP to check latency
      const start = Date.now();
      await this.ping(peerConfig.meshIp);
      const latency = Date.now() - start;
      
      return {
        connected: status.peers.length > 0,
        meshIp: peerConfig.meshIp,
        latency,
        peers: status.peers.map((p) => p.publicKey.slice(0, 16) + '...'),
      };
    } catch {
      return { connected: false };
    }
  }
  
  /**
   * Execute command on user's VPS through mesh
   */
  async executeOnNode(
    userId: string,
    nodeIp: string,
    command: string
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    const peerConfig = this.activeMeshes.get(userId);
    if (!peerConfig) {
      return { success: false, error: 'Not connected to user mesh' };
    }
    
    try {
      // Execute via SSH over WireGuard tunnel
      const result = await this.sshOverMesh(nodeIp, command, peerConfig);
      return { success: true, output: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  private async joinHeadscale(
    config: HeadscaleServerConfig,
    platformPublicKey: string,
    meshIp: string,
    tags: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Register platform node with Headscale
      const response = await fetch(`${config.serverUrl}/api/v1/machine/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: config.namespace,
          key: platformPublicKey,
          tags,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
  
  private async joinTailscale(
    config: TailscaleServerConfig,
    platformPublicKey: string,
    meshIp: string,
    tags: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Use Tailscale API to authorize key
      const response = await fetch(`https://api.tailscale.com/api/v2/tailnet/${config.tailnet}/keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          capabilities: {
            devices: {
              create: {
                reusable: false,
                ephemeral: false,
                preauthorized: true,
                tags,
              },
            },
          },
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
  
  private async configurePlatformPeer(
    peerConfig: PlatformPeerConfig,
    serverConfig: HeadscaleServerConfig | TailscaleServerConfig
  ): Promise<void> {
    const interfaceName = `allternit-${peerConfig.userId}`;
    
    // Create WireGuard interface
    await this.wireguard.createInterface({
      name: interfaceName,
      privateKey: peerConfig.privateKey,
      listenPort: 0, // Auto-assign
      addresses: [peerConfig.meshIp],
    });
    
    // Add routes to user's mesh
    for (const route of peerConfig.routes) {
      await this.wireguard.addRoute(interfaceName, route);
    }
    
    // Start interface
    await this.wireguard.startInterface(interfaceName);
  }
  
  private async allocateMeshIp(userId: string): Promise<string> {
    // Generate deterministic IP from userId
    // Using 100.64.0.0/10 CGNAT range (Tailscale/Headscale default)
    const hash = await this.hashUserId(userId);
    const octet2 = (hash[0] % 64) + 64; // 64-127
    const octet3 = hash[1];
    const octet4 = hash[2];
    
    return `100.${octet2}.${octet3}.${octet4}`;
  }
  
  private async hashUserId(userId: string): Promise<number[]> {
    const encoder = new TextEncoder();
    const data = encoder.encode(userId);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer));
  }
  
  private async ping(ip: string): Promise<void> {
    const response = await fetch(`http://${ip}:80/health`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      throw new Error('Ping failed');
    }
  }
  
  private async sshOverMesh(
    nodeIp: string,
    command: string,
    peerConfig: PlatformPeerConfig
  ): Promise<string> {
    // This would use a proper SSH client library
    // For now, placeholder that would execute the command
    throw new Error('SSH over mesh not yet implemented');
  }
  
  // ============================================================================
  // Storage (would be database in production)
  // ============================================================================
  
  private async storeInvitation(invitation: MeshInvitation): Promise<void> {
    // In production: store in database
    // For now: in-memory (would use Redis or similar)
  }
  
  private async getInvitation(invitationId: string): Promise<MeshInvitation | null> {
    // In production: fetch from database
    return null;
  }
  
  private async markInvitationUsed(invitationId: string): Promise<void> {
    // In production: update database
  }
  
  private async deregisterFromMesh(peerConfig: PlatformPeerConfig): Promise<void> {
    // In production: notify mesh server to remove peer
  }
}

// ============================================================================
// Headscale Setup Helper
// ============================================================================

export class HeadscaleSetupHelper {
  /**
   * Generate Docker Compose for user's Headscale server
   */
  static generateDockerCompose(): string {
    return `version: '3.8'

services:
  headscale:
    image: headscale/headscale:0.23.0
    container_name: headscale
    restart: unless-stopped
    command: serve
    ports:
      - "8080:8080"      # HTTP API
      - "9090:9090"      # Metrics  
      - "3478:3478/udp"  # DERP/STUN
    volumes:
      - ./config:/etc/headscale
      - ./data:/var/lib/headscale
    environment:
      - HEADSCALE_LOG_LEVEL=info
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - headscale

  # Optional: Web UI
  headscale-ui:
    image: ghcr.io/gurucomputing/headscale-ui:latest
    container_name: headscale-ui
    restart: unless-stopped
    ports:
      - "8081:80"
    environment:
      - HS_SERVER=http://localhost:8080
    depends_on:
      - headscale
    networks:
      - headscale

networks:
  headscale:
    driver: bridge
`;
  }
  
  /**
   * Generate Headscale config with Allternit integration
   */
  static generateConfig(userDomain: string): string {
    return `server_url: https://${userDomain}
listen_addr: 0.0.0.0:8080
metrics_listen_addr: 0.0.0.0:9090

# TLS (configure with Let's Encrypt in production)
tls_cert_path: ""
tls_key_path: ""

# Private key paths
private_key_path: /var/lib/headscale/private.key
noise:
  private_key_path: /var/lib/headscale/noise_private.key

# IP prefixes
ip_prefixes:
  - fd7a:115c:a1e0::/48
  - 100.64.0.0/10

# DERP configuration
derp:
  server:
    enabled: true
    region_id: 999
    region_code: "headscale"
    region_name: "Headscale DERP"
    stun_listen_addr: "0.0.0.0:3478"
    automatically_add_embedded_derp_region: true
  
  urls:
    - https://controlplane.tailscale.com/derpmap/default
  
  auto_update_enabled: true
  update_frequency: 24h

# DNS
dns_config:
  override_local_dns: true
  nameservers:
    - 1.1.1.1
  magic_dns: true
  base_domain: ${userDomain.split('.')[0]}.local

# Database
database:
  type: sqlite
  sqlite:
    path: /var/lib/headscale/db.sqlite

# Logging
log:
  format: text
  level: info

# Policy - permissive for Allternit integration
acl_policy_path: ""

# User namespace
user:
  - name: allternit
`;
  }
  
  /**
   * Generate setup instructions for user
   */
  static generateSetupInstructions(invitation: MeshInvitation): string {
    return `
# Allternit Mesh Network Setup

## 1. Deploy Headscale Server

Save this as docker-compose.yml and run:\\n\\n\\`\\`\\`bash
curl -fsSL https://setup.allternit.com/headscale-compose > docker-compose.yml
docker-compose up -d
\\`\\`\\`

## 2. Create API Key

\\`\\`\\`bash
docker exec headscale headscale apikeys create --expiration 90d
\\`\\`\\`

Save this key - you'll need it to connect Allternit.

## 3. Configure Allternit

In your Allternit dashboard:
1. Go to Settings → Infrastructure → Mesh Network
2. Select "Headscale"
3. Enter:
   - Server URL: https://your-domain.com:8080
   - API Key: (from step 2)
   - Namespace: allternit
4. Click "Connect"

## 4. Add Your VPS

On each VPS you want to connect:
\\`\\`\\`bash
curl -fsSL https://install.allternit.com/${invitation.id} | bash
\\`\\`\\`

## Security Notes

- Headscale server is hosted by YOU on YOUR infrastructure
- Allternit platform connects to YOUR server
- You control all keys and access
- Allternit cannot access your infrastructure without your permission

## Support

Docs: https://docs.allternit.com/mesh
Community: https://discord.allternit.com
`;
  }
}
