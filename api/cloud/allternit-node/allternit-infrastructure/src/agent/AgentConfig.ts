/**
 * Allternit Agent Configuration Management
 * 
 * Handles generation, validation, and application of Allternit agent configurations
 * for VPS/cloud deployments.
 */

import { NodeSSH } from 'node-ssh';
import { VPSConnection } from './AgentInstaller';
import { Logger } from '../utils/logger';

export interface ResourceLimits {
  cpuPercent: number;
  memoryLimit: string;
  diskLimit: string;
  maxContainers: number;
}

export interface NetworkConfig {
  mode: 'bridge' | 'host' | 'overlay' | 'macvlan';
  subnet?: string;
  gateway?: string;
  exposedPorts: number[];
  tlsEnabled: boolean;
  tlsCertPath?: string;
  tlsKeyPath?: string;
}

export interface SecurityConfig {
  tlsEnabled: boolean;
  jwtSecret: string;
  apiKeys: string[];
  allowedOrigins: string[];
  rateLimitRequests: number;
  rateLimitWindow: number;
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsPort: number;
  healthCheckInterval: number;
  prometheusEnabled: boolean;
  lokiEnabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface StorageConfig {
  dataDir: string;
  logDir: string;
  tempDir: string;
  backupDir: string;
  maxLogSize: string;
  maxLogAge: number;
}

export interface AgentConfig {
  // Server identification
  serverId: string;
  datacenter: string;
  region: string;
  
  // API endpoints
  apiEndpoint: string;
  internalEndpoint: string;
  websocketEndpoint: string;
  
  // Authentication
  authToken: string;
  apiKey: string;
  
  // Docker configuration
  dockerNetwork: string;
  dockerSubnet: string;
  
  // Resource limits
  maxContainers: number;
  resourceLimits: ResourceLimits;
  
  // Network configuration
  network: NetworkConfig;
  
  // Security settings
  security: SecurityConfig;
  
  // Monitoring and logging
  monitoring: MonitoringConfig;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  
  // Storage
  storage: StorageConfig;
  
  // Feature flags
  features: {
    autoUpdate: boolean;
    healthChecks: boolean;
    metricsExport: boolean;
    remoteLogs: boolean;
    containerSandbox: boolean;
  };
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  version: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConfigApplyResult {
  success: boolean;
  message: string;
  restartRequired: boolean;
  errors?: string[];
}

export class AgentConfigurator {
  private readonly logger: Logger;
  private readonly defaultVersion = '1.0.0';

  constructor() {
    this.logger = new Logger('AgentConfigurator');
  }

  /**
   * Generate a complete Allternit agent configuration for a VPS
   */
  async generateConfig(
    vps: VPSConnection,
    customConfig: Partial<AgentConfig> = {}
  ): Promise<AgentConfig> {
    this.logger.info(`Generating configuration for ${vps.host}`);

    const serverId = this.generateServerId(vps);
    const region = vps.region || this.inferRegion(vps.host);
    const authToken = this.generateSecureToken(64);
    const apiKey = this.generateSecureToken(32);
    const jwtSecret = this.generateSecureToken(64);

    const config: AgentConfig = {
      // Server identification
      serverId,
      datacenter: vps.provider || 'custom',
      region,
      
      // API endpoints
      apiEndpoint: customConfig.apiEndpoint || `https://${vps.host}:8080`,
      internalEndpoint: customConfig.internalEndpoint || `http://localhost:8080`,
      websocketEndpoint: customConfig.websocketEndpoint || `wss://${vps.host}:8080/ws`,
      
      // Authentication
      authToken,
      apiKey,
      
      // Docker configuration
      dockerNetwork: customConfig.dockerNetwork || 'allternit-network',
      dockerSubnet: customConfig.dockerSubnet || '172.20.0.0/16',
      
      // Resource limits
      maxContainers: customConfig.maxContainers || 50,
      resourceLimits: {
        cpuPercent: 80,
        memoryLimit: '4g',
        diskLimit: '50g',
        maxContainers: 50,
        ...customConfig.resourceLimits
      },
      
      // Network configuration
      network: {
        mode: 'bridge',
        subnet: '172.20.0.0/16',
        gateway: '172.20.0.1',
        exposedPorts: [80, 443, 8080, 9090, 9091],
        tlsEnabled: true,
        ...customConfig.network
      },
      
      // Security settings
      security: {
        tlsEnabled: true,
        jwtSecret,
        apiKeys: [apiKey],
        allowedOrigins: ['*'],
        rateLimitRequests: 1000,
        rateLimitWindow: 60,
        ...customConfig.security
      },
      
      // Monitoring and logging
      monitoring: {
        enabled: true,
        metricsPort: 9090,
        healthCheckInterval: 30,
        prometheusEnabled: true,
        lokiEnabled: true,
        logLevel: 'info',
        ...customConfig.monitoring
      },
      logLevel: customConfig.logLevel || 'info',
      
      // Storage
      storage: {
        dataDir: '/opt/allternit/data',
        logDir: '/var/log/allternit',
        tempDir: '/tmp/allternit',
        backupDir: '/opt/allternit/backups',
        maxLogSize: '100m',
        maxLogAge: 14,
        ...customConfig.storage
      },
      
      // Feature flags
      features: {
        autoUpdate: true,
        healthChecks: true,
        metricsExport: true,
        remoteLogs: true,
        containerSandbox: true,
        ...customConfig.features
      },
      
      // Metadata
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: this.defaultVersion,
      ...customConfig
    };

    this.logger.info(`Configuration generated for server: ${serverId}`);
    return config;
  }

  /**
   * Validate agent configuration
   */
  validateConfig(config: Partial<AgentConfig>): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!config.serverId) {
      errors.push('serverId is required');
    }

    if (!config.authToken || config.authToken.length < 32) {
      errors.push('authToken must be at least 32 characters');
    }

    if (!config.apiEndpoint) {
      errors.push('apiEndpoint is required');
    } else {
      try {
        new URL(config.apiEndpoint);
      } catch {
        errors.push('apiEndpoint must be a valid URL');
      }
    }

    // Resource limits validation
    if (config.resourceLimits) {
      if (config.resourceLimits.cpuPercent && (config.resourceLimits.cpuPercent < 1 || config.resourceLimits.cpuPercent > 100)) {
        errors.push('resourceLimits.cpuPercent must be between 1 and 100');
      }

      if (config.resourceLimits.maxContainers && config.resourceLimits.maxContainers < 1) {
        errors.push('resourceLimits.maxContainers must be at least 1');
      }
    }

    // Network validation
    if (config.network) {
      if (config.network.exposedPorts) {
        const invalidPorts = config.network.exposedPorts.filter(p => p < 1 || p > 65535);
        if (invalidPorts.length > 0) {
          errors.push(`Invalid port numbers: ${invalidPorts.join(', ')}`);
        }
      }

      if (config.network.subnet) {
        const subnetRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/;
        if (!subnetRegex.test(config.network.subnet)) {
          errors.push('network.subnet must be a valid CIDR notation');
        }
      }
    }

    // Security validation
    if (config.security) {
      if (config.security.rateLimitRequests && config.security.rateLimitRequests < 1) {
        errors.push('security.rateLimitRequests must be at least 1');
      }

      if (config.security.rateLimitWindow && config.security.rateLimitWindow < 1) {
        errors.push('security.rateLimitWindow must be at least 1 second');
      }
    }

    // Warnings
    if (config.security?.allowedOrigins?.includes('*')) {
      warnings.push('CORS allowedOrigins is set to "*" - this may be a security risk in production');
    }

    if (config.logLevel === 'debug') {
      warnings.push('Log level is set to debug - this may impact performance');
    }

    if (!config.monitoring?.enabled) {
      warnings.push('Monitoring is disabled - health checks and metrics will not be available');
    }

    if (!config.features?.healthChecks) {
      warnings.push('Health checks are disabled');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Apply configuration to a target VPS
   */
  async applyConfig(target: VPSConnection, config: AgentConfig): Promise<ConfigApplyResult> {
    this.logger.info(`Applying configuration to ${target.host}`);

    // Validate config first
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      return {
        success: false,
        message: 'Configuration validation failed',
        restartRequired: false,
        errors: validation.errors
      };
    }

    const ssh = new NodeSSH();

    try {
      // Connect to target
      await this.connectSSH(ssh, target);

      // Check if agent is installed
      const installCheck = await ssh.execCommand('test -d /opt/allternit && echo "installed" || echo "not_installed"');
      if (installCheck.stdout.trim() !== 'installed') {
        return {
          success: false,
          message: 'Allternit agent is not installed on this host',
          restartRequired: false,
          errors: ['Agent not installed']
        };
      }

      // Update configuration
      config.updatedAt = new Date().toISOString();
      const configJson = JSON.stringify(config, null, 2);

      // Backup existing config
      await ssh.execCommand('sudo cp /etc/allternit/config.json /etc/allternit/config.json.bak.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true');

      // Write new config
      await ssh.execCommand(`cat > /tmp/allternit-config-new.json << 'EOFCFG'
${configJson}
EOFCFG`);
      await ssh.execCommand('sudo mv /tmp/allternit-config-new.json /etc/allternit/config.json');
      await ssh.execCommand('sudo chmod 600 /etc/allternit/config.json');

      // Update docker-compose with new network settings if needed
      await this.updateDockerCompose(ssh, config);

      // Determine if restart is required
      const restartRequired = await this.isRestartRequired(ssh, config);

      if (restartRequired) {
        this.logger.info('Restarting Allternit services...');
        await ssh.execCommand('sudo systemctl restart allternit-agent');
        
        // Wait for services to be healthy
        await this.waitForServices(ssh, 60000);
      }

      this.logger.info('Configuration applied successfully');

      return {
        success: true,
        message: restartRequired 
          ? 'Configuration applied and services restarted'
          : 'Configuration applied (no restart required)',
        restartRequired
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to apply configuration: ${errorMsg}`);

      // Attempt to restore backup
      try {
        await ssh.execCommand('sudo cp /etc/allternit/config.json.bak.* /etc/allternit/config.json 2>/dev/null || true');
      } catch {
        // Ignore restore errors
      }

      return {
        success: false,
        message: `Failed to apply configuration: ${errorMsg}`,
        restartRequired: false,
        errors: [errorMsg]
      };
    } finally {
      ssh.dispose();
    }
  }

  /**
   * Load configuration from a target VPS
   */
  async loadConfig(target: VPSConnection): Promise<AgentConfig | null> {
    this.logger.info(`Loading configuration from ${target.host}`);

    const ssh = new NodeSSH();

    try {
      await this.connectSSH(ssh, target);

      const result = await ssh.execCommand('cat /etc/allternit/config.json 2>/dev/null || echo "not_found"');
      
      if (result.stdout.trim() === 'not_found') {
        return null;
      }

      const config: AgentConfig = JSON.parse(result.stdout);
      return config;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to load configuration: ${errorMsg}`);
      return null;
    } finally {
      ssh.dispose();
    }
  }

  /**
   * Generate environment variables from config
   */
  generateEnvVars(config: AgentConfig): Record<string, string> {
    return {
      ALLTERNIT_SERVER_ID: config.serverId,
      ALLTERNIT_DATACENTER: config.datacenter,
      ALLTERNIT_REGION: config.region,
      ALLTERNIT_API_ENDPOINT: config.apiEndpoint,
      ALLTERNIT_INTERNAL_ENDPOINT: config.internalEndpoint,
      ALLTERNIT_WEBSOCKET_ENDPOINT: config.websocketEndpoint,
      ALLTERNIT_AUTH_TOKEN: config.authToken,
      ALLTERNIT_API_KEY: config.apiKey,
      ALLTERNIT_DOCKER_NETWORK: config.dockerNetwork,
      ALLTERNIT_DOCKER_SUBNET: config.dockerSubnet,
      ALLTERNIT_MAX_CONTAINERS: config.maxContainers.toString(),
      ALLTERNIT_CPU_PERCENT: config.resourceLimits.cpuPercent.toString(),
      ALLTERNIT_MEMORY_LIMIT: config.resourceLimits.memoryLimit,
      ALLTERNIT_DISK_LIMIT: config.resourceLimits.diskLimit,
      ALLTERNIT_LOG_LEVEL: config.logLevel,
      ALLTERNIT_METRICS_ENABLED: config.monitoring.enabled.toString(),
      ALLTERNIT_METRICS_PORT: config.monitoring.metricsPort.toString(),
      ALLTERNIT_TLS_ENABLED: config.network.tlsEnabled.toString(),
      ALLTERNIT_JWT_SECRET: config.security.jwtSecret,
      ALLTERNIT_RATE_LIMIT_REQUESTS: config.security.rateLimitRequests.toString(),
      ALLTERNIT_RATE_LIMIT_WINDOW: config.security.rateLimitWindow.toString(),
      ALLTERNIT_AUTO_UPDATE: config.features.autoUpdate.toString(),
      ALLTERNIT_HEALTH_CHECKS: config.features.healthChecks.toString(),
      ALLTERNIT_VERSION: config.version
    };
  }

  /**
   * Generate Docker Compose environment file content
   */
  generateEnvFile(config: AgentConfig): string {
    const envVars = this.generateEnvVars(config);
    const lines = Object.entries(envVars).map(([key, value]) => `${key}=${value}`);
    return lines.join('\n');
  }

  // Private helper methods

  private generateServerId(vps: VPSConnection): string {
    const timestamp = Date.now().toString(36);
    const hostHash = Buffer.from(vps.host).toString('base64url').substring(0, 8);
    return `allternit-${vps.provider || 'node'}-${hostHash}-${timestamp}`;
  }

  private inferRegion(host: string): string {
    // Try to infer region from hostname patterns
    const regionPatterns: Record<string, RegExp> = {
      'us-east': /us-east|virginia|n-virginia/i,
      'us-west': /us-west|california|oregon/i,
      'eu-west': /eu-west|ireland|london|frankfurt/i,
      'eu-central': /eu-central|frankfurt/i,
      'ap-southeast': /ap-southeast|singapore|sydney/i,
      'ap-northeast': /ap-northeast|tokyo|seoul/i
    };

    for (const [region, pattern] of Object.entries(regionPatterns)) {
      if (pattern.test(host)) {
        return region;
      }
    }

    return 'unknown';
  }

  private generateSecureToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    const randomValues = new Uint8Array(length);
    
    // Use crypto for secure random generation
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(randomValues);
    } else {
      // Fallback for Node.js
      const { randomBytes } = require('crypto');
      const bytes = randomBytes(length);
      for (let i = 0; i < length; i++) {
        randomValues[i] = bytes[i];
      }
    }
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(randomValues[i] % chars.length);
    }
    
    return result;
  }

  private async connectSSH(ssh: NodeSSH, target: VPSConnection): Promise<void> {
    const config: any = {
      host: target.host,
      port: target.port || 22,
      username: target.username,
      readyTimeout: 30000
    };

    if (target.privateKey) {
      config.privateKey = target.privateKey;
      if (target.passphrase) config.passphrase = target.passphrase;
    } else if (target.privateKeyPath) {
      config.privateKeyPath = target.privateKeyPath;
      if (target.passphrase) config.passphrase = target.passphrase;
    } else if (target.password) {
      config.password = target.password;
    } else {
      throw new Error('No authentication method provided');
    }

    await ssh.connect(config);
  }

  private async updateDockerCompose(ssh: NodeSSH, config: AgentConfig): Promise<void> {
    // Update network configuration in docker-compose
    const networkUpdate = await ssh.execCommand(`
      sudo sed -i 's/subnet: .*/subnet: ${config.dockerSubnet}/' /opt/allternit/docker-compose.yml 2>/dev/null || true
    `);

    if (networkUpdate.code !== 0) {
      this.logger.warn('Failed to update Docker Compose network configuration');
    }
  }

  private async isRestartRequired(ssh: NodeSSH, newConfig: AgentConfig): Promise<boolean> {
    // Check if key configuration has changed that requires restart
    const result = await ssh.execCommand('cat /etc/allternit/config.json 2>/dev/null || echo "{}"');
    
    if (result.code !== 0) {
      return true; // Can't determine, safer to restart
    }

    try {
      const currentConfig: Partial<AgentConfig> = JSON.parse(result.stdout);
      
      // Check for changes that require restart
      const restartKeys: (keyof AgentConfig)[] = [
        'dockerNetwork',
        'dockerSubnet',
        'network',
        'maxContainers',
        'logLevel'
      ];

      for (const key of restartKeys) {
        if (JSON.stringify(currentConfig[key]) !== JSON.stringify(newConfig[key])) {
          this.logger.info(`Configuration change detected in ${key} - restart required`);
          return true;
        }
      }

      return false;
    } catch {
      return true;
    }
  }

  private async waitForServices(ssh: NodeSSH, timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 5000;

    while (Date.now() - startTime < timeoutMs) {
      const result = await ssh.execCommand(
        'docker compose -f /opt/allternit/docker-compose.yml ps --format json 2>/dev/null | grep -q "healthy" && echo "healthy" || echo "waiting"'
      );

      if (result.stdout.trim() === 'healthy') {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error('Timeout waiting for services to become healthy');
  }
}

// Export a singleton instance
export const agentConfigurator = new AgentConfigurator();
