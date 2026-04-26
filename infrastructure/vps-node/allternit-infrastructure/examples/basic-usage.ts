/**
 * Basic Usage Examples for Allternit Infrastructure Runtime
 */

import {
  EnvironmentEngine,
  DevContainerRuntime,
  NixRuntime,
  SandboxRuntime,
  TargetAdapter,
} from '../src/runtime';

// ============================================================================
// Example 1: Provision a Node.js Development Environment
// ============================================================================
async function provisionNodeEnvironment() {
  const engine = new EnvironmentEngine();

  // Provision a new environment
  const env = await engine.provision({
    id: 'my-node-app',
    type: 'devcontainer',
    template: 'node-typescript',
    target: {
      type: 'local',
      localDocker: true,
    },
    variables: {
      NODE_ENV: 'development',
    },
    resources: {
      cpu: 2,
      memory: '4Gi',
      disk: '10Gi',
    },
    networking: {
      ports: [
        { host: 3000, container: 3000 },
        { host: 9229, container: 9229 }, // Debug port
      ],
    },
  });

  console.log('Environment provisioned:', env.id);
  console.log('Status:', env.status);
  console.log('Endpoints:', env.endpoints);

  // Execute a command
  const result = await engine.executeCommand(env.id, 'node --version');
  console.log('Node version:', result.stdout);

  // Get logs
  const logs = await engine.getLogs(env.id);
  console.log('Logs:', logs);

  // Clean up
  await engine.destroy(env.id);
}

// ============================================================================
// Example 2: Provision a Nix Environment
// ============================================================================
async function provisionNixEnvironment() {
  const engine = new EnvironmentEngine();

  const env = await engine.provision({
    id: 'my-nix-project',
    type: 'nix',
    template: 'nix-unified',
    target: {
      type: 'local',
    },
    resources: {
      cpu: 4,
      memory: '8Gi',
    },
  });

  console.log('Nix environment ready:', env.id);

  // Execute commands in the Nix shell
  const result = await engine.executeCommand(env.id, 'which node && which python3 && which rustc');
  console.log('Available tools:', result.stdout);

  await engine.destroy(env.id);
}

// ============================================================================
// Example 3: Create an Isolated Sandbox
// ============================================================================
async function createSandbox() {
  const engine = new EnvironmentEngine();

  const env = await engine.provision({
    id: 'secure-sandbox',
    type: 'sandbox',
    target: {
      type: 'local',
    },
    resources: {
      cpu: 1,
      memory: '512Mi',
      disk: '1Gi',
    },
    networking: {
      networkMode: 'none', // No network access
    },
    environment: {
      SECURE_MODE: 'true',
    },
  });

  console.log('Sandbox created:', env.id);

  // Run isolated command
  const result = await engine.executeCommand(env.id, 'echo "Running in sandbox"');
  console.log('Output:', result.stdout);

  await engine.destroy(env.id);
}

// ============================================================================
// Example 4: Provision on Remote SSH Target
// ============================================================================
async function provisionRemoteEnvironment() {
  const engine = new EnvironmentEngine();

  const env = await engine.provision({
    id: 'remote-dev-env',
    type: 'devcontainer',
    template: 'python-ml',
    target: {
      type: 'ssh',
      host: 'dev-server.example.com',
      port: 22,
      username: 'developer',
      privateKey: '~/.ssh/id_rsa',
    },
    resources: {
      cpu: 8,
      memory: '32Gi',
      gpu: true,
    },
    networking: {
      ports: [
        { container: 8888 }, // Jupyter
        { container: 6006 }, // TensorBoard
      ],
    },
  });

  console.log('Remote environment provisioned:', env.id);

  // Forward remote ports to local
  console.log('Jupyter available at:', env.endpoints.find(e => e.port === 8888)?.url);

  await engine.destroy(env.id);
}

// ============================================================================
// Example 5: Cloud Instance Provisioning
// ============================================================================
async function provisionCloudEnvironment() {
  const engine = new EnvironmentEngine();

  const env = await engine.provision({
    id: 'cloud-dev-env',
    type: 'devcontainer',
    template: 'rust-systems',
    target: {
      type: 'cloud',
      provider: 'aws',
      region: 'us-west-2',
      instanceType: 'c5.2xlarge',
    },
    resources: {
      cpu: 8,
      memory: '16Gi',
      disk: '100Gi',
    },
  });

  console.log('Cloud environment provisioned:', env.id);
  console.log('Public IP:', env.endpoints[0]?.url);

  await engine.destroy(env.id);
}

// ============================================================================
// Example 6: Event Handling
// ============================================================================
async function provisionWithEvents() {
  const engine = new EnvironmentEngine();

  // Listen to events
  engine.on('provision:start', ({ id, type }) => {
    console.log(`[${id}] Starting ${type} provisioning...`);
  });

  engine.on('provision:complete', ({ id, duration }) => {
    console.log(`[${id}] Provisioning completed in ${duration}ms`);
  });

  engine.on('log', ({ envId, level, message, source }) => {
    console.log(`[${envId}] [${level}] [${source}] ${message}`);
  });

  const env = await engine.provision({
    id: 'evented-env',
    type: 'devcontainer',
    template: 'go-backend',
    target: { type: 'local' },
  });

  await engine.destroy(env.id);
}

// ============================================================================
// Example 7: Using Individual Runtimes Directly
// ============================================================================
async function useDevContainerRuntime() {
  const runtime = new DevContainerRuntime();

  // Parse devcontainer.json
  const config = await runtime.parseDevcontainerJson(`
    {
      "name": "Custom Dev Container",
      "image": "node:20",
      "forwardPorts": [3000],
      "postCreateCommand": "npm install"
    }
  `);

  console.log('Parsed config:', config.name);

  // Build custom image
  const imageId = await runtime.buildImage(`
    FROM node:20
    RUN npm install -g pnpm
    WORKDIR /app
  `, '.');

  console.log('Built image:', imageId);

  // Run container
  const container = await runtime.runContainer({
    name: 'custom-node-app',
    image: imageId,
    ports: [3000],
    environment: { NODE_ENV: 'development' },
  });

  console.log('Container running:', container.id);
}

// ============================================================================
// Example 8: Resource-Constrained Sandbox
// ============================================================================
async function createResourceConstrainedSandbox() {
  const sandbox = new SandboxRuntime();

  const box = await sandbox.createDockerSandbox({
    id: 'limited-sandbox',
    image: 'alpine:latest',
    command: ['sleep', '3600'],
    resources: {
      cpu: 0.5,
      memory: '256Mi',
    },
    cgroups: {
      cpuQuota: 50000,      // 50% of one CPU
      cpuPeriod: 100000,
      memoryLimit: '256M',
      pidsLimit: 50,
    },
    readonlyRootfs: true,
    capabilities: {
      drop: ['ALL'],
      add: ['CHOWN', 'SETGID', 'SETUID'],
    },
  });

  console.log('Constrained sandbox:', box.id);
  console.log('Resource limits applied');
}

// ============================================================================
// Main - Run examples
// ============================================================================
async function main() {
  try {
    console.log('Running examples...\n');

    // Uncomment to run specific examples:
    // await provisionNodeEnvironment();
    // await provisionNixEnvironment();
    // await createSandbox();
    // await provisionRemoteEnvironment();
    // await provisionCloudEnvironment();
    // await provisionWithEvents();
    // await useDevContainerRuntime();
    // await createResourceConstrainedSandbox();

    console.log('\nExamples completed!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export {
  provisionNodeEnvironment,
  provisionNixEnvironment,
  createSandbox,
  provisionRemoteEnvironment,
  provisionCloudEnvironment,
  provisionWithEvents,
  useDevContainerRuntime,
  createResourceConstrainedSandbox,
};
