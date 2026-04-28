/**
 * Allternit Mesh Agent - Core Implementation
 * 
 * Production-grade TypeScript agent for WireGuard mesh networking.
 * Runs on user's VPS as unprivileged service.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import type { 
  MeshAgentConfig, 
  MeshAgentStatus, 
  MeshHealthStatus,
  AgentUpdateInfo,
  AgentUpdateProgress,
  HeadscaleServerConfig,
} from '../types';

const execAsync = promisify(exec);

// ============================================================================
// Configuration
// ============================================================================

const AGENT_CONFIG_PATH = process.env.AGENT_CONFIG || '/etc/allternit/agent.json';
const AGENT_LOG_LEVEL = process.env.AGENT_LOG_LEVEL || 'info';

// ============================================================================
// Logger
// ============================================================================

class Logger {
  private level: string;
  
  constructor(level: string = 'info') {
    this.level = level;
  }
  
  private log(level: string, message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      agent: 'allternit-agent',
      ...meta,
    };
    
    // Output to stdout (systemd will capture to journal)
    console.log(JSON.stringify(logEntry));
  }
  
  debug(message: string, meta?: Record<string, unknown>) {
    if (this.level === 'debug') {
      this.log('debug', message, meta);
    }
  }
  
  info(message: string, meta?: Record<string, unknown>) {
    this.log('info', message, meta);
  }
  
  warn(message: string, meta?: Record<string, unknown>) {
    this.log('warn', message, meta);
  }
  
  error(message: string, meta?: Record<string, unknown>) {
    this.log('error', message, meta);
  }
}

const logger = new Logger(AGENT_LOG_LEVEL);

// ============================================================================
// WireGuard Manager
// ============================================================================

class WireGuardManager {
  private interfaceName: string = 'allternit';
  private configPath: string = '/etc/wireguard';
  
  async isInstalled(): Promise<boolean> {
    try {
      await execAsync('which wg');
      return true;
    } catch {
      return false;
    }
  }
  
  async generateKeypair(): Promise<{ privateKey: string; publicKey: string }> {
    const { stdout: privateKey } = await execAsync('wg genkey');
    const { stdout: publicKey } = await execAsync(`echo '${privateKey.trim()}' | wg pubkey`);
    
    return {
      privateKey: privateKey.trim(),
      publicKey: publicKey.trim(),
    };
  }
  
  async createInterface(config: {
    privateKey: string;
    listenPort?: number;
    addresses: string[];
    dns?: string[];
  }): Promise<void> {
    const confPath = join(this.configPath, `${this.interfaceName}.conf`);
    
    let configContent = `[Interface]\n`;
    configContent += `PrivateKey = ${config.privateKey}\n`;
    configContent += `Address = ${config.addresses.join(', ')}\n`;
    
    if (config.listenPort) {
      configContent += `ListenPort = ${config.listenPort}\n`;
    }
    
    if (config.dns && config.dns.length > 0) {
      configContent += `DNS = ${config.dns.join(', ')}\n`;
    }
    
    await writeFile(confPath, configContent, { mode: 0o600 });
    logger.info('WireGuard interface config created', { interface: this.interfaceName });
  }
  
  async addPeer(peer: {
    publicKey: string;
    allowedIps: string[];
    endpoint?: string;
    persistentKeepalive?: number;
  }): Promise<void> {
    const confPath = join(this.configPath, `${this.interfaceName}.conf`);
    
    let peerConfig = `\n[Peer]\n`;
    peerConfig += `PublicKey = ${peer.publicKey}\n`;
    peerConfig += `AllowedIPs = ${peer.allowedIps.join(', ')}\n`;
    
    if (peer.endpoint) {
      peerConfig += `Endpoint = ${peer.endpoint}\n`;
    }
    
    if (peer.persistentKeepalive) {
      peerConfig += `PersistentKeepalive = ${peer.persistentKeepalive}\n`;
    }
    
    await execAsync(`echo '${peerConfig}' | sudo tee -a ${confPath}`);
    logger.info('WireGuard peer added', { publicKey: peer.publicKey.slice(0, 16) + '...' });
  }
  
  async startInterface(): Promise<void> {
    try {
      await execAsync(`sudo wg-quick up ${this.interfaceName}`);
      logger.info('WireGuard interface started', { interface: this.interfaceName });
    } catch (error) {
      logger.error('Failed to start WireGuard interface', { error: String(error) });
      throw error;
    }
  }
  
  async stopInterface(): Promise<void> {
    try {
      await execAsync(`sudo wg-quick down ${this.interfaceName} 2>/dev/null || true`);
      logger.info('WireGuard interface stopped');
    } catch {
      // Ignore errors during stop
    }
  }
  
  async getStatus(): Promise<{
    publicKey?: string;
    listenPort?: number;
    peers: Array<{
      publicKey: string;
      endpoint?: string;
      allowedIps: string[];
      latestHandshake?: string;
      transferRx: number;
      transferTx: number;
    }>;
  }> {
    try {
      const { stdout } = await execAsync(`sudo wg show ${this.interfaceName}`);
      
      // Parse wg show output
      const lines = stdout.split('\n');
      const peers: Array<{
        publicKey: string;
        endpoint?: string;
        allowedIps: string[];
        latestHandshake?: string;
        transferRx: number;
        transferTx: number;
      }> = [];
      
      let currentPeer: typeof peers[0] | null = null;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('peer:')) {
          if (currentPeer) peers.push(currentPeer);
          currentPeer = {
            publicKey: trimmed.replace('peer:', '').trim(),
            allowedIps: [],
            transferRx: 0,
            transferTx: 0,
          };
        } else if (currentPeer && trimmed.startsWith('endpoint:')) {
          currentPeer.endpoint = trimmed.replace('endpoint:', '').trim();
        } else if (currentPeer && trimmed.startsWith('allowed ips:')) {
          currentPeer.allowedIps = trimmed
            .replace('allowed ips:', '')
            .trim()
            .split(',')
            .map((ip) => ip.trim());
        } else if (currentPeer && trimmed.startsWith('latest handshake:')) {
          currentPeer.latestHandshake = trimmed.replace('latest handshake:', '').trim();
        } else if (currentPeer && trimmed.startsWith('transfer:')) {
          const match = trimmed.match(/(\d+\.?\d*\s*(?:B|KiB|MiB|GiB)) received, (\d+\.?\d*\s*(?:B|KiB|MiB|GiB)) sent/);
          if (match) {
            currentPeer.transferRx = this.parseTransfer(match[1]);
            currentPeer.transferTx = this.parseTransfer(match[2]);
          }
        }
      }
      
      if (currentPeer) peers.push(currentPeer);
      
      return { peers };
    } catch {
      return { peers: [] };
    }
  }
  
  private parseTransfer(value: string): number {
    const match = value.match(/(\d+\.?\d*)\s*(B|KiB|MiB|GiB)/);
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

// ============================================================================
// Headscale Client
// ============================================================================

class HeadscaleClient {
  private serverUrl: string;
  private apiKey: string;
  
  constructor(config: HeadscaleServerConfig) {
    this.serverUrl = config.serverUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }
  
  async registerNode(params: {
    name: string;
    publicKey: string;
    os: string;
    arch: string;
  }): Promise<{ machineId: string; ipAddresses: string[] }> {
    const response = await fetch(`${this.serverUrl}/api/v1/machine`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: params.publicKey,
        name: params.name,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to register node: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      machineId: data.machine.id,
      ipAddresses: data.machine.ipAddresses,
    };
  }
  
  async getNode(machineId: string): Promise<{ online: boolean; lastSeen: string }> {
    const response = await fetch(`${this.serverUrl}/api/v1/machine/${machineId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get node: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      online: data.machine.online,
      lastSeen: data.machine.lastSeen,
    };
  }
}

// ============================================================================
// Auto-Updater
// ============================================================================

class AutoUpdater {
  private currentVersion: string;
  private updateServer: string;
  
  constructor(version: string, updateServer: string = 'https://updates.allternit.com') {
    this.currentVersion = version;
    this.updateServer = updateServer;
  }
  
  async checkForUpdate(): Promise<AgentUpdateInfo | null> {
    try {
      const response = await fetch(`${this.updateServer}/agent/latest.json`);
      if (!response.ok) return null;
      
      const info: AgentUpdateInfo = await response.json();
      
      if (this.compareVersions(info.latestVersion, this.currentVersion) > 0) {
        return info;
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to check for updates', { error: String(error) });
      return null;
    }
  }
  
  async performUpdate(updateInfo: AgentUpdateInfo, onProgress: (progress: AgentUpdateProgress) => void): Promise<boolean> {
    try {
      onProgress({ state: 'downloading', progress: 0, message: 'Downloading update...' });
      
      // Download new binary
      const response = await fetch(updateInfo.downloadUrl);
      if (!response.ok) {
        throw new Error('Failed to download update');
      }
      
      const binaryBuffer = Buffer.from(await response.arrayBuffer());
      
      onProgress({ state: 'verifying', progress: 50, message: 'Verifying checksum...' });
      
      // Verify checksum
      const checksum = createHash('sha256').update(binaryBuffer).digest('hex');
      if (checksum !== updateInfo.checksum) {
        throw new Error('Checksum verification failed');
      }
      
      onProgress({ state: 'installing', progress: 75, message: 'Installing update...' });
      
      // Backup current binary
      const agentPath = '/opt/allternit-agent/agent';
      const backupPath = `${agentPath}.backup`;
      await execAsync(`cp ${agentPath} ${backupPath}`);
      
      try {
        // Write new binary
        await writeFile(`${agentPath}.new`, binaryBuffer, { mode: 0o755 });
        
        // Atomically replace
        await execAsync(`mv ${agentPath}.new ${agentPath}`);
        
        onProgress({ state: 'restarting', progress: 90, message: 'Restarting agent...' });
        
        // Restart service
        await execAsync('systemctl restart allternit-agent');
        
        onProgress({ state: 'complete', progress: 100, message: 'Update complete!' });
        
        return true;
      } catch (error) {
        // Rollback
        await execAsync(`mv ${backupPath} ${agentPath}`);
        throw error;
      }
    } catch (error) {
      onProgress({ 
        state: 'error', 
        progress: 0, 
        message: 'Update failed',
        error: String(error),
      });
      return false;
    }
  }
  
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    
    return 0;
  }
}

// ============================================================================
// Health Checker
// ============================================================================

class HealthChecker {
  private agentId: string;
  private checks: Array<() => Promise<{ name: string; status: 'healthy' | 'degraded' | 'unhealthy'; latencyMs?: number }>>;
  
  constructor(agentId: string) {
    this.agentId = agentId;
    this.checks = [
      this.checkWireGuard.bind(this),
      this.checkConnectivity.bind(this),
      this.checkDNS.bind(this),
    ];
  }
  
  async runChecks(): Promise<MeshHealthStatus> {
    const timestamp = new Date().toISOString();
    const checkResults = await Promise.all(this.checks.map((check) => check()));
    
    const checks: MeshHealthStatus['checks'] = {
      wireguard: 'healthy',
      connectionToServer: 'healthy',
      connectionToPlatform: 'healthy',
      dnsResolution: 'healthy',
    };
    
    const latencies: number[] = [];
    
    for (const result of checkResults) {
      switch (result.name) {
        case 'wireguard':
          checks.wireguard = result.status;
          break;
        case 'connectivity':
          checks.connectionToServer = result.status;
          break;
        case 'dns':
          checks.dnsResolution = result.status;
          break;
      }
      
      if (result.latencyMs) {
        latencies.push(result.latencyMs);
      }
    }
    
    const sortedLatencies = latencies.sort((a, b) => a - b);
    const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0;
    const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;
    
    return {
      agentId: this.agentId,
      timestamp,
      checks,
      metrics: {
        latencyP50: p50,
        latencyP99: p99,
        packetLoss: 0, // TODO: Implement packet loss detection
        throughputRx: 0,
        throughputTx: 0,
      },
    };
  }
  
  private async checkWireGuard(): Promise<{ name: string; status: 'healthy' | 'degraded' | 'unhealthy' }> {
    try {
      const { stdout } = await execAsync('sudo wg show allternit');
      return { name: 'wireguard', status: stdout.includes('peer:') ? 'healthy' : 'degraded' };
    } catch {
      return { name: 'wireguard', status: 'unhealthy' };
    }
  }
  
  private async checkConnectivity(): Promise<{ name: string; status: 'healthy' | 'degraded' | 'unhealthy'; latencyMs?: number }> {
    try {
      const start = Date.now();
      await fetch('https://mesh.allternit.com/health', { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      const latency = Date.now() - start;
      return { name: 'connectivity', status: latency < 100 ? 'healthy' : 'degraded', latencyMs: latency };
    } catch {
      return { name: 'connectivity', status: 'unhealthy' };
    }
  }
  
  private async checkDNS(): Promise<{ name: string; status: 'healthy' | 'degraded' | 'unhealthy' }> {
    try {
      const { stdout } = await execAsync('nslookup mesh.allternit.com');
      return { name: 'dns', status: stdout.includes('Address') ? 'healthy' : 'degraded' };
    } catch {
      return { name: 'dns', status: 'unhealthy' };
    }
  }
}

// ============================================================================
// Main Agent Class
// ============================================================================

export class MeshAgent {
  private config: MeshAgentConfig;
  private wireguard: WireGuardManager;
  private headscale?: HeadscaleClient;
  private updater?: AutoUpdater;
  private healthChecker: HealthChecker;
  private running: boolean = false;
  private status: MeshAgentStatus;
  
  constructor(config: MeshAgentConfig) {
    this.config = config;
    this.wireguard = new WireGuardManager();
    this.healthChecker = new HealthChecker(config.agentId);
    
    if (config.provider === 'headscale') {
      this.headscale = new HeadscaleClient(config.serverConfig as HeadscaleServerConfig);
    }
    
    if (config.autoUpdate) {
      this.updater = new AutoUpdater(config.version);
    }
    
    this.status = {
      agentId: config.agentId,
      state: 'disconnected',
      version: config.version,
      lastSeen: new Date().toISOString(),
      endpoints: [],
      allowedIps: [],
      rxBytes: 0,
      txBytes: 0,
      connectionQuality: 'poor',
    };
  }
  
  async start(): Promise<void> {
    logger.info('Starting Allternit Mesh Agent', { 
      agentId: this.config.agentId,
      provider: this.config.provider,
    });
    
    this.running = true;
    this.status.state = 'connecting';
    
    try {
      // Check WireGuard is installed
      if (!await this.wireguard.isInstalled()) {
        throw new Error('WireGuard is not installed');
      }
      
      // Generate keypair
      const keypair = await this.wireguard.generateKeypair();
      logger.info('Generated WireGuard keypair');
      
      // Register with mesh server
      if (this.headscale) {
        const { ipAddresses } = await this.headscale.registerNode({
          name: this.config.agentId,
          publicKey: keypair.publicKey,
          os: process.platform,
          arch: process.arch,
        });
        
        logger.info('Registered with Headscale', { ipAddresses });
        
        // Create WireGuard interface
        await this.wireguard.createInterface({
          privateKey: keypair.privateKey,
          addresses: ipAddresses,
          listenPort: this.config.listenPort || undefined,
        });
        
        // Add Headscale DERP as peer (will be replaced with actual peers from server)
        // This is a simplified version - in production, you'd fetch peer list from server
        
        // Start interface
        await this.wireguard.startInterface();
        
        this.status.wireguardIp = ipAddresses[0];
        this.status.publicKey = keypair.publicKey;
      }
      
      this.status.state = 'connected';
      logger.info('Agent connected to mesh');
      
      // Start health checks
      this.startHealthChecks();
      
      // Start auto-updater if enabled
      if (this.updater && this.config.autoUpdate) {
        this.startAutoUpdater();
      }
      
    } catch (error) {
      this.status.state = 'error';
      this.status.errorMessage = String(error);
      logger.error('Failed to start agent', { error: String(error) });
      throw error;
    }
  }
  
  async stop(): Promise<void> {
    logger.info('Stopping agent');
    this.running = false;
    
    await this.wireguard.stopInterface();
    
    this.status.state = 'disconnected';
    logger.info('Agent stopped');
  }
  
  private startHealthChecks(): void {
    const runCheck = async () => {
      if (!this.running) return;
      
      try {
        const health = await this.healthChecker.runChecks();
        
        // Update status based on health
        if (health.checks.wireguard === 'healthy' && health.checks.connectionToServer === 'healthy') {
          this.status.connectionQuality = health.metrics.latencyP50 < 50 ? 'excellent' : 
                                          health.metrics.latencyP50 < 100 ? 'good' : 'fair';
        } else {
          this.status.connectionQuality = 'poor';
        }
        
        // Get WireGuard stats
        const wgStatus = await this.wireguard.getStatus();
        const totalRx = wgStatus.peers.reduce((sum, p) => sum + p.transferRx, 0);
        const totalTx = wgStatus.peers.reduce((sum, p) => sum + p.transferTx, 0);
        
        this.status.rxBytes = totalRx;
        this.status.txBytes = totalTx;
        this.status.lastSeen = new Date().toISOString();
        
        // Report health to platform
        await this.reportHealth(health);
        
      } catch (error) {
        logger.error('Health check failed', { error: String(error) });
      }
      
      // Schedule next check
      if (this.running) {
        setTimeout(runCheck, this.config.healthCheckInterval);
      }
    };
    
    runCheck();
  }
  
  private async reportHealth(health: MeshHealthStatus): Promise<void> {
    try {
      await fetch('https://mesh.allternit.com/api/v1/agents/health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(this.config as any).setupToken}`,
        },
        body: JSON.stringify(health),
      });
    } catch (error) {
      logger.warn('Failed to report health', { error: String(error) });
    }
  }
  
  private startAutoUpdater(): void {
    const checkInterval = 24 * 60 * 60 * 1000; // 24 hours
    
    const checkForUpdates = async () => {
      if (!this.running || !this.updater) return;
      
      try {
        const updateInfo = await this.updater.checkForUpdate();
        
        if (updateInfo) {
          logger.info('Update available', { version: updateInfo.latestVersion });
          
          // Perform update
          await this.updater.performUpdate(updateInfo, (progress) => {
            logger.info(`Update progress: ${progress.message}`, { 
              progress: progress.progress,
              state: progress.state,
            });
          });
        }
      } catch (error) {
        logger.error('Auto-update failed', { error: String(error) });
      }
      
      // Schedule next check
      if (this.running) {
        setTimeout(checkForUpdates, checkInterval);
      }
    };
    
    // Initial check after 1 minute
    setTimeout(checkForUpdates, 60 * 1000);
  }
  
  getStatus(): MeshAgentStatus {
    return { ...this.status };
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  // Load config
  let config: MeshAgentConfig;
  try {
    const configData = await readFile(AGENT_CONFIG_PATH, 'utf-8');
    config = JSON.parse(configData);
  } catch (error) {
    logger.error('Failed to load config', { error: String(error) });
    process.exit(1);
  }
  
  const agent = new MeshAgent(config);
  
  switch (command) {
    case '--status':
      console.log(JSON.stringify(agent.getStatus(), null, 2));
      break;
      
    case '--update':
      const updater = new AutoUpdater(config.version);
      const updateInfo = await updater.checkForUpdate();
      if (updateInfo) {
        console.log(`Update available: ${updateInfo.latestVersion}`);
        await updater.performUpdate(updateInfo, (progress) => {
          console.log(`[${progress.progress}%] ${progress.message}`);
        });
      } else {
        console.log('No updates available');
      }
      break;
      
    case '--health':
      const healthChecker = new HealthChecker(config.agentId);
      const health = await healthChecker.runChecks();
      console.log(JSON.stringify(health, null, 2));
      break;
      
    default:
      // Run agent
      await agent.start();
      
      // Handle shutdown signals
      process.on('SIGTERM', async () => {
        await agent.stop();
        process.exit(0);
      });
      
      process.on('SIGINT', async () => {
        await agent.stop();
        process.exit(0);
      });
      
      // Keep running
      setInterval(() => {}, 1000);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Fatal error', { error: String(error) });
    process.exit(1);
  });
}

export default MeshAgent;
