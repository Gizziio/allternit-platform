import { Command } from 'commander';
import { ApiClient } from '../api-client.js';

type GlobalOptions = { apiUrl: string; token?: string; json?: boolean };

function client(command: Command, enrollmentToken?: string): ApiClient {
  const options = command.optsWithGlobals<GlobalOptions>();
  return new ApiClient({ apiUrl: options.apiUrl, token: enrollmentToken ?? options.token });
}

function output(command: Command, value: unknown): void {
  const json = command.optsWithGlobals<GlobalOptions>().json;
  process.stdout.write(`${JSON.stringify(value, null, json ? 2 : 2)}\n`);
}

async function run(command: Command, request: () => Promise<unknown>): Promise<void> {
  try {
    output(command, await request());
  } catch (error) {
    process.stderr.write(`allternit: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

export function createFabricCommand(): Command {
  const nodeEnroll = new Command('enroll')
    .description('Enroll this machine as a Private Fabric node')
    .requiredOption('--enrollment-token <token>', 'enrollment token')
    .requiredOption('--org <organization-id>', 'organization id')
    .requiredOption('--display-name <name>', 'node display name')
    .option('--region <region>', 'region', 'any')
    .option('--vcpu <count>', 'total vCPU cores', Number, 4)
    .option('--memory-mib <mib>', 'total memory in MiB', Number, 16384)
    .option('--gpu-vram-mib <mib>', 'total GPU VRAM in MiB', Number, 0)
    .option('--free-vcpu <count>', 'free vCPU cores', Number)
    .option('--free-memory-mib <mib>', 'free memory in MiB', Number)
    .option('--free-gpu-vram-mib <mib>', 'free GPU VRAM in MiB', Number)
    .action(function (this: Command, options: {
      enrollmentToken: string;
      org: string;
      displayName: string;
      region: string;
      vcpu: number;
      memoryMib: number;
      gpuVramMib: number;
      freeVcpu?: number;
      freeMemoryMib?: number;
      freeGpuVramMib?: number;
    }) {
      return run(this, () => client(this, options.enrollmentToken).request('POST', '/v1/fabric/nodes/enroll', {
        organization_id: options.org,
        display_name: options.displayName,
        region: options.region,
        capacity: {
          total_vcpu: options.vcpu,
          total_memory_mib: options.memoryMib,
          total_gpu_vram_mib: options.gpuVramMib,
          free_vcpu: options.freeVcpu ?? options.vcpu,
          free_memory_mib: options.freeMemoryMib ?? options.memoryMib,
          free_gpu_vram_mib: options.freeGpuVramMib ?? options.gpuVramMib,
        },
      }));
    });

  const node = new Command('node')
    .description('Manage Private Fabric nodes')
    .addCommand(nodeEnroll);

  return new Command('fabric')
    .description('Manage Private Fabric')
    .addCommand(node);
}

export const fabricCommand = createFabricCommand();
