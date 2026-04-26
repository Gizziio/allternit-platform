#!/usr/bin/env node
/**
 * Allternit Local Backend API Server
 * 
 * Replaces the Go backend with TypeScript/Node.js
 * Handles SSH connections and remote VPS installation
 * 
 * Usage: node backend-api.ts [--port 4096]
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { NodeSSH } from 'node-ssh';
import { randomBytes } from 'crypto';

const VERSION = '1.0.0';
const DEFAULT_PORT = 4096;
const RUNTIME_SERVICE_USER = 'gizzi';
const RUNTIME_AUTH_USER = 'gizzi';
const GITHUB_REPO = process.env.ALLTERNIT_GITHUB_REPO || 'Gizziio/allternit';
const INSTALLER_URLS = [
  process.env.ALLTERNIT_INSTALLER_URL,
  'https://install.allternit.com',
  'https://raw.githubusercontent.com/Gizziio/allternit/main/surfaces/allternit-platform/install.sh',
  'https://github.com/Gizziio/allternit/raw/main/surfaces/allternit-platform/install.sh',
].filter((value): value is string => Boolean(value && value.trim()));

// Parse arguments
const args = process.argv.slice(2);
let PORT = DEFAULT_PORT;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    PORT = parseInt(args[i + 1], 10);
  }
}

// Generate API key
const API_KEY = randomBytes(32).toString('hex');

// Express app
const app = express();
app.use(cors());
app.use(express.json());

// Types
interface SSHTestRequest {
  host: string;
  port: number;
  username: string;
  password?: string;
  private_key?: string;
  auth_type: 'password' | 'key';
}

interface SystemInfo {
  os: string;
  distro: string;
  version: string;
  architecture: string;
  isAllternitInstalled: boolean;
  hasSystemd: boolean;
  allternitVersion?: string;
}

interface SSHTestResponse {
  success: boolean;
  error?: string;
  system_info?: SystemInfo;
}

interface InstallRequest {
  host: string;
  port: number;
  username: string;
  password?: string;
  private_key?: string;
  installation_id: string;
}

interface ProgressMessage {
  step: string;
  progress: number;
  message: string;
  success?: boolean;
  error?: string;
  apiUrl?: string;
}

function quoteShell(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

async function execChecked(ssh: NodeSSH, command: string, context: string) {
  const result = await ssh.execCommand(`bash -lc ${quoteShell(command)}`, {
    execOptions: { pty: true },
  });

  if (result.code !== 0) {
    const detail = [result.stdout, result.stderr]
      .map((value) => value.trim())
      .filter(Boolean)
      .join('\n');
    throw new Error(detail || context);
  }

  return result;
}

function normalizeArch(arch: string): 'amd64' | 'arm64' {
  if (arch.includes('arm') || arch.includes('aarch64')) {
    return 'arm64';
  }
  return 'amd64';
}

function buildRemoteInstallerCommand(runtimePassword: string, arch: 'amd64' | 'arm64'): string {
  return `set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"
export VERSION=${quoteShell(VERSION)}
export ALLTERNIT_VERSION=${quoteShell(VERSION)}
export ALLTERNIT_SERVICE_USER=${quoteShell(RUNTIME_SERVICE_USER)}
export ALLTERNIT_GIZZI_SERVER_USERNAME=${quoteShell(RUNTIME_AUTH_USER)}
export ALLTERNIT_GIZZI_SERVER_PASSWORD=${quoteShell(runtimePassword)}
export ALLTERNIT_RUNTIME_PORT='4096'
export ALLTERNIT_TARGET_ARCH=${quoteShell(arch)}
export ALLTERNIT_GITHUB_REPO=${quoteShell(GITHUB_REPO)}
export ALLTERNIT_GITHUB_REF=${quoteShell(process.env.ALLTERNIT_GITHUB_REF || `v${VERSION}`)}
export ALLTERNIT_BINARY_BASE_URL=${quoteShell(process.env.ALLTERNIT_BINARY_BASE_URL || '')}
for url in ${INSTALLER_URLS.map((value) => quoteShell(value)).join(' ')}; do
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
}

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: VERSION,
    timestamp: Math.floor(Date.now() / 1000)
  });
});

// Version
app.get('/api/v1/version', (req, res) => {
  res.json({
    version: VERSION,
    build_date: new Date().toISOString(),
    runtime: `Node.js ${process.version}`,
    platform: process.platform,
    arch: process.arch
  });
});

// SSH Test endpoint
app.post('/api/v1/backend-install/test', async (req, res) => {
  const body: SSHTestRequest = req.body;
  
  console.log(`[SSH Test] Testing connection to ${body.host}:${body.port || 22}`);
  
  const { NodeSSH } = await import('node-ssh');
  const ssh = new NodeSSH();
  
  try {
    const config: any = {
      host: body.host,
      port: body.port || 22,
      username: body.username,
      readyTimeout: 20000
    };
    
    if (body.auth_type === 'key' && body.private_key) {
      config.privateKey = body.private_key;
    } else if (body.password) {
      config.password = body.password;
    }
    
    await ssh.connect(config);
    
    // Gather system info
    const info: SystemInfo = {
      os: '',
      distro: '',
      version: '',
      architecture: '',
      isAllternitInstalled: false,
      hasSystemd: false
    };
    
    // Get OS info (use exec with pty for compatibility)
    const osResult = await ssh.execCommand('cat /etc/os-release 2>/dev/null || echo "ID=unknown"', { execOptions: { pty: true } });
    const osLines = osResult.stdout.split('\n');
    for (const line of osLines) {
      if (line.startsWith('ID=')) {
        info.distro = line.replace('ID=', '').replace(/"/g, '').trim();
      }
      if (line.startsWith('VERSION_ID=')) {
        info.version = line.replace('VERSION_ID=', '').replace(/"/g, '').trim();
      }
      if (line.startsWith('PRETTY_NAME=')) {
        info.os = line.replace('PRETTY_NAME=', '').replace(/"/g, '').trim();
      }
    }
    
    // Get architecture
    const archResult = await ssh.execCommand('uname -m', { execOptions: { pty: true } });
    info.architecture = archResult.stdout.trim();
    
    // Check systemd
    const systemdResult = await ssh.execCommand('which systemctl 2>/dev/null && echo "yes" || echo "no"');
    info.hasSystemd = systemdResult.stdout.trim() === 'yes';
    
    // Check if the real remote runtime is installed
    const allternitResult = await ssh.execCommand('test -x /opt/allternit/bin/gizzi-code && echo "yes" || echo "no"');
    info.isAllternitInstalled = allternitResult.stdout.trim() === 'yes';
    
    if (info.isAllternitInstalled) {
      const versionResult = await ssh.execCommand('/opt/allternit/bin/gizzi-code --version 2>/dev/null || echo ""');
      info.allternitVersion = versionResult.stdout.trim();
    }
    
    ssh.dispose();
    
    console.log(`[SSH Test] Success - ${info.os} (${info.architecture})`);
    
    res.json({
      success: true,
      system_info: info
    } as SSHTestResponse);
    
  } catch (error: any) {
    console.error('[SSH Test] Failed:', error.message);
    ssh.dispose();
    
    res.json({
      success: false,
      error: error.message
    } as SSHTestResponse);
  }
});

// Create HTTP server
const server = createServer(app);

// WebSocket server for installation progress
const wss = new WebSocketServer({ 
  server,
  path: '/api/v1/backend-install/progress'
});

wss.on('connection', (ws: WebSocket) => {
  console.log('[WebSocket] Client connected');
  
  ws.on('message', async (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.action === 'start_installation') {
        const installReq: InstallRequest = {
          host: msg.host,
          port: msg.port || 22,
          username: msg.username,
          password: msg.password,
          private_key: msg.private_key,
          installation_id: msg.installation_id
        };
        
        console.log(`[Install] Starting installation ${installReq.installation_id} for ${installReq.host}`);
        
        // Run installation
        await performInstallation(ws, installReq);
      }
    } catch (err: any) {
      console.error('[WebSocket] Error:', err.message);
      sendProgress(ws, {
        step: 'error',
        progress: 0,
        message: 'Invalid message',
        error: err.message
      });
    }
  });
  
  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected');
  });
});

function sendProgress(ws: WebSocket, msg: ProgressMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

async function performInstallation(ws: WebSocket, req: InstallRequest) {
  const ssh = new NodeSSH();
  
  try {
    // Step 1: Connect
    sendProgress(ws, {
      step: 'connecting',
      progress: 5,
      message: 'Connecting to server via SSH...'
    });
    
    const config: any = {
      host: req.host,
      port: req.port,
      username: req.username,
      readyTimeout: 30000
    };
    
    if (req.private_key) {
      config.privateKey = req.private_key;
    } else if (req.password) {
      config.password = req.password;
    }
    
    await ssh.connect(config);
    
    // Step 2: Detect OS
    sendProgress(ws, {
      step: 'detecting_os',
      progress: 15,
      message: 'Detecting operating system...'
    });
    
    const archResult = await ssh.execCommand('uname -m', { execOptions: { pty: true } });
    const arch = archResult.stdout.trim();
    const normalizedArch = normalizeArch(arch);
    const runtimePassword = randomBytes(24).toString('hex');
    
    sendProgress(ws, {
      step: 'detecting_os',
      progress: 20,
      message: `Detected: ${arch}`
    });
    
    // Step 3: Preflight host shell/runtime basics
    sendProgress(ws, {
      step: 'installing_deps',
      progress: 25,
      message: 'Running install preflight...'
    });
    
    await execChecked(
      ssh,
      'command -v bash >/dev/null 2>&1 && command -v sh >/dev/null 2>&1 && ldd --version 2>/dev/null | head -1',
      'Failed install preflight on VPS',
    );
    
    // Step 4: Run the remote installer bootstrap
    sendProgress(ws, {
      step: 'downloading',
      progress: 40,
      message: 'Bootstrapping gizzi-code from remote installer...'
    });

    await execChecked(
      ssh,
      buildRemoteInstallerCommand(runtimePassword, normalizedArch),
      'Failed to bootstrap gizzi-code runtime',
    );

    sendProgress(ws, {
      step: 'configuring',
      progress: 70,
      message: 'Finalizing remote runtime configuration...'
    });

    // Step 5: Start service
    sendProgress(ws, {
      step: 'starting',
      progress: 85,
      message: 'Starting gizzi-code runtime service...'
    });

    // Wait for service to start
    await new Promise(r => setTimeout(r, 2000));
    
    // Step 6: Verify
    sendProgress(ws, {
      step: 'verifying',
      progress: 95,
      message: 'Verifying installation...'
    });
    
    const statusResult = await ssh.execCommand('systemctl is-active allternit-backend 2>/dev/null || echo "unknown"', { execOptions: { pty: true } });
    const isActive = ['active', 'unknown'].includes(statusResult.stdout.trim());
    const healthResult = await ssh.execCommand(
      `curl -fsS -u ${quoteShell(`${RUNTIME_AUTH_USER}:${runtimePassword}`)} http://127.0.0.1:4096/v1/global/health >/dev/null && echo "ok" || echo "fail"`,
      { execOptions: { pty: true } },
    );
    if (healthResult.stdout.trim() !== 'ok') {
      throw new Error('gizzi-code runtime failed health verification');
    }

    sendProgress(ws, {
      step: 'complete',
      progress: 100,
      message: isActive ? 'Installation complete!' : 'Installation complete (service status pending)',
      success: true,
      apiUrl: `http://${req.host}:4096`
    });
    
    console.log(`[Install] Complete - API at http://${req.host}:4096`);
    
    ssh.dispose();
    
  } catch (error: any) {
    console.error('[Install] Error:', error.message);
    
    sendProgress(ws, {
      step: 'error',
      progress: 0,
      message: 'Installation failed',
      error: error.message
    });
    
    ssh.dispose();
  }
}

// Start server
server.listen(PORT, () => {
  console.log(`Allternit Backend API v${VERSION} running on port ${PORT}`);
  console.log(`API Key: ${API_KEY.substring(0, 8)}...`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  Health:  http://localhost:${PORT}/api/v1/health`);
  console.log(`  WebSocket: ws://localhost:${PORT}/api/v1/backend-install/progress`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});
