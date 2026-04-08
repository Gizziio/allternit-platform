/**
 * WireGuard Platform Integration
 * 
 * Manages WireGuard interfaces on the Allternit platform side
 * to connect to user-hosted mesh networks.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface WireGuardInterface {
  name: string;
  privateKey: string;
  publicKey?: string;
  listenPort?: number;
  addresses: string[];
  dns?: string[];
  peers: WireGuardPeer[];
}

export interface WireGuardPeer {
  publicKey: string;
  presharedKey?: string;
  allowedIps: string[];
  endpoint?: string;
  persistentKeepalive?: number;
}

export class WireGuard {
  /**
   * Generate a new WireGuard keypair
   */
  async generateKeypair(): Promise<{ privateKey: string; publicKey: string }> {
    // In production, this would use the actual wg command
    // For TypeScript/Node.js, we'd use a native addon or spawn wg
    
    const { stdout: privateKey } = await execAsync('wg genkey');
    const { stdout: publicKey } = await execAsync(`echo '${privateKey.trim()}' | wg pubkey`);
    
    return {
      privateKey: privateKey.trim(),
      publicKey: publicKey.trim(),
    };
  }
  
  /**
   * Create a WireGuard interface
   */
  async createInterface(config: {
    name: string;
    privateKey: string;
    listenPort?: number;
    addresses: string[];
    dns?: string[];
  }): Promise<void> {
    // Create interface config
    let conf = `[Interface]\n`;
    conf += `PrivateKey = ${config.privateKey}\n`;
    
    if (config.listenPort) {
      conf += `ListenPort = ${config.listenPort}\n`;
    }
    
    // Create interface
    await execAsync(`sudo ip link add dev ${config.name} type wireguard`);
    
    // Set config
    await execAsync(`echo '${conf}' | sudo wg setconf ${config.name} /dev/stdin`);
    
    // Add addresses
    for (const addr of config.addresses) {
      await execAsync(`sudo ip address add dev ${config.name} ${addr}`);
    }
    
    // Add DNS if specified
    if (config.dns && config.dns.length > 0) {
      // DNS would be handled by resolvconf or systemd-resolved
    }
  }
  
  /**
   * Add a peer to an interface
   */
  async addPeer(interfaceName: string, peer: WireGuardPeer): Promise<void> {
    let cmd = `sudo wg set ${interfaceName} peer ${peer.publicKey}`;
    
    if (peer.presharedKey) {
      cmd += ` preshared-key <(echo '${peer.presharedKey}')`;
    }
    
    if (peer.allowedIps.length > 0) {
      cmd += ` allowed-ips ${peer.allowedIps.join(',')}`;
    }
    
    if (peer.endpoint) {
      cmd += ` endpoint ${peer.endpoint}`;
    }
    
    if (peer.persistentKeepalive) {
      cmd += ` persistent-keepalive ${peer.persistentKeepalive}`;
    }
    
    await execAsync(cmd);
  }
  
  /**
   * Remove a peer from an interface
   */
  async removePeer(interfaceName: string, publicKey: string): Promise<void> {
    await execAsync(`sudo wg set ${interfaceName} peer ${publicKey} remove`);
  }
  
  /**
   * Start (bring up) an interface
   */
  async startInterface(name: string): Promise<void> {
    await execAsync(`sudo ip link set up dev ${name}`);
  }
  
  /**
   * Stop (bring down) an interface
   */
  async stopInterface(name: string): Promise<void> {
    await execAsync(`sudo ip link set down dev ${name} 2>/dev/null || true`);
    await execAsync(`sudo ip link delete dev ${name} 2>/dev/null || true`);
  }
  
  /**
   * Remove an interface completely
   */
  async removeInterface(name: string): Promise<void> {
    try {
      await execAsync(`sudo ip link delete dev ${name}`);
    } catch {
      // Interface might not exist
    }
  }
  
  /**
   * Get interface status
   */
  async getStatus(name: string): Promise<{
    publicKey?: string;
    listenPort?: number;
    fwmark?: number;
    peers: Array<{
      publicKey: string;
      presharedKey: boolean;
      endpoint?: string;
      allowedIps: string[];
      latestHandshake?: Date;
      transferRx: number;
      transferTx: number;
      persistentKeepalive?: number;
    }>;
  }> {
    const { stdout } = await execAsync(`sudo wg show ${name}`);
    
    // Parse wg show output
    const lines = stdout.split('\n');
    const peers: Array<{
      publicKey: string;
      presharedKey: boolean;
      endpoint?: string;
      allowedIps: string[];
      latestHandshake?: Date;
      transferRx: number;
      transferTx: number;
      persistentKeepalive?: number;
    }> = [];
    
    let currentPeer: typeof peers[0] | null = null;
    let interfacePublicKey: string | undefined;
    let listenPort: number | undefined;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('interface:')) {
        // Interface name - ignore
      } else if (trimmed.startsWith('public key:')) {
        interfacePublicKey = trimmed.replace('public key:', '').trim();
      } else if (trimmed.startsWith('listening port:')) {
        listenPort = parseInt(trimmed.replace('listening port:', '').trim());
      } else if (trimmed.startsWith('peer:')) {
        if (currentPeer) peers.push(currentPeer);
        currentPeer = {
          publicKey: trimmed.replace('peer:', '').trim(),
          presharedKey: false,
          allowedIps: [],
          transferRx: 0,
          transferTx: 0,
        };
      } else if (currentPeer && trimmed.startsWith('preshared key:')) {
        currentPeer.presharedKey = trimmed.includes('(hidden)') || trimmed.length > 20;
      } else if (currentPeer && trimmed.startsWith('endpoint:')) {
        currentPeer.endpoint = trimmed.replace('endpoint:', '').trim();
      } else if (currentPeer && trimmed.startsWith('allowed ips:')) {
        currentPeer.allowedIps = trimmed
          .replace('allowed ips:', '')
          .trim()
          .split(',')
          .map((ip) => ip.trim());
      } else if (currentPeer && trimmed.startsWith('latest handshake:')) {
        const timeStr = trimmed.replace('latest handshake:', '').trim();
        currentPeer.latestHandshake = this.parseHandshakeTime(timeStr);
      } else if (currentPeer && trimmed.startsWith('transfer:')) {
        const match = trimmed.match(/(\d+(?:\.\d+)?\s*(?:B|KiB|MiB|GiB)) received, (\d+(?:\.\d+)?\s*(?:B|KiB|MiB|GiB)) sent/);
        if (match) {
          currentPeer.transferRx = this.parseTransfer(match[1]);
          currentPeer.transferTx = this.parseTransfer(match[2]);
        }
      } else if (currentPeer && trimmed.startsWith('persistent keepalive:')) {
        const match = trimmed.match(/every (\d+) seconds/);
        if (match) {
          currentPeer.persistentKeepalive = parseInt(match[1]);
        }
      }
    }
    
    if (currentPeer) peers.push(currentPeer);
    
    return {
      publicKey: interfacePublicKey,
      listenPort,
      peers,
    };
  }
  
  /**
   * Add a route through the interface
   */
  async addRoute(interfaceName: string, destination: string): Promise<void> {
    await execAsync(`sudo ip route add ${destination} dev ${interfaceName}`);
  }
  
  /**
   * Remove a route
   */
  async removeRoute(interfaceName: string, destination: string): Promise<void> {
    await execAsync(`sudo ip route del ${destination} dev ${interfaceName} 2>/dev/null || true`);
  }
  
  // ============================================================================
  // Helper Methods
  // ============================================================================
  
  private parseHandshakeTime(timeStr: string): Date | undefined {
    // Parse strings like "1 minute, 23 seconds ago"
    // or "2024-01-15 10:30:45"
    
    if (timeStr.includes('ago')) {
      const now = new Date();
      
      // Extract time components
      const days = timeStr.match(/(\d+) day/)?.[1];
      const hours = timeStr.match(/(\d+) hour/)?.[1];
      const minutes = timeStr.match(/(\d+) minute/)?.[1];
      const seconds = timeStr.match(/(\d+) second/)?.[1];
      
      let msAgo = 0;
      if (days) msAgo += parseInt(days) * 24 * 60 * 60 * 1000;
      if (hours) msAgo += parseInt(hours) * 60 * 60 * 1000;
      if (minutes) msAgo += parseInt(minutes) * 60 * 1000;
      if (seconds) msAgo += parseInt(seconds) * 1000;
      
      return new Date(now.getTime() - msAgo);
    }
    
    return new Date(timeStr);
  }
  
  private parseTransfer(value: string): number {
    const match = value.match(/(\d+(?:\.\d+)?)\s*(B|KiB|MiB|GiB)/);
    if (!match) return 0;
    
    const num = parseFloat(match[1]);
    const unit = match[2];
    
    const multipliers: Record<string, number> = {
      B: 1,
      KiB: 1024,
      MiB: 1024 * 1024,
      GiB: 1024 * 1024 * 1024,
    };
    
    return num * (multipliers[unit] || 1);
  }
}
