import { Client } from 'ssh2';
import { execCommand, SSHExecResult } from './ssh';
import { logger } from './logger';
import { DockerError } from './errors';

export interface DockerContainer {
  id: string;
  names: string[];
  image: string;
  status: string;
  state: string;
  ports: Array<{
    privatePort: number;
    publicPort?: number;
    type: string;
    ip?: string;
  }>;
  created: number;
  sizeRw?: number;
  sizeRootFs?: number;
}

export interface DockerImage {
  id: string;
  repoTags: string[];
  repoDigests: string[];
  created: number;
  size: number;
  virtualSize: number;
}

export interface DockerVolume {
  name: string;
  driver: string;
  mountpoint: string;
  labels?: Record<string, string>;
  options?: Record<string, string>;
  scope: string;
  createdAt: string;
}

export interface DockerNetwork {
  id: string;
  name: string;
  driver: string;
  scope: string;
  created: string;
}

/**
 * Check if Docker is installed and running on the remote host
 */
export async function checkDocker(client: Client): Promise<{
  installed: boolean;
  running: boolean;
  version?: string;
}> {
  const versionResult = await execCommand(client, 'docker version --format "{{.Server.Version}}" 2>/dev/null || echo "NOT_INSTALLED"');
  
  if (versionResult.stdout === 'NOT_INSTALLED' || versionResult.exitCode !== 0) {
    return { installed: false, running: false };
  }

  const infoResult = await execCommand(client, 'docker info --format "{{.ServerStatus}}" 2>/dev/null || echo "NOT_RUNNING"');
  
  return {
    installed: true,
    running: infoResult.exitCode === 0 && infoResult.stdout !== 'NOT_RUNNING',
    version: versionResult.stdout,
  };
}

/**
 * Install Docker on the remote host
 */
export async function installDocker(client: Client): Promise<SSHExecResult> {
  logger.info('Installing Docker on remote host');
  
  const commands = [
    // Update package index
    'apt-get update || yum update -y || true',
    
    // Install dependencies
    'apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release || true',
    
    // Add Docker GPG key
    'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg 2>/dev/null || curl -fsSL https://get.docker.com/gpg | apt-key add - 2>/dev/null || true',
    
    // Add Docker repository
    'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null 2>/dev/null || true',
    
    // Update and install Docker
    'apt-get update 2>/dev/null || true',
    'apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin 2>/dev/null || true',
    
    // Alternative: use Docker's install script
    'curl -fsSL https://get.docker.com -o get-docker.sh 2>/dev/null && sh get-docker.sh 2>/dev/null || true',
    
    // Start Docker service
    'systemctl enable docker 2>/dev/null || chkconfig docker on 2>/dev/null || true',
    'systemctl start docker 2>/dev/null || service docker start 2>/dev/null || true',
    
    // Add user to docker group
    'usermod -aG docker $USER 2>/dev/null || true',
  ];

  let lastResult: SSHExecResult = { stdout: '', stderr: '', exitCode: 0 };
  
  for (const command of commands) {
    lastResult = await execCommand(client, command, { timeout: 120000 });
    // Continue even if some commands fail, as different systems have different package managers
  }

  // Verify installation
  const verifyResult = await execCommand(client, 'docker --version');
  if (verifyResult.exitCode !== 0) {
    throw new DockerError('Docker installation failed', { stderr: verifyResult.stderr });
  }

  logger.info('Docker installed successfully', { version: verifyResult.stdout });
  return { stdout: 'Docker installed successfully', stderr: '', exitCode: 0 };
}

/**
 * List Docker containers
 */
export async function listContainers(
  client: Client,
  options: { all?: boolean; filters?: string } = {}
): Promise<DockerContainer[]> {
  let command = 'docker ps';
  
  if (options.all) {
    command += ' -a';
  }
  
  command += ' --format "{{json .}}"';
  
  if (options.filters) {
    command += ` --filter "${options.filters}"`;
  }

  const result = await execCommand(client, command);
  
  if (result.exitCode !== 0) {
    throw new DockerError(`Failed to list containers: ${result.stderr}`);
  }

  const lines = result.stdout.split('\n').filter(line => line.trim());
  const containers: DockerContainer[] = [];

  for (const line of lines) {
    try {
      const container = JSON.parse(line);
      containers.push({
        id: container.ID,
        names: container.Names ? container.Names.split(',') : [],
        image: container.Image,
        status: container.Status,
        state: container.State,
        ports: parsePorts(container.Ports),
        created: container.CreatedAt ? new Date(container.CreatedAt).getTime() / 1000 : 0,
      });
    } catch (e) {
      logger.warn('Failed to parse container JSON', { line, error: e });
    }
  }

  return containers;
}

/**
 * Parse Docker port string
 */
function parsePorts(portsStr: string): DockerContainer['ports'] {
  const ports: DockerContainer['ports'] = [];
  
  if (!portsStr || portsStr === '') {
    return ports;
  }

  const portMappings = portsStr.split(', ');
  
  for (const mapping of portMappings) {
    // Format: 0.0.0.0:8080->80/tcp or :::8080->80/tcp or 80/tcp
    const match = mapping.match(/(?:(\S*):)?(\d+)?->(\d+)\/(tcp|udp)/);
    if (match) {
      ports.push({
        ip: match[1] || undefined,
        publicPort: match[2] ? parseInt(match[2], 10) : undefined,
        privatePort: parseInt(match[3], 10),
        type: match[4],
      });
    }
  }

  return ports;
}

/**
 * Get container details
 */
export async function getContainer(client: Client, containerId: string): Promise<DockerContainer | null> {
  const result = await execCommand(client, `docker inspect --format "{{json .}}" ${containerId}`);
  
  if (result.exitCode !== 0) {
    if (result.stderr.includes('No such container')) {
      return null;
    }
    throw new DockerError(`Failed to inspect container: ${result.stderr}`);
  }

  try {
    const inspect = JSON.parse(result.stdout);
    const container = Array.isArray(inspect) ? inspect[0] : inspect;
    
    return {
      id: container.Id,
      names: container.Names || [],
      image: container.Config?.Image || '',
      status: container.State?.Status || '',
      state: container.State?.Status || '',
      ports: Object.entries(container.NetworkSettings?.Ports || {}).flatMap(([key, value]: [string, any]) => {
        const [port, protocol] = key.split('/');
        return (value || []).map((binding: any) => ({
          privatePort: parseInt(port, 10),
          publicPort: binding.HostPort ? parseInt(binding.HostPort, 10) : undefined,
          type: protocol,
          ip: binding.HostIp,
        }));
      }),
      created: new Date(container.Created).getTime() / 1000,
      sizeRw: container.SizeRw,
      sizeRootFs: container.SizeRootFs,
    };
  } catch (e) {
    throw new DockerError('Failed to parse container inspection', { error: e });
  }
}

/**
 * Run a new container
 */
export async function runContainer(
  client: Client,
  options: {
    image: string;
    name?: string;
    ports?: Array<{ host: number; container: number; protocol?: string }>;
    volumes?: Array<{ host: string; container: string; mode?: string }>;
    environment?: Record<string, string>;
    network?: string;
    restart?: string;
    detach?: boolean;
    command?: string;
    labels?: Record<string, string>;
  }
): Promise<{ containerId: string; exitCode: number }> {
  let command = 'docker run';

  if (options.detach !== false) {
    command += ' -d';
  }

  if (options.name) {
    command += ` --name ${options.name}`;
  }

  if (options.restart) {
    command += ` --restart ${options.restart}`;
  }

  if (options.network) {
    command += ` --network ${options.network}`;
  }

  // Add port mappings
  if (options.ports) {
    for (const port of options.ports) {
      const protocol = port.protocol || 'tcp';
      command += ` -p ${port.host}:${port.container}/${protocol}`;
    }
  }

  // Add volume mappings
  if (options.volumes) {
    for (const volume of options.volumes) {
      const mode = volume.mode || 'rw';
      command += ` -v ${volume.host}:${volume.container}:${mode}`;
    }
  }

  // Add environment variables
  if (options.environment) {
    for (const [key, value] of Object.entries(options.environment)) {
      command += ` -e ${key}="${value}"`;
    }
  }

  // Add labels
  if (options.labels) {
    for (const [key, value] of Object.entries(options.labels)) {
      command += ` -l ${key}="${value}"`;
    }
  }

  command += ` ${options.image}`;

  if (options.command) {
    command += ` ${options.command}`;
  }

  const result = await execCommand(client, command);

  if (result.exitCode !== 0) {
    throw new DockerError(`Failed to run container: ${result.stderr}`);
  }

  return {
    containerId: result.stdout.trim(),
    exitCode: 0,
  };
}

/**
 * Stop a container
 */
export async function stopContainer(
  client: Client,
  containerId: string,
  timeout: number = 30
): Promise<void> {
  const result = await execCommand(client, `docker stop -t ${timeout} ${containerId}`);
  
  if (result.exitCode !== 0) {
    throw new DockerError(`Failed to stop container: ${result.stderr}`);
  }

  logger.info('Container stopped', { containerId });
}

/**
 * Start a container
 */
export async function startContainer(client: Client, containerId: string): Promise<void> {
  const result = await execCommand(client, `docker start ${containerId}`);
  
  if (result.exitCode !== 0) {
    throw new DockerError(`Failed to start container: ${result.stderr}`);
  }

  logger.info('Container started', { containerId });
}

/**
 * Restart a container
 */
export async function restartContainer(
  client: Client,
  containerId: string,
  timeout: number = 30
): Promise<void> {
  const result = await execCommand(client, `docker restart -t ${timeout} ${containerId}`);
  
  if (result.exitCode !== 0) {
    throw new DockerError(`Failed to restart container: ${result.stderr}`);
  }

  logger.info('Container restarted', { containerId });
}

/**
 * Remove a container
 */
export async function removeContainer(
  client: Client,
  containerId: string,
  force: boolean = false
): Promise<void> {
  let command = 'docker rm';
  
  if (force) {
    command += ' -f';
  }
  
  command += ` ${containerId}`;

  const result = await execCommand(client, command);
  
  if (result.exitCode !== 0) {
    throw new DockerError(`Failed to remove container: ${result.stderr}`);
  }

  logger.info('Container removed', { containerId });
}

/**
 * Get container logs
 */
export async function getContainerLogs(
  client: Client,
  containerId: string,
  options: {
    tail?: number;
    since?: string;
    until?: string;
    timestamps?: boolean;
    follow?: boolean;
  } = {}
): Promise<string> {
  let command = 'docker logs';

  if (options.tail) {
    command += ` --tail ${options.tail}`;
  }

  if (options.since) {
    command += ` --since ${options.since}`;
  }

  if (options.until) {
    command += ` --until ${options.until}`;
  }

  if (options.timestamps) {
    command += ' -t';
  }

  if (options.follow) {
    command += ' -f';
  }

  command += ` ${containerId}`;

  const result = await execCommand(client, command);
  
  if (result.exitCode !== 0) {
    throw new DockerError(`Failed to get container logs: ${result.stderr}`);
  }

  return result.stdout;
}

/**
 * Execute command in container
 */
export async function execInContainer(
  client: Client,
  containerId: string,
  command: string,
  options: { interactive?: boolean; tty?: boolean; user?: string; workingDir?: string } = {}
): Promise<SSHExecResult> {
  let dockerCommand = 'docker exec';

  if (options.interactive) {
    dockerCommand += ' -i';
  }

  if (options.tty) {
    dockerCommand += ' -t';
  }

  if (options.user) {
    dockerCommand += ` -u ${options.user}`;
  }

  if (options.workingDir) {
    dockerCommand += ` -w ${options.workingDir}`;
  }

  dockerCommand += ` ${containerId} ${command}`;

  return await execCommand(client, dockerCommand);
}

/**
 * Pull Docker image
 */
export async function pullImage(client: Client, image: string): Promise<void> {
  logger.info('Pulling Docker image', { image });
  
  const result = await execCommand(client, `docker pull ${image}`, { timeout: 300000 });
  
  if (result.exitCode !== 0) {
    throw new DockerError(`Failed to pull image: ${result.stderr}`);
  }

  logger.info('Docker image pulled successfully', { image });
}

/**
 * List Docker images
 */
export async function listImages(client: Client): Promise<DockerImage[]> {
  const result = await execCommand(client, 'docker images --format "{{json .}}"');
  
  if (result.exitCode !== 0) {
    throw new DockerError(`Failed to list images: ${result.stderr}`);
  }

  const lines = result.stdout.split('\n').filter(line => line.trim());
  const images: DockerImage[] = [];

  for (const line of lines) {
    try {
      const image = JSON.parse(line);
      images.push({
        id: image.ID,
        repoTags: image.Repository && image.Tag ? [`${image.Repository}:${image.Tag}`] : [],
        repoDigests: [],
        created: 0,
        size: parseInt(image.Size, 10) || 0,
        virtualSize: parseInt(image.VirtualSize, 10) || 0,
      });
    } catch (e) {
      logger.warn('Failed to parse image JSON', { line, error: e });
    }
  }

  return images;
}

/**
 * Remove Docker image
 */
export async function removeImage(client: Client, imageId: string, force: boolean = false): Promise<void> {
  let command = 'docker rmi';
  
  if (force) {
    command += ' -f';
  }
  
  command += ` ${imageId}`;

  const result = await execCommand(client, command);
  
  if (result.exitCode !== 0) {
    throw new DockerError(`Failed to remove image: ${result.stderr}`);
  }

  logger.info('Docker image removed', { imageId });
}

/**
 * List Docker volumes
 */
export async function listVolumes(client: Client): Promise<DockerVolume[]> {
  const result = await execCommand(client, 'docker volume ls --format "{{json .}}"');
  
  if (result.exitCode !== 0) {
    throw new DockerError(`Failed to list volumes: ${result.stderr}`);
  }

  const lines = result.stdout.split('\n').filter(line => line.trim());
  const volumes: DockerVolume[] = [];

  for (const line of lines) {
    try {
      const volume = JSON.parse(line);
      volumes.push({
        name: volume.Name,
        driver: volume.Driver,
        mountpoint: volume.Mountpoint,
        scope: volume.Scope,
        createdAt: volume.CreatedAt,
      });
    } catch (e) {
      logger.warn('Failed to parse volume JSON', { line, error: e });
    }
  }

  return volumes;
}

/**
 * Create Docker volume
 */
export async function createVolume(
  client: Client,
  name: string,
  driver: string = 'local',
  options?: Record<string, string>
): Promise<void> {
  let command = `docker volume create --driver ${driver}`;

  if (options) {
    for (const [key, value] of Object.entries(options)) {
      command += ` -o ${key}=${value}`;
    }
  }

  command += ` ${name}`;

  const result = await execCommand(client, command);
  
  if (result.exitCode !== 0) {
    throw new DockerError(`Failed to create volume: ${result.stderr}`);
  }

  logger.info('Docker volume created', { name, driver });
}

/**
 * Remove Docker volume
 */
export async function removeVolume(client: Client, name: string, force: boolean = false): Promise<void> {
  let command = 'docker volume rm';
  
  if (force) {
    command += ' -f';
  }
  
  command += ` ${name}`;

  const result = await execCommand(client, command);
  
  if (result.exitCode !== 0) {
    throw new DockerError(`Failed to remove volume: ${result.stderr}`);
  }

  logger.info('Docker volume removed', { name });
}

/**
 * Deploy using Docker Compose
 */
export async function deployCompose(
  client: Client,
  composeContent: string,
  options: {
    projectName?: string;
    workingDir?: string;
    envFile?: string;
  } = {}
): Promise<{ success: boolean; output: string; services?: string[] }> {
  const workDir = options.workDir || '/tmp/a2r-compose';
  
  // Create working directory
  const mkdirResult = await execCommand(client, `mkdir -p ${workDir}`);
  if (mkdirResult.exitCode !== 0) {
    throw new DockerError(`Failed to create working directory: ${mkdirResult.stderr}`);
  }

  // Write docker-compose.yml
  const escapedContent = composeContent.replace(/"/g, '\\"').replace(/\$/g, '\\$');
  const writeResult = await execCommand(
    client,
    `cat > ${workDir}/docker-compose.yml << 'EOF'
${composeContent}
EOF`
  );
  
  if (writeResult.exitCode !== 0) {
    throw new DockerError(`Failed to write docker-compose.yml: ${writeResult.stderr}`);
  }

  // Run docker-compose up
  let command = 'docker-compose up -d';
  
  if (options.projectName) {
    command += ` -p ${options.projectName}`;
  }

  const result = await execCommand(client, `cd ${workDir} && ${command}`, { timeout: 300000 });

  if (result.exitCode !== 0) {
    return {
      success: false,
      output: result.stderr,
    };
  }

  // Get list of services
  const psResult = await execCommand(
    client,
    `cd ${workDir} && docker-compose ps --format json 2>/dev/null || docker-compose ps`
  );

  return {
    success: true,
    output: result.stdout + '\n' + psResult.stdout,
  };
}

/**
 * Stop Docker Compose deployment
 */
export async function stopCompose(
  client: Client,
  workingDir: string,
  options: { projectName?: string; removeVolumes?: boolean } = {}
): Promise<void> {
  let command = 'docker-compose down';

  if (options.removeVolumes) {
    command += ' -v';
  }

  if (options.projectName) {
    command += ` -p ${options.projectName}`;
  }

  const result = await execCommand(client, `cd ${workingDir} && ${command}`, { timeout: 120000 });

  if (result.exitCode !== 0) {
    throw new DockerError(`Failed to stop compose deployment: ${result.stderr}`);
  }

  logger.info('Docker Compose deployment stopped', { workingDir });
}

/**
 * Get Docker Compose logs
 */
export async function getComposeLogs(
  client: Client,
  workingDir: string,
  options: {
    services?: string[];
    tail?: number;
    follow?: boolean;
    timestamps?: boolean;
  } = {}
): Promise<string> {
  let command = 'docker-compose logs';

  if (options.follow) {
    command += ' -f';
  }

  if (options.timestamps) {
    command += ' -t';
  }

  if (options.tail) {
    command += ` --tail ${options.tail}`;
  }

  if (options.services && options.services.length > 0) {
    command += ` ${options.services.join(' ')}`;
  }

  const result = await execCommand(client, `cd ${workingDir} && ${command}`);

  if (result.exitCode !== 0) {
    throw new DockerError(`Failed to get compose logs: ${result.stderr}`);
  }

  return result.stdout;
}

export default {
  checkDocker,
  installDocker,
  listContainers,
  getContainer,
  runContainer,
  stopContainer,
  startContainer,
  restartContainer,
  removeContainer,
  getContainerLogs,
  execInContainer,
  pullImage,
  listImages,
  removeImage,
  listVolumes,
  createVolume,
  removeVolume,
  deployCompose,
  stopCompose,
  getComposeLogs,
};
