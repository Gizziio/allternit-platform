/**
 * Allternit Node Agent Installer
 * 
 * Main installation orchestrator for deploying Allternit agents to VPS/cloud instances.
 * Provides fully automated installation, uninstallation, upgrade, and status checking.
 */

import { NodeSSH } from 'node-ssh';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from '../utils/logger';
import { AgentConfigurator, AgentConfig } from './AgentConfig';

export interface VPSConnection {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  privateKeyPath?: string;
  passphrase?: string;
  provider?: 'aws' | 'gcp' | 'azure' | 'digitalocean' | 'linode' | 'vultr' | 'custom';
  region?: string;
  instanceId?: string;
}

export interface ResourceLimits {
  cpuPercent: number;
  memoryLimit: string;
  diskLimit: string;
  maxContainers: number;
}

export interface AgentStatus {
  installed: boolean;
  version?: string;
  status: 'running' | 'stopped' | 'error' | 'unknown' | 'not_installed';
  uptime?: number;
  containers?: ContainerStatus[];
  lastCheck: Date;
  errors: string[];
  systemInfo?: SystemInfo;
}

export interface ContainerStatus {
  name: string;
  status: 'running' | 'stopped' | 'error' | 'restarting';
  health?: 'healthy' | 'unhealthy' | 'starting';
  uptime?: number;
  ports?: Record<string, number>;
}

export interface SystemInfo {
  os: string;
  dockerVersion?: string;
  totalMemory?: string;
  availableMemory?: string;
  cpuCount?: number;
  diskSpace?: string;
}

export interface InstallResult {
  success: boolean;
  message: string;
  version: string;
  installTime: number;
  config: AgentConfig;
  logs: string[];
  warnings?: string[];
  errors?: string[];
}

export interface InstallOptions {
  version?: string;
  skipDockerInstall?: boolean;
  customConfig?: Partial<AgentConfig>;
  timeout?: number;
  retryAttempts?: number;
}

export class AgentInstaller {
  private readonly logger: Logger;
  private readonly configurator: AgentConfigurator;
  private readonly defaultTimeout: number = 300000;
  private readonly version = '1.0.0';

  constructor() {
    this.logger = new Logger('AgentInstaller');
    this.configurator = new AgentConfigurator();
  }

  async install(
    target: VPSConnection, 
    options: InstallOptions = {}
  ): Promise<InstallResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    this.logger.info(`Starting Allternit agent installation on ${target.host}`);
    logs.push(`[${new Date().toISOString()}] Starting installation on ${target.host}`);

    const ssh = new NodeSSH();
    const timeout = options.timeout || this.defaultTimeout;

    try {
      this.logger.info('Establishing SSH connection...');
      await this.connectSSH(ssh, target);
      logs.push('[SSH] Connection established successfully');

      this.logger.info('Detecting OS...');
      const osInfo = await this.detectOS(ssh);
      logs.push(`[System] Detected OS: ${osInfo.os}`);
      this.logger.info(`Detected OS: ${osInfo.os}`);

      this.logger.info('Running pre-installation checks...');
      const preCheck = await this.runPreInstallChecks(ssh, osInfo);
      if (!preCheck.passed) {
        throw new Error(`Pre-installation checks failed: ${preCheck.errors.join(', ')}`);
      }
      logs.push('[Check] Pre-installation checks passed');

      if (!options.skipDockerInstall && !preCheck.dockerInstalled) {
        this.logger.info('Installing Docker...');
        await this.installDocker(ssh, osInfo);
        logs.push('[Docker] Docker installed successfully');
      } else {
        logs.push('[Docker] Skipping Docker installation');
      }

      this.logger.info('Creating Allternit directories...');
      await this.createDirectories(ssh);
      logs.push('[FS] Directories created');

      this.logger.info('Generating configuration...');
      const config = await this.configurator.generateConfig(target, options.customConfig);
      await this.uploadConfig(ssh, config);
      logs.push('[Config] Configuration uploaded');

      this.logger.info('Uploading installation scripts...');
      await this.uploadInstallScripts(ssh, osInfo);
      logs.push('[Scripts] Installation scripts uploaded');

      this.logger.info('Uploading Docker Compose configuration...');
      await this.uploadDockerCompose(ssh);
      logs.push('[Docker] Docker Compose configuration uploaded');

      this.logger.info('Running installation script...');
      const installOutput = await this.runInstallScript(ssh, osInfo, timeout);
      logs.push(...installOutput.split('\n').filter(line => line.trim()));

      this.logger.info('Verifying installation...');
      const verifyResult = await this.verifyInstallation(ssh);
      if (!verifyResult.success) {
        throw new Error(`Installation verification failed: ${verifyResult.error}`);
      }
      logs.push('[Verify] Installation verified successfully');

      this.logger.info('Starting Allternit services...');
      await this.startServices(ssh);
      logs.push('[Service] Allternit services started');

      this.logger.info('Running final health check...');
      await this.waitForHealthy(ssh, 60000);
      logs.push('[Health] Agent is healthy and running');

      const installTime = Date.now() - startTime;
      this.logger.info(`Installation completed in ${installTime}ms`);

      return {
        success: true,
        message: `Allternit agent v${this.version} installed successfully on ${target.host}`,
        version: this.version,
        installTime,
        config,
        logs,
        warnings: warnings.length > 0 ? warnings : undefined,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Installation failed: ${errorMsg}`);
      errors.push(`[ERROR] ${errorMsg}`);
      
      try {
        this.logger.info('Attempting rollback...');
        await this.rollback(ssh);
        logs.push('[Rollback] Rollback completed');
      } catch (rollbackError) {
        const rollbackMsg = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
        this.logger.error(`Rollback failed: ${rollbackMsg}`);
        errors.push(`[Rollback Error] ${rollbackMsg}`);
      }

      return {
        success: false,
        message: `Installation failed: ${errorMsg}`,
        version: this.version,
        installTime: Date.now() - startTime,
        config: null as any,
        logs,
        errors
      };
    } finally {
      ssh.dispose();
    }
  }

  async uninstall(target: VPSConnection): Promise<void> {
    this.logger.info(`Starting Allternit agent uninstallation from ${target.host}`);
    
    const ssh = new NodeSSH();
    
    try {
      await this.connectSSH(ssh, target);
      
      await ssh.execCommand('docker compose -f /opt/allternit/docker-compose.yml down --volumes --remove-orphans 2>/dev/null || true');
      await ssh.execCommand('systemctl stop allternit-agent 2>/dev/null || true');
      await ssh.execCommand('systemctl disable allternit-agent 2>/dev/null || true');
      await ssh.execCommand('rm -f /etc/systemd/system/allternit-agent.service');
      await ssh.execCommand('systemctl daemon-reload 2>/dev/null || true');
      await ssh.execCommand('rm -rf /opt/allternit');
      await ssh.execCommand('rm -rf /var/log/allternit');
      await ssh.execCommand('rm -rf /etc/allternit');
      await ssh.execCommand('id -u allternit >/dev/null 2>&1 && userdel -r allternit 2>/dev/null || true');
      
      this.logger.info('Uninstallation completed successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Uninstallation failed: ${errorMsg}`);
      throw new Error(`Uninstallation failed: ${errorMsg}`);
    } finally {
      ssh.dispose();
    }
  }

  async upgrade(target: VPSConnection, newVersion?: string): Promise<InstallResult> {
    this.logger.info(`Starting Allternit agent upgrade on ${target.host}`);
    
    const ssh = new NodeSSH();
    const logs: string[] = [];
    
    try {
      await this.connectSSH(ssh, target);
      
      const status = await this.checkStatus(target);
      if (!status.installed) {
        throw new Error('Allternit agent is not installed on this host');
      }
      
      logs.push(`[Upgrade] Current version: ${status.version || 'unknown'}`);
      logs.push(`[Upgrade] Target version: ${newVersion || 'latest'}`);
      
      const versionTag = newVersion || 'latest';
      const pullResult = await ssh.execCommand(`docker pull allternit/agent:${versionTag}`);
      
      if (pullResult.code !== 0) {
        throw new Error(`Failed to pull new image: ${pullResult.stderr}`);
      }
      
      logs.push('[Docker] New image pulled successfully');
      
      await ssh.execCommand(`sed -i 's/image: allternit\\/agent:.*/image: allternit\\/agent:${versionTag}/' /opt/allternit/docker-compose.yml`);
      
      const upResult = await ssh.execCommand('cd /opt/allternit && docker compose up -d --force-recreate');
      
      if (upResult.code !== 0) {
        throw new Error(`Failed to recreate containers: ${upResult.stderr}`);
      }
      
      logs.push('[Docker] Containers recreated successfully');
      
      await this.waitForHealthy(ssh, 60000);
      logs.push('[Health] Agent is healthy after upgrade');
      
      return {
        success: true,
        message: `Allternit agent upgraded to ${newVersion || 'latest'}`,
        version: newVersion || this.version,
        installTime: 0,
        config: null as any,
        logs
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Upgrade failed: ${errorMsg}`);
      throw new Error(`Upgrade failed: ${errorMsg}`);
    } finally {
      ssh.dispose();
    }
  }

  async checkStatus(target: VPSConnection): Promise<AgentStatus> {
    const ssh = new NodeSSH();
    
    try {
      await this.connectSSH(ssh, target);
      
      const status: AgentStatus = {
        installed: false,
        status: 'not_installed',
        lastCheck: new Date(),
        errors: []
      };
      
      const installCheck = await ssh.execCommand('test -f /opt/allternit/docker-compose.yml && echo "installed" || echo "not_installed"');
      status.installed = installCheck.stdout.trim() === 'installed';
      
      if (!status.installed) {
        return status;
      }
      
      status.systemInfo = await this.getSystemInfo(ssh);
      
      const serviceResult = await ssh.execCommand('systemctl is-active allternit-agent 2>/dev/null || echo "inactive"');
      const isActive = serviceResult.stdout.trim() === 'active';
      
      const containerResult = await ssh.execCommand('docker compose -f /opt/allternit/docker-compose.yml ps --format json 2>/dev/null || docker compose -f /opt/allternit/docker-compose.yml ps 2>/dev/null');
      
      if (containerResult.code === 0) {
        status.containers = this.parseContainerStatus(containerResult.stdout);
        
        const runningContainers = status.containers.filter(c => c.status === 'running');
        const unhealthyContainers = status.containers.filter(c => c.health === 'unhealthy');
        
        if (runningContainers.length === status.containers.length && isActive) {
          status.status = 'running';
        } else if (runningContainers.length === 0) {
          status.status = 'stopped';
        } else if (unhealthyContainers.length > 0) {
          status.status = 'error';
          status.errors.push(`${unhealthyContainers.length} container(s) are unhealthy`);
        } else {
          status.status = 'error';
        }
        
        const uptimeResult = await ssh.execCommand('docker compose -f /opt/allternit/docker-compose.yml ps -q | xargs -I {} docker inspect --format="{{.State.StartedAt}}" {} 2>/dev/null | head -1');
        if (uptimeResult.code === 0 && uptimeResult.stdout.trim()) {
          const startedAt = new Date(uptimeResult.stdout.trim());
          status.uptime = Date.now() - startedAt.getTime();
        }
        
        const versionResult = await ssh.execCommand('docker inspect --format="{{.Config.Image}}" allternit-agent 2>/dev/null | grep -oE ":[^:]+$" | tr -d ":" || echo "unknown"');
        status.version = versionResult.stdout.trim();
      } else {
        status.status = 'error';
        status.errors.push('Failed to query container status');
      }
      
      return status;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Status check failed: ${errorMsg}`);
      return {
        installed: false,
        status: 'unknown',
        lastCheck: new Date(),
        errors: [errorMsg]
      };
    } finally {
      ssh.dispose();
    }
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

  private async detectOS(ssh: NodeSSH): Promise<{ os: string; distro: string; version: string }> {
    const result = await ssh.execCommand('cat /etc/os-release 2>/dev/null || echo "unknown"');
    
    if (result.code === 0 && result.stdout !== 'unknown') {
      const lines = result.stdout.split('\n');
      const id = lines.find(l => l.startsWith('ID='))?.split('=')[1]?.replace(/"/g, '') || 'unknown';
      const versionId = lines.find(l => l.startsWith('VERSION_ID='))?.split('=')[1]?.replace(/"/g, '') || '';
      
      if (id.includes('ubuntu')) return { os: 'linux', distro: 'ubuntu', version: versionId };
      if (id.includes('debian')) return { os: 'linux', distro: 'debian', version: versionId };
      if (id.includes('centos')) return { os: 'linux', distro: 'centos', version: versionId };
      if (id.includes('rhel')) return { os: 'linux', distro: 'rhel', version: versionId };
      if (id.includes('fedora')) return { os: 'linux', distro: 'fedora', version: versionId };
      if (id.includes('alpine')) return { os: 'linux', distro: 'alpine', version: versionId };
      if (id.includes('amazon')) return { os: 'linux', distro: 'amazon', version: versionId };
    }
    
    const unameResult = await ssh.execCommand('uname -s');
    if (unameResult.stdout.toLowerCase().includes('linux')) {
      return { os: 'linux', distro: 'unknown', version: '' };
    }
    
    throw new Error('Unsupported operating system');
  }

  private async runPreInstallChecks(ssh: NodeSSH, osInfo: { os: string; distro: string }): Promise<{ passed: boolean; errors: string[]; dockerInstalled: boolean }> {
    const errors: string[] = [];
    
    const rootCheck = await ssh.execCommand('id -u');
    const isRoot = rootCheck.stdout.trim() === '0';
    
    if (!isRoot) {
      const sudoCheck = await ssh.execCommand('sudo -n true 2>&1');
      if (sudoCheck.code !== 0) {
        errors.push('Root or passwordless sudo access required');
      }
    }
    
    const archCheck = await ssh.execCommand('uname -m');
    const arch = archCheck.stdout.trim();
    if (!['x86_64', 'amd64', 'aarch64', 'arm64'].includes(arch)) {
      errors.push(`Unsupported architecture: ${arch}`);
    }
    
    const memCheck = await ssh.execCommand("free -m | awk 'NR==2{print $2}' 2>/dev/null || echo 0");
    const memoryMB = parseInt(memCheck.stdout.trim()) || 0;
    if (memoryMB < 1024) {
      errors.push(`Insufficient memory: ${memoryMB}MB (minimum 1GB required)`);
    }
    
    const dockerCheck = await ssh.execCommand('docker --version 2>/dev/null || echo "not installed"');
    const dockerInstalled = !dockerCheck.stdout.includes('not installed');
    
    if (dockerInstalled) {
      const composeCheck = await ssh.execCommand('docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || echo "not installed"');
      if (composeCheck.stdout.includes('not installed')) {
        errors.push('Docker is installed but Docker Compose is not available');
      }
    }
    
    return { passed: errors.length === 0, errors, dockerInstalled };
  }

  private async installDocker(ssh: NodeSSH, osInfo: { distro: string }): Promise<void> {
    const installScript = this.getDockerInstallScript(osInfo.distro);
    
    await ssh.execCommand(`cat > /tmp/install-docker.sh << 'EOFSCRIPT'
${installScript}
EOFSCRIPT`);
    
    const result = await ssh.execCommand('chmod +x /tmp/install-docker.sh && sudo /tmp/install-docker.sh');
    
    if (result.code !== 0) {
      throw new Error(`Docker installation failed: ${result.stderr}`);
    }
    
    await ssh.execCommand('sudo usermod -aG docker $(whoami) 2>/dev/null || true');
    await ssh.execCommand('rm -f /tmp/install-docker.sh');
  }

  private getDockerInstallScript(distro: string): string {
    switch (distro) {
      case 'ubuntu':
      case 'debian':
        return `#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg lsb-release
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/\$(. /etc/os-release && echo "\$ID")/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/\$(. /etc/os-release && echo "\$ID") \$(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker
systemctl start docker`;
      
      case 'centos':
      case 'rhel':
      case 'fedora':
        return `#!/bin/bash
set -e
yum install -y yum-utils
dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo || yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable docker
systemctl start docker`;
      
      case 'alpine':
        return `#!/bin/bash
set -e
apk add --no-cache docker docker-compose-openrc
rc-update add docker boot
service docker start || true`;
      
      case 'amazon':
        return `#!/bin/bash
set -e
yum update -y
yum install -y docker
systemctl enable docker
systemctl start docker`;
      
      default:
        return `#!/bin/bash
set -e
curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
sh /tmp/get-docker.sh
rm -f /tmp/get-docker.sh
systemctl enable docker 2>/dev/null || true
systemctl start docker 2>/dev/null || true`;
    }
  }

  private async createDirectories(ssh: NodeSSH): Promise<void> {
    const dirs = ['/opt/allternit', '/opt/allternit/config', '/opt/allternit/data', '/opt/allternit/logs', '/var/log/allternit', '/etc/allternit'];
    
    for (const dir of dirs) {
      await ssh.execCommand(`sudo mkdir -p ${dir} && sudo chmod 755 ${dir}`);
    }
    
    await ssh.execCommand('id -u allternit >/dev/null 2>&1 || sudo useradd -r -s /bin/false -d /opt/allternit allternit');
    await ssh.execCommand('sudo chown -R allternit:allternit /opt/allternit /var/log/allternit /etc/allternit 2>/dev/null || true');
  }

  private async uploadConfig(ssh: NodeSSH, config: AgentConfig): Promise<void> {
    const configJson = JSON.stringify(config, null, 2);
    await ssh.execCommand(`cat > /tmp/agent-config.json << 'EOFCFG'
${configJson}
EOFCFG`);
    await ssh.execCommand('sudo mv /tmp/agent-config.json /etc/allternit/config.json && sudo chmod 600 /etc/allternit/config.json');
  }

  private async uploadInstallScripts(ssh: NodeSSH, osInfo: { os: string }): Promise<void> {
    if (osInfo.os === 'linux') {
      const scriptPath = join(__dirname, 'install-scripts', 'install.sh');
      const scriptContent = readFileSync(scriptPath, 'utf-8');
      
      await ssh.execCommand(`cat > /tmp/allternit-install.sh << 'ENDSCRIPT'
${scriptContent}
ENDSCRIPT`);
      await ssh.execCommand('sudo mv /tmp/allternit-install.sh /opt/allternit/install.sh && sudo chmod +x /opt/allternit/install.sh');
    } else {
      throw new Error(`Unsupported OS for script upload: ${osInfo.os}`);
    }
  }

  private async uploadDockerCompose(ssh: NodeSSH): Promise<void> {
    const composePath = join(__dirname, 'DockerCompose.yml');
    const composeContent = readFileSync(composePath, 'utf-8');
    
    await ssh.execCommand(`cat > /tmp/docker-compose.yml << 'ENDCOMPOSE'
${composeContent}
ENDCOMPOSE`);
    await ssh.execCommand('sudo mv /tmp/docker-compose.yml /opt/allternit/docker-compose.yml');
  }

  private async runInstallScript(ssh: NodeSSH, osInfo: { os: string }, timeout: number): Promise<string> {
    if (osInfo.os === 'linux') {
      const result = await ssh.execCommand('sudo /opt/allternit/install.sh', {
        execOptions: { timeout }
      });
      
      if (result.code !== 0) {
        throw new Error(`Installation script failed: ${result.stderr}`);
      }
      
      return result.stdout;
    }
    
    throw new Error(`Unsupported OS: ${osInfo.os}`);
  }

  private async verifyInstallation(ssh: NodeSSH): Promise<{ success: boolean; error?: string }> {
    const serviceCheck = await ssh.execCommand('test -f /etc/systemd/system/allternit-agent.service && echo "exists" || echo "missing"');
    if (serviceCheck.stdout.trim() !== 'exists') {
      return { success: false, error: 'Systemd service file not found' };
    }
    
    const composeCheck = await ssh.execCommand('test -f /opt/allternit/docker-compose.yml && echo "exists" || echo "missing"');
    if (composeCheck.stdout.trim() !== 'exists') {
      return { success: false, error: 'Docker Compose file not found' };
    }
    
    const validateResult = await ssh.execCommand('cd /opt/allternit && docker compose config > /dev/null 2>&1 && echo "valid" || echo "invalid"');
    if (validateResult.stdout.trim() !== 'valid') {
      return { success: false, error: 'Docker Compose configuration is invalid' };
    }
    
    return { success: true };
  }

  private async startServices(ssh: NodeSSH): Promise<void> {
    await ssh.execCommand('sudo systemctl daemon-reload');
    await ssh.execCommand('sudo systemctl enable allternit-agent');
    await ssh.execCommand('sudo systemctl start allternit-agent');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  private async waitForHealthy(ssh: NodeSSH, timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 5000;
    
    while (Date.now() - startTime < timeoutMs) {
      const result = await ssh.execCommand('docker compose -f /opt/allternit/docker-compose.yml ps --format json 2>/dev/null | grep -q "healthy" && echo "healthy" || echo "waiting"');
      
      if (result.stdout.trim() === 'healthy') {
        return;
      }
      
      const errorCheck = await ssh.execCommand('docker compose -f /opt/allternit/docker-compose.yml ps 2>/dev/null | grep -q "Exit" && echo "error" || echo "ok"');
      if (errorCheck.stdout.trim() === 'error') {
        const logs = await ssh.execCommand('docker compose -f /opt/allternit/docker-compose.yml logs --tail 50 2>&1');
        throw new Error(`Containers failed to start. Logs:\n${logs.stdout}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error(`Timeout waiting for agent to become healthy after ${timeoutMs}ms`);
  }

  private async rollback(ssh: NodeSSH): Promise<void> {
    try {
      await ssh.execCommand('sudo systemctl stop allternit-agent 2>/dev/null || true');
      await ssh.execCommand('cd /opt/allternit && docker compose down --volumes 2>/dev/null || true');
      await ssh.execCommand('sudo rm -rf /opt/allternit');
      await ssh.execCommand('sudo rm -f /etc/systemd/system/allternit-agent.service');
      await ssh.execCommand('sudo systemctl daemon-reload 2>/dev/null || true');
    } catch (error) {
      this.logger.warn(`Rollback encountered issues: ${error}`);
    }
  }

  private async getSystemInfo(ssh: NodeSSH): Promise<SystemInfo> {
    const osResult = await ssh.execCommand('cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d \'"\'');
    const dockerResult = await ssh.execCommand('docker --version 2>/dev/null | cut -d" " -f3 | tr -d "," || echo "not installed"');
    const memResult = await ssh.execCommand("free -h | awk 'NR==2{print $2}' 2>/dev/null || echo ");
    const availMemResult = await ssh.execCommand("free -h | awk 'NR==2{print $7}' 2>/dev/null || echo ");
    const cpuResult = await ssh.execCommand('nproc 2>/dev/null || echo "unknown"');
    const diskResult = await ssh.execCommand("df -h / | awk 'NR==2{print $2}' 2>/dev/null || echo ");
    
    return {
      os: osResult.stdout.trim() || 'unknown',
      dockerVersion: dockerResult.stdout.trim(),
      totalMemory: memResult.stdout.trim() || undefined,
      availableMemory: availMemResult.stdout.trim() || undefined,
      cpuCount: parseInt(cpuResult.stdout.trim()) || undefined,
      diskSpace: diskResult.stdout.trim() || undefined
    };
  }

  private parseContainerStatus(output: string): ContainerStatus[] {
    const containers: ContainerStatus[] = [];
    
    try {
      const lines = output.trim().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const parsed = JSON.parse(line);
          containers.push({
            name: parsed.Name || parsed.Service || 'unknown',
            status: parsed.State === 'running' ? 'running' : parsed.State === 'exited' ? 'stopped' : 'error',
            health: parsed.Health === 'healthy' ? 'healthy' : parsed.Health === 'unhealthy' ? 'unhealthy' : 'starting',
            ports: parsed.Publishers ? Object.fromEntries(
              parsed.Publishers.map((p: any) => [p.TargetPort, p.PublishedPort])
            ) : undefined
          });
        } catch {
          const parts = line.trim().split(/\s{2,}/);
          if (parts.length >= 4) {
            containers.push({
              name: parts[0],
              status: parts[3].toLowerCase().includes('up') ? 'running' : 'stopped'
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to parse container status: ${error}`);
    }
    
    return containers;
  }
}
