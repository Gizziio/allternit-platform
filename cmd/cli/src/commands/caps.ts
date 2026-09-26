import { Command } from 'commander';
import { SubsClient } from '../subs/client.js';

type GlobalOptions = { json?: boolean };

interface CapabilityEntry {
  capability: string;
  adapter_id: string;
  provider: string;
  pool_id: string;
  plans: string[];
  detachable: boolean;
  export_formats: string[];
  status: string;
}

function output(command: Command, value: unknown): void {
  const json = command.optsWithGlobals<GlobalOptions>().json;
  process.stdout.write(`${JSON.stringify(value, null, json ? 2 : 2)}\n`);
}

export function createCapsCommand(): Command {
  const caps = new Command('caps').description('Subscription fabric capabilities');

  caps.addCommand(
    new Command('list')
      .description('List capabilities exposed by registered subscription adapters')
      .option('--provider <provider>', 'filter by provider')
      .action(async function (this: Command, options: { provider?: string }) {
        try {
          const entries = await new SubsClient().requestOk<CapabilityEntry[]>('GET', '/v1/capabilities');
          const filtered = options.provider
            ? entries.filter((e) => e.provider === options.provider)
            : entries;
          output(this, filtered);
        } catch (error) {
          process.stderr.write(`allternit: ${error instanceof Error ? error.message : String(error)}\n`);
          process.exitCode = 1;
        }
      }),
  );

  return caps;
}

export const capsCommand = createCapsCommand();
