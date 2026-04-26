import { Client, ClientChannel, SFTPWrapper } from 'ssh2';
import { NodeSSH } from 'node-ssh';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { resolve } from 'path';
import config from '../config';
import { logger } from './logger';
import { SSHConnectionError } from './errors';

export interface SSHCredentials {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface SSHExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface SSHConnection {
  client: Client;
  connected: boolean;
}

/**
 * Create SSH client and connect
 */
export async function connectSSH(credentials: SSHCredentials): Promise<SSHConnection> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let connected = false;

    const connectConfig: any = {
      host: credentials.host,
      port: credentials.port || 22,
      username: credentials.username,
      readyTimeout: config.ssh.timeoutMs,
    };

    if (credentials.password) {
      connectConfig.password = credentials.password;
    } else if (credentials.privateKey) {
      connectConfig.privateKey = credentials.privateKey;
      if (credentials.passphrase) {
        connectConfig.passphrase = credentials.passphrase;
      }
    } else {
      // Try to use SSH agent
      connectConfig.agent = process.env.SSH_AUTH_SOCK;
    }

    client.on('ready', () => {
      connected = true;
      logger.info('SSH connection established', { host: credentials.host });
      resolve({ client, connected });
    });

    client.on('error', (err: Error) => {
      logger.error('SSH connection error', { host: credentials.host, error: err.message });
      if (!connected) {
        reject(new SSHConnectionError(`Failed to connect to ${credentials.host}: ${err.message}`));
      }
    });

    client.on('close', () => {
      logger.info('SSH connection closed', { host: credentials.host });
    });

    client.on('end', () => {
      logger.debug('SSH connection ended', { host: credentials.host });
    });

    try {
      client.connect(connectConfig);
    } catch (error) {
      reject(new SSHConnectionError(`Failed to initiate SSH connection: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
}

/**
 * Execute a command via SSH
 */
export async function execCommand(
  client: Client,
  command: string,
  options: { timeout?: number; cwd?: string } = {}
): Promise<SSHExecResult> {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || config.ssh.timeoutMs;
    let stdout = '';
    let stderr = '';
    let exitCode: number | null = null;
    let timeoutId: NodeJS.Timeout;

    const fullCommand = options.cwd ? `cd ${options.cwd} && ${command}` : command;

    client.exec(fullCommand, (err: Error | undefined, stream: ClientChannel) => {
      if (err) {
        reject(new SSHConnectionError(`Failed to execute command: ${err.message}`));
        return;
      }

      // Set timeout
      timeoutId = setTimeout(() => {
        stream.close();
        reject(new SSHConnectionError(`Command timed out after ${timeout}ms`));
      }, timeout);

      stream.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      stream.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      stream.on('close', (code: number) => {
        clearTimeout(timeoutId);
        exitCode = code;
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode });
      });

      stream.on('error', (err: Error) => {
        clearTimeout(timeoutId);
        reject(new SSHConnectionError(`Stream error: ${err.message}`));
      });
    });
  });
}

/**
 * Execute multiple commands via SSH
 */
export async function execCommands(
  client: Client,
  commands: string[],
  options: { timeout?: number; cwd?: string } = {}
): Promise<SSHExecResult[]> {
  const results: SSHExecResult[] = [];
  
  for (const command of commands) {
    const result = await execCommand(client, command, options);
    results.push(result);
    
    // Stop on first error unless specified otherwise
    if (result.exitCode !== 0) {
      break;
    }
  }
  
  return results;
}

/**
 * Upload file via SFTP
 */
export async function uploadFile(
  client: Client,
  localPath: string,
  remotePath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    client.sftp((err: Error | undefined, sftp: SFTPWrapper) => {
      if (err) {
        reject(new SSHConnectionError(`Failed to create SFTP session: ${err.message}`));
        return;
      }

      sftp.fastPut(localPath, remotePath, (err: Error | undefined) => {
        if (err) {
          reject(new SSHConnectionError(`Failed to upload file: ${err.message}`));
        } else {
          logger.debug('File uploaded successfully', { localPath, remotePath });
          resolve();
        }
      });
    });
  });
}

/**
 * Download file via SFTP
 */
export async function downloadFile(
  client: Client,
  remotePath: string,
  localPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    client.sftp((err: Error | undefined, sftp: SFTPWrapper) => {
      if (err) {
        reject(new SSHConnectionError(`Failed to create SFTP session: ${err.message}`));
        return;
      }

      sftp.fastGet(remotePath, localPath, (err: Error | undefined) => {
        if (err) {
          reject(new SSHConnectionError(`Failed to download file: ${err.message}`));
        } else {
          logger.debug('File downloaded successfully', { remotePath, localPath });
          resolve();
        }
      });
    });
  });
}

/**
 * Write file content to remote server
 */
export async function writeRemoteFile(
  client: Client,
  remotePath: string,
  content: string,
  mode: string = '0644'
): Promise<void> {
  const result = await execCommand(client, `cat > ${remotePath} << 'EOF'
${content}
EOF`);
  
  if (result.exitCode !== 0) {
    throw new SSHConnectionError(`Failed to write remote file: ${result.stderr}`);
  }

  // Set permissions
  const chmodResult = await execCommand(client, `chmod ${mode} ${remotePath}`);
  if (chmodResult.exitCode !== 0) {
    throw new SSHConnectionError(`Failed to set file permissions: ${chmodResult.stderr}`);
  }

  logger.debug('Remote file written successfully', { remotePath });
}

/**
 * Read remote file content
 */
export async function readRemoteFile(
  client: Client,
  remotePath: string
): Promise<string> {
  const result = await execCommand(client, `cat ${remotePath}`);
  
  if (result.exitCode !== 0) {
    throw new SSHConnectionError(`Failed to read remote file: ${result.stderr}`);
  }

  return result.stdout;
}

/**
 * Check if file exists on remote server
 */
export async function remoteFileExists(
  client: Client,
  remotePath: string
): Promise<boolean> {
  const result = await execCommand(client, `test -f ${remotePath} && echo "exists" || echo "not found"`);
  return result.stdout === 'exists';
}

/**
 * Create directory on remote server
 */
export async function createRemoteDirectory(
  client: Client,
  remotePath: string,
  mode: string = '0755'
): Promise<void> {
  const result = await execCommand(client, `mkdir -p ${remotePath} && chmod ${mode} ${remotePath}`);
  
  if (result.exitCode !== 0) {
    throw new SSHConnectionError(`Failed to create remote directory: ${result.stderr}`);
  }

  logger.debug('Remote directory created', { remotePath });
}

/**
 * Disconnect SSH client
 */
export function disconnectSSH(client: Client): void {
  client.end();
}

/**
 * Test SSH connection
 */
export async function testSSHConnection(credentials: SSHCredentials): Promise<{
  success: boolean;
  message: string;
  latency?: number;
}> {
  const start = Date.now();
  let connection: SSHConnection | null = null;

  try {
    connection = await connectSSH(credentials);
    const latency = Date.now() - start;
    
    // Test with a simple command
    const result = await execCommand(connection.client, 'echo "Allternit SSH Test"');
    
    if (result.exitCode === 0 && result.stdout === 'Allternit SSH Test') {
      return {
        success: true,
        message: 'SSH connection successful',
        latency,
      };
    } else {
      return {
        success: false,
        message: `SSH test command failed: ${result.stderr}`,
        latency,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - start,
    };
  } finally {
    if (connection) {
      disconnectSSH(connection.client);
    }
  }
}

/**
 * Get SSH public key content
 */
export async function getSSHPublicKey(keyPath?: string): Promise<string> {
  const path = keyPath || resolve(homedir(), '.ssh/id_rsa.pub');
  try {
    const content = await readFile(path, 'utf-8');
    return content.trim();
  } catch (error) {
    throw new SSHConnectionError(`Failed to read SSH public key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get SSH private key content
 */
export async function getSSHPrivateKey(keyPath?: string): Promise<string> {
  const path = keyPath || resolve(homedir(), '.ssh/id_rsa');
  try {
    const content = await readFile(path, 'utf-8');
    return content.trim();
  } catch (error) {
    throw new SSHConnectionError(`Failed to read SSH private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Add authorized key to remote server
 */
export async function addAuthorizedKey(
  client: Client,
  publicKey: string
): Promise<void> {
  const sshDir = '~/.ssh';
  const authorizedKeysFile = `${sshDir}/authorized_keys`;

  // Ensure .ssh directory exists
  await createRemoteDirectory(client, sshDir, '0700');

  // Check if key already exists
  const keyExists = await execCommand(
    client,
    `grep -F "${publicKey}" ${authorizedKeysFile} 2>/dev/null && echo "exists" || echo "not found"`
  );

  if (keyExists.stdout === 'exists') {
    logger.debug('SSH key already exists on remote server');
    return;
  }

  // Add key to authorized_keys
  const result = await execCommand(
    client,
    `echo "${publicKey}" >> ${authorizedKeysFile} && chmod 600 ${authorizedKeysFile}`
  );

  if (result.exitCode !== 0) {
    throw new SSHConnectionError(`Failed to add authorized key: ${result.stderr}`);
  }

  logger.info('SSH key added to remote server authorized_keys');
}

/**
 * Install Allternit node on remote server
 */
export async function installAllternitNode(
  client: Client,
  options: {
    version?: string;
    port?: number;
    installDir?: string;
  } = {}
): Promise<{ success: boolean; message: string; installPath?: string }> {
  const version = options.version || 'latest';
  const port = options.port || 8080;
  const installDir = options.installDir || '/opt/allternit';

  try {
    // Create installation directory
    await createRemoteDirectory(client, installDir);

    // Check if Docker is installed
    const dockerCheck = await execCommand(client, 'which docker');
    if (dockerCheck.exitCode !== 0) {
      // Install Docker
      logger.info('Docker not found, installing...');
      const installDocker = await execCommand(client, `
        curl -fsSL https://get.docker.com -o get-docker.sh &&
        sh get-docker.sh &&
        systemctl enable docker &&
        systemctl start docker
      `);
      
      if (installDocker.exitCode !== 0) {
        return {
          success: false,
          message: `Docker installation failed: ${installDocker.stderr}`,
        };
      }
    }

    // Pull and run Allternit node
    const dockerCompose = `
version: '3.8'
services:
  allternit-node:
    image: allternit/node:${version}
    container_name: allternit-node
    ports:
      - "${port}:8080"
      - "${port + 1}:8081"
    environment:
      - NODE_ENV=production
    volumes:
      - allternit-data:/data
    restart: unless-stopped
volumes:
  allternit-data:
`;

    await writeRemoteFile(client, `${installDir}/docker-compose.yml`, dockerCompose);

    // Start the container
    const startResult = await execCommand(client, `cd ${installDir} && docker-compose up -d`);
    
    if (startResult.exitCode !== 0) {
      return {
        success: false,
        message: `Failed to start Allternit node: ${startResult.stderr}`,
      };
    }

    return {
      success: true,
      message: 'Allternit node installed successfully',
      installPath: installDir,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Installation failed',
    };
  }
}

export default {
  connectSSH,
  execCommand,
  execCommands,
  uploadFile,
  downloadFile,
  writeRemoteFile,
  readRemoteFile,
  remoteFileExists,
  createRemoteDirectory,
  disconnectSSH,
  testSSHConnection,
  getSSHPublicKey,
  getSSHPrivateKey,
  addAuthorizedKey,
  installAllternitNode,
};
