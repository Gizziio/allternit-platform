/**
 * Backend Installer Service
 * 
 * Manages native installation of Allternit backend on remote VPS instances.
 * NO DOCKER REQUIRED - runs as native systemd service.
 * Docker is optional for advanced containerized workloads only.
 */

import type { NodeSSH } from 'node-ssh';
import { createHash } from 'crypto';
import { gatherSSHSystemInfo } from '@/lib/ssh-system-info';

export type InstallStep = 
  | 'connecting'
  | 'detecting_os'
  | 'downloading'
  | 'installing_deps'
  | 'configuring'
  | 'starting'
  | 'verifying'
  | 'complete'
  | 'error';

export interface InstallProgress {
  step: InstallStep;
  progress: number;
  message: string;
  log?: string;
}

export interface SystemInfo {
  os: string;
  distro: string;
  version: string;
  architecture: string;
  isAllternitInstalled: boolean;
  allternitVersion?: string;
  hasSystemd: boolean;
  glibcVersion?: string;
}

export type ProgressCallback = (progress: InstallProgress) => void;

class BackendInstallerService {
  private readonly BACKEND_VERSION = '1.0.0';
  private readonly runtimeBinaryName = 'gizzi-code';
  private readonly runtimeServiceName = 'allternit-backend';
  private readonly runtimeServiceUser = 'gizzi';
  private readonly runtimeAuthUser = 'gizzi';
  private readonly runtimePort = 4096;
  private activeInstallations = new Map<string, { ssh: NodeSSH; abort: boolean }>();
  private NodeSSHClass: typeof NodeSSH | null = null;

  /**
   * Lazy load NodeSSH to avoid bundling issues
   */
  private async getNodeSSH(): Promise<typeof NodeSSH> {
    if (!this.NodeSSHClass) {
      const { NodeSSH } = await import('node-ssh');
      this.NodeSSHClass = NodeSSH;
    }
    return this.NodeSSHClass;
  }

  getBackendVersion(): string {
    return this.BACKEND_VERSION;
  }

  /**
   * Test SSH connection
   */
  async testConnection(config: {
    host: string;
    port: number;
    username: string;
    privateKey?: string;
    password?: string;
  }): Promise<{ success: boolean; error?: string; systemInfo?: SystemInfo }> {
    const NodeSSHClass = await this.getNodeSSH();
    const ssh = new NodeSSHClass();
    
    try {
      const connectConfig: any = {
        host: config.host,
        port: config.port || 22,
        username: config.username,
        readyTimeout: 15000,
      };

      if (config.privateKey) {
        connectConfig.privateKey = config.privateKey;
      } else if (config.password) {
        connectConfig.password = config.password;
      } else {
        return { success: false, error: 'No authentication method provided' };
      }

      await ssh.connect(connectConfig);
      const systemInfo = await this.gatherSystemInfo(ssh);
      ssh.dispose();
      
      return { success: true, systemInfo };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  private async gatherSystemInfo(ssh: NodeSSH): Promise<SystemInfo> {
    const baseInfo = await gatherSSHSystemInfo(ssh);

    // Check glibc version (important for binary compatibility)
    const glibcResult = await ssh.execCommand('ldd --version 2>/dev/null | head -1 | grep -oE "[0-9]+\\.[0-9]+" | head -1');
    const glibcVersion = glibcResult.stdout.trim() || undefined;

    return {
      os: baseInfo.os,
      distro: baseInfo.distro,
      version: baseInfo.version,
      architecture: baseInfo.architecture,
      isAllternitInstalled: baseInfo.allternitInstalled,
      allternitVersion: baseInfo.allternitVersion,
      hasSystemd: baseInfo.hasSystemd,
      glibcVersion,
    };
  }

  /**
   * Install Allternit backend - NATIVE (no Docker)
   */
  async installBackend(
    installationId: string,
    config: {
      host: string;
      port: number;
      username: string;
      privateKey?: string;
      password?: string;
    },
    onProgress: ProgressCallback
  ): Promise<{ success: boolean; error?: string; apiUrl?: string; gatewayAuthHeader?: string }> {
    const NodeSSHClass = await this.getNodeSSH();
    const ssh = new NodeSSHClass();
    this.activeInstallations.set(installationId, { ssh, abort: false });

    try {
      onProgress({ step: 'connecting', progress: 5, message: 'Connecting to server...' });
      
      await ssh.connect({
        host: config.host,
        port: config.port || 22,
        username: config.username,
        privateKey: config.privateKey,
        password: config.password,
        readyTimeout: 30000,
      });

      onProgress({ step: 'detecting_os', progress: 10, message: 'Detecting operating system...' });
      const systemInfo = await this.gatherSystemInfo(ssh);
      const runtimePassword = this.generateToken(48);
      const gatewayAuthHeader = this.buildGatewayAuthHeader(runtimePassword);

      // Check compatibility
      if (!this.isArchitectureSupported(systemInfo.architecture)) {
        throw new Error(`Architecture ${systemInfo.architecture} not supported. Use x86_64 or ARM64.`);
      }

      // Provision base dependencies required by the remote bootstrap/build flow.
      onProgress({ step: 'installing_deps', progress: 20, message: 'Checking system dependencies...' });
      await this.installDependencies(ssh, systemInfo.distro);

      // Run the canonical remote bootstrap path.
      onProgress({ step: 'downloading', progress: 40, message: 'Bootstrapping Allternit runtime from remote installer...' });
      await this.runRemoteInstaller(
        ssh,
        runtimePassword,
        systemInfo.architecture,
      );

      // Verify
      onProgress({ step: 'verifying', progress: 95, message: 'Verifying installation...' });
      const apiUrl = await this.verifyInstallation(
        ssh,
        config.host,
        systemInfo.hasSystemd,
        gatewayAuthHeader,
      );

      onProgress({ step: 'complete', progress: 100, message: 'Installation complete!' });

      this.activeInstallations.delete(installationId);
      ssh.dispose();

      return { success: true, apiUrl, gatewayAuthHeader };
    } catch (error) {
      this.activeInstallations.delete(installationId);
      ssh.dispose();
      
      onProgress({ 
        step: 'error', 
        progress: 0, 
        message: error instanceof Error ? error.message : 'Installation failed' 
      });
      
      return { success: false, error: error instanceof Error ? error.message : 'Installation failed' };
    }
  }

  private isArchitectureSupported(arch: string): boolean {
    const supported = ['x86_64', 'amd64', 'aarch64', 'arm64'];
    return supported.includes(arch);
  }

  private normalizeArchitecture(arch: string): 'amd64' | 'arm64' {
    if (arch === 'x86_64' || arch === 'amd64') {
      return 'amd64';
    }

    if (arch === 'aarch64' || arch === 'arm64') {
      return 'arm64';
    }

    throw new Error(`Architecture ${arch} not supported. Use x86_64 or ARM64.`);
  }

  private getGithubRepo(): string {
    return process.env.ALLTERNIT_GITHUB_REPO?.trim() || 'Gizziio/allternit';
  }

  private getGithubRef(version: string): string {
    return process.env.ALLTERNIT_GITHUB_REF?.trim() || `v${version}`;
  }

  private getInstallerUrls(): string[] {
    const urls = [
      process.env.ALLTERNIT_INSTALLER_URL?.trim(),
      'https://install.allternit.com',
      'https://raw.githubusercontent.com/Gizziio/allternit/main/surfaces/platform/install.sh',
      'https://github.com/Gizziio/allternit/raw/main/surfaces/platform/install.sh',
    ];

    return urls.filter((value): value is string => Boolean(value));
  }

  private quoteShell(command: string): string {
    return `'${command.replace(/'/g, `'"'"'`)}'`;
  }

  private async execShell(ssh: NodeSSH, command: string) {
    return ssh.execCommand(`bash -lc ${this.quoteShell(command)}`, {
      execOptions: { pty: true },
    });
  }

  private async execChecked(
    ssh: NodeSSH,
    command: string,
    context: string,
  ) {
    const result = await this.execShell(ssh, command);

    if (result.code !== 0) {
      const output = [result.stdout, result.stderr]
        .map((value) => value.trim())
        .filter(Boolean)
        .join('\n');
      throw new Error(output || context);
    }

    return result;
  }

  private buildGatewayAuthHeader(runtimePassword: string): string {
    return `Basic ${Buffer.from(
      `${this.runtimeAuthUser}:${runtimePassword}`,
      'utf8',
    ).toString('base64')}`;
  }

  /**
   * Preflight the host. Dependency provisioning happens inside the canonical installer script.
   */
  private async installDependencies(ssh: NodeSSH, distro: string): Promise<void> {
    await this.execChecked(
      ssh,
      'command -v bash >/dev/null 2>&1 && command -v sh >/dev/null 2>&1 && ldd --version 2>/dev/null | head -1',
      `Cannot preflight remote host for ${distro}`,
    );
  }

  /**
   * Run the canonical remote bootstrap installer from a hosted URL.
   */
  private async runRemoteInstaller(
    ssh: NodeSSH,
    runtimePassword: string,
    architecture: string,
  ): Promise<void> {
    const arch = this.normalizeArchitecture(architecture);
    const bootstrapCommand = `set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"
export VERSION=${this.quoteShell(this.BACKEND_VERSION)}
export ALLTERNIT_VERSION=${this.quoteShell(this.BACKEND_VERSION)}
export ALLTERNIT_SERVICE_USER=${this.quoteShell(this.runtimeServiceUser)}
export ALLTERNIT_GIZZI_SERVER_USERNAME=${this.quoteShell(this.runtimeAuthUser)}
export ALLTERNIT_GIZZI_SERVER_PASSWORD=${this.quoteShell(runtimePassword)}
export ALLTERNIT_RUNTIME_PORT=${this.quoteShell(String(this.runtimePort))}
export ALLTERNIT_GITHUB_REPO=${this.quoteShell(this.getGithubRepo())}
export ALLTERNIT_GITHUB_REF=${this.quoteShell(this.getGithubRef(this.BACKEND_VERSION))}
export ALLTERNIT_TARGET_ARCH=${this.quoteShell(arch)}
export ALLTERNIT_BINARY_BASE_URL=${this.quoteShell(process.env.ALLTERNIT_BINARY_BASE_URL?.trim() || '')}
for url in ${this.getInstallerUrls().map((value) => this.quoteShell(value)).join(' ')}; do
  [ -n "$url" ] || continue
  if command -v curl >/dev/null 2>&1; then
    if curl -fsSL "$url" | bash; then
      exit 0
    fi
  elif command -v wget >/dev/null 2>&1; then
    if wget -qO- "$url" | bash; then
      exit 0
    fi
  fi
done
echo "Failed to fetch remote installer from all configured sources" >&2
exit 1`;

    await this.execChecked(
      ssh,
      bootstrapCommand,
      `Failed to bootstrap ${this.runtimeBinaryName} on VPS`,
    );

    await this.execShell(
      ssh,
      `ln -sf /opt/allternit/bin/${this.runtimeBinaryName} /usr/local/bin/${this.runtimeBinaryName} 2>/dev/null || true
rm -f /usr/local/bin/allternit-node /opt/allternit/bin/allternit-node 2>/dev/null || true`,
    );
  }

  /**
   * Verify runtime is running and exposing the expected control-plane endpoints.
   */
  private async verifyInstallation(
    ssh: NodeSSH,
    host: string,
    hasSystemd: boolean,
    gatewayAuthHeader: string,
  ): Promise<string> {
    const apiUrl = `http://${host}:${this.runtimePort}`;
    const healthChecks = [
      'http://localhost:4096/v1/global/health',
      'http://localhost:4096/v1/provider',
    ];
    const authHeader = gatewayAuthHeader.replace(/"/g, '\\"');

    for (let i = 0; i < 30; i++) {
      for (const healthUrl of healthChecks) {
        const testResult = await this.execShell(
          ssh,
          `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: ${authHeader}" "${healthUrl}" 2>/dev/null || echo "000"`,
        );

        if (testResult.stdout.trim() === '200') {
          return apiUrl;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const diagnostics = hasSystemd
      ? await this.execShell(ssh, `systemctl is-active ${this.runtimeServiceName} 2>/dev/null || true
echo ---
systemctl status ${this.runtimeServiceName} --no-pager --full -n 25 2>/dev/null || true
echo ---
tail -n 50 /var/log/allternit.log 2>/dev/null || true`)
      : await this.execShell(ssh, `ps aux | grep '[g]izzi-code serve' || true
echo ---
tail -n 50 /var/log/allternit.log 2>/dev/null || true`);

    const detail = [diagnostics.stdout, diagnostics.stderr]
      .map((value) => value.trim())
      .filter(Boolean)
      .join('\n');

    throw new Error(
      `Allternit runtime failed health verification at ${apiUrl}.${detail ? ` Diagnostics:\n${detail}` : ''}`,
    );
  }

  private generateToken(length: number): string {
    return createHash('sha256').update(Math.random().toString() + Date.now().toString()).digest('hex').slice(0, length);
  }

  /**
   * Abort installation
   */
  abortInstallation(installationId: string): void {
    const installation = this.activeInstallations.get(installationId);
    if (installation) {
      installation.abort = true;
      installation.ssh.dispose();
      this.activeInstallations.delete(installationId);
    }
  }
}

export const backendInstaller = new BackendInstallerService();
export default backendInstaller;
