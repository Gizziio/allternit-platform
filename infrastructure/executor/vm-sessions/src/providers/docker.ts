import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { VMSessionConfig } from '../session-manager.js';

const execAsync = promisify(exec);

export class DockerVMProvider {
  async boot(image: string, config: VMSessionConfig): Promise<string> {
    const sessionId = `allternit-session-${Date.now()}`;
    
    const { stdout } = await execAsync(
      `docker run -d ` +
      `--name ${sessionId} ` +
      `--cpus=${config.resources.cpu} ` +
      `--memory=${config.resources.memory}g ` +
      `--volume ${config.workspacePath}:/workspace ` +
      `-d ${image} sleep infinity`
    );
    
    console.log(`Docker VM booted: ${sessionId}`);
    return stdout.trim();
  }

  async shutdown(containerId: string): Promise<void> {
    await execAsync(`docker stop ${containerId}`);
    await execAsync(`docker rm ${containerId}`);
    console.log(`Docker VM shutdown: ${containerId}`);
  }

  async exec(containerId: string, command: string): Promise<string> {
    const { stdout } = await execAsync(
      `docker exec ${containerId} ${command}`
    );
    return stdout;
  }
}

export default DockerVMProvider;
